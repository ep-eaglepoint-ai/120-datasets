"""Multiprocessing worker for CPU-bound tasks."""
from __future__ import annotations

import asyncio
import multiprocessing as mp
import os
import signal
import time
from concurrent.futures import ProcessPoolExecutor, Future
from dataclasses import dataclass
from multiprocessing import Queue, Process
from typing import Any, Callable, Dict, List, Optional, Tuple

from .logging_config import get_logger
from .models import Job, JobResult, JobStatus, WorkerInfo
from .prometheus_metrics import get_metrics

logger = get_logger(__name__)


@dataclass
class WorkerTask:
    """Task to be executed by worker process."""
    job_id: str
    job_name: str
    payload: Dict[str, Any]
    handler_name: str


@dataclass
class WorkerResult:
    """Result from worker process."""
    job_id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0


def _worker_process_entry(
    task_queue: Queue,
    result_queue: Queue,
    handlers: Dict[str, Callable],
    worker_id: str,
):
    """Entry point for worker subprocess."""
    import signal
    
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    
    logger.info("worker_process_started", worker_id=worker_id, pid=os.getpid())
    
    while True:
        try:
            task: Optional[WorkerTask] = task_queue.get(timeout=1.0)
            
            if task is None:
                logger.info("worker_process_shutdown", worker_id=worker_id)
                break
            
            handler = handlers.get(task.handler_name)
            if not handler:
                result_queue.put(WorkerResult(
                    job_id=task.job_id,
                    success=False,
                    error=f"Handler not found: {task.handler_name}",
                ))
                continue
            
            start_time = time.time()
            try:
                result = handler(task.payload)
                duration = time.time() - start_time
                
                result_queue.put(WorkerResult(
                    job_id=task.job_id,
                    success=True,
                    result=result,
                    duration_seconds=duration,
                ))
                
            except Exception as e:
                duration = time.time() - start_time
                result_queue.put(WorkerResult(
                    job_id=task.job_id,
                    success=False,
                    error=str(e),
                    duration_seconds=duration,
                ))
                
        except Exception:
            continue


class MultiprocessWorkerPool:
    """Pool of worker processes for CPU-bound tasks."""
    
    def __init__(
        self,
        num_workers: int = None,
        handlers: Optional[Dict[str, Callable]] = None,
    ):
        self._num_workers = num_workers or mp.cpu_count()
        self._handlers = handlers or {}
        self._task_queue: Queue = mp.Queue()
        self._result_queue: Queue = mp.Queue()
        self._processes: List[Process] = []
        self._running = False
        self._metrics = get_metrics()
    
    def register_handler(self, name: str, handler: Callable):
        """Register a job handler."""
        self._handlers[name] = handler
        logger.info("handler_registered", handler_name=name)
    
    def start(self):
        """Start worker processes."""
        if self._running:
            return
        
        self._running = True
        
        for i in range(self._num_workers):
            worker_id = f"worker-{i}"
            p = Process(
                target=_worker_process_entry,
                args=(
                    self._task_queue,
                    self._result_queue,
                    self._handlers,
                    worker_id,
                ),
                daemon=True,
            )
            p.start()
            self._processes.append(p)
            logger.info("worker_process_spawned", worker_id=worker_id, pid=p.pid)
        
        self._metrics.update_worker_count(len(self._processes))
    
    def stop(self, timeout: float = 5.0):
        """Stop all worker processes gracefully."""
        if not self._running:
            return
        
        self._running = False
        
        for _ in self._processes:
            self._task_queue.put(None)
        
        for p in self._processes:
            p.join(timeout=timeout)
            if p.is_alive():
                logger.warning("worker_process_forceful_kill", pid=p.pid)
                p.terminate()
        
        self._processes.clear()
        self._metrics.update_worker_count(0)
        logger.info("worker_pool_stopped")
    
    def submit(self, job: Job, handler_name: str) -> bool:
        """Submit a job for processing."""
        if not self._running:
            return False
        
        task = WorkerTask(
            job_id=job.id,
            job_name=job.name,
            payload=job.payload,
            handler_name=handler_name,
        )
        
        self._task_queue.put(task)
        logger.debug("job_submitted_to_pool", job_id=job.id)
        return True
    
    def get_results(self, timeout: float = 0.1) -> List[WorkerResult]:
        """Get completed job results."""
        results = []
        
        while True:
            try:
                result = self._result_queue.get(timeout=timeout)
                results.append(result)
            except Exception:
                break
        
        return results
    
    @property
    def worker_count(self) -> int:
        return len(self._processes)
    
    @property
    def is_running(self) -> bool:
        return self._running


class AsyncWorkerPool:
    """Async wrapper for I/O-bound tasks using asyncio."""
    
    def __init__(self, max_concurrent: int = 100):
        self._max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._handlers: Dict[str, Callable] = {}
        self._running_jobs: Dict[str, asyncio.Task] = {}
        self._metrics = get_metrics()
    
    def register_handler(self, name: str, handler: Callable):
        """Register an async job handler."""
        self._handlers[name] = handler
    
    async def submit(self, job: Job, handler_name: str) -> Optional[asyncio.Task]:
        """Submit an async job for processing."""
        handler = self._handlers.get(handler_name)
        if not handler:
            logger.error("handler_not_found", handler_name=handler_name)
            return None
        
        async def run_job():
            async with self._semaphore:
                start_time = time.time()
                try:
                    if asyncio.iscoroutinefunction(handler):
                        result = await handler(job.payload)
                    else:
                        result = handler(job.payload)
                    
                    duration = time.time() - start_time
                    return WorkerResult(
                        job_id=job.id,
                        success=True,
                        result=result,
                        duration_seconds=duration,
                    )
                except Exception as e:
                    duration = time.time() - start_time
                    return WorkerResult(
                        job_id=job.id,
                        success=False,
                        error=str(e),
                        duration_seconds=duration,
                    )
                finally:
                    self._running_jobs.pop(job.id, None)
        
        task = asyncio.create_task(run_job())
        self._running_jobs[job.id] = task
        return task
    
    async def wait_all(self, timeout: Optional[float] = None) -> List[WorkerResult]:
        """Wait for all running jobs to complete."""
        if not self._running_jobs:
            return []
        
        tasks = list(self._running_jobs.values())
        done, pending = await asyncio.wait(
            tasks,
            timeout=timeout,
            return_when=asyncio.ALL_COMPLETED,
        )
        
        results = []
        for task in done:
            try:
                result = task.result()
                if result:
                    results.append(result)
            except Exception:
                pass
        
        return results
    
    @property
    def running_count(self) -> int:
        return len(self._running_jobs)


class HybridWorkerPool:
    """Hybrid worker pool combining multiprocessing and asyncio."""
    
    def __init__(
        self,
        cpu_workers: int = None,
        io_concurrency: int = 100,
    ):
        self._cpu_pool = MultiprocessWorkerPool(num_workers=cpu_workers)
        self._io_pool = AsyncWorkerPool(max_concurrent=io_concurrency)
        self._cpu_handlers: set = set()
        self._io_handlers: set = set()
    
    def register_cpu_handler(self, name: str, handler: Callable):
        """Register a CPU-bound job handler."""
        self._cpu_pool.register_handler(name, handler)
        self._cpu_handlers.add(name)
    
    def register_io_handler(self, name: str, handler: Callable):
        """Register an I/O-bound job handler."""
        self._io_pool.register_handler(name, handler)
        self._io_handlers.add(name)
    
    def start(self):
        """Start the CPU worker pool."""
        self._cpu_pool.start()
    
    def stop(self, timeout: float = 5.0):
        """Stop all workers."""
        self._cpu_pool.stop(timeout)
    
    async def submit(self, job: Job, handler_name: str) -> bool:
        """Submit a job to the appropriate pool."""
        if handler_name in self._cpu_handlers:
            return self._cpu_pool.submit(job, handler_name)
        elif handler_name in self._io_handlers:
            task = await self._io_pool.submit(job, handler_name)
            return task is not None
        else:
            logger.error("unknown_handler", handler_name=handler_name)
            return False
