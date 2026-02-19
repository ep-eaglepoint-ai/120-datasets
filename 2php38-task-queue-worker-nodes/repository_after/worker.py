"""Worker node management with heartbeat, work stealing, and leader election."""
from __future__ import annotations

import asyncio
import os
import signal
import socket
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from .models import Job, JobResult, JobStatus, WorkerInfo


class DistributedLock:
    """Redis-compatible distributed lock (in-memory for testing)."""
    
    _locks: Dict[str, tuple[str, float]] = {}
    _lock = threading.RLock()
    
    @classmethod
    def acquire(cls, key: str, owner: str, ttl_seconds: float = 30) -> bool:
        """Try to acquire a lock."""
        with cls._lock:
            now = time.time()
            
            if key in cls._locks:
                current_owner, expiry = cls._locks[key]
                if now < expiry:
                    return current_owner == owner
                del cls._locks[key]
            
            cls._locks[key] = (owner, now + ttl_seconds)
            return True
    
    @classmethod
    def release(cls, key: str, owner: str) -> bool:
        """Release a lock if owned."""
        with cls._lock:
            if key in cls._locks:
                current_owner, _ = cls._locks[key]
                if current_owner == owner:
                    del cls._locks[key]
                    return True
            return False
    
    @classmethod
    def extend(cls, key: str, owner: str, ttl_seconds: float = 30) -> bool:
        """Extend lock TTL if owned."""
        with cls._lock:
            if key in cls._locks:
                current_owner, _ = cls._locks[key]
                if current_owner == owner:
                    cls._locks[key] = (owner, time.time() + ttl_seconds)
                    return True
            return False
    
    @classmethod
    def is_locked(cls, key: str) -> bool:
        """Check if a lock is held."""
        with cls._lock:
            if key in cls._locks:
                _, expiry = cls._locks[key]
                return time.time() < expiry
            return False
    
    @classmethod
    def clear_all(cls):
        """Clear all locks (for testing)."""
        with cls._lock:
            cls._locks.clear()


class LeaderElection:
    """Leader election using distributed locking."""
    
    LEADER_LOCK_KEY = "taskqueue:leader"
    
    def __init__(self, worker_id: str, ttl_seconds: float = 30):
        self._worker_id = worker_id
        self._ttl = ttl_seconds
        self._is_leader = False
        self._lock = threading.RLock()
    
    def try_become_leader(self) -> bool:
        """Attempt to become the leader."""
        with self._lock:
            if DistributedLock.acquire(self.LEADER_LOCK_KEY, self._worker_id, self._ttl):
                self._is_leader = True
                return True
            return False
    
    def maintain_leadership(self) -> bool:
        """Extend leadership if currently leader."""
        with self._lock:
            if self._is_leader:
                if DistributedLock.extend(self.LEADER_LOCK_KEY, self._worker_id, self._ttl):
                    return True
                self._is_leader = False
            return False
    
    def resign(self) -> bool:
        """Voluntarily resign leadership."""
        with self._lock:
            if self._is_leader:
                DistributedLock.release(self.LEADER_LOCK_KEY, self._worker_id)
                self._is_leader = False
                return True
            return False
    
    @property
    def is_leader(self) -> bool:
        with self._lock:
            return self._is_leader


@dataclass
class WorkerNode:
    """Represents a worker node in the cluster."""
    info: WorkerInfo
    _running_jobs: Dict[str, Job] = field(default_factory=dict)
    _lock: threading.RLock = field(default_factory=threading.RLock)
    
    def assign_job(self, job: Job) -> bool:
        """Assign a job to this worker."""
        with self._lock:
            if len(self._running_jobs) >= self.info.max_concurrent_jobs:
                return False
            self._running_jobs[job.id] = job
            job.worker_id = self.info.id
            job.status = JobStatus.RUNNING
            self.info.current_jobs.append(job.id)
            return True
    
    def complete_job(self, job_id: str, success: bool) -> Optional[Job]:
        """Mark a job as complete on this worker."""
        with self._lock:
            job = self._running_jobs.pop(job_id, None)
            if job:
                if job_id in self.info.current_jobs:
                    self.info.current_jobs.remove(job_id)
                if success:
                    self.info.processed_count += 1
                else:
                    self.info.failed_count += 1
            return job
    
    def get_running_jobs(self) -> List[Job]:
        with self._lock:
            return list(self._running_jobs.values())
    
    def get_available_capacity(self) -> int:
        with self._lock:
            return self.info.max_concurrent_jobs - len(self._running_jobs)
    
    def update_heartbeat(self):
        from datetime import datetime
        self.info.last_heartbeat = datetime.utcnow()


class WorkerRegistry:
    """Registry of active worker nodes."""
    
    def __init__(self, heartbeat_timeout_seconds: float = 30):
        self._workers: Dict[str, WorkerNode] = {}
        self._heartbeat_timeout = heartbeat_timeout_seconds
        self._lock = threading.RLock()
    
    def register(self, worker: WorkerNode) -> bool:
        """Register a new worker."""
        with self._lock:
            self._workers[worker.info.id] = worker
            return True
    
    def unregister(self, worker_id: str) -> Optional[WorkerNode]:
        """Unregister a worker."""
        with self._lock:
            return self._workers.pop(worker_id, None)
    
    def get_worker(self, worker_id: str) -> Optional[WorkerNode]:
        with self._lock:
            return self._workers.get(worker_id)
    
    def get_all_workers(self) -> List[WorkerNode]:
        with self._lock:
            return list(self._workers.values())
    
    def get_active_workers(self) -> List[WorkerNode]:
        """Get workers with recent heartbeats."""
        from datetime import datetime, timedelta
        
        cutoff = datetime.utcnow() - timedelta(seconds=self._heartbeat_timeout)
        
        with self._lock:
            return [
                w for w in self._workers.values()
                if w.info.last_heartbeat >= cutoff
            ]
    
    def get_stale_workers(self) -> List[WorkerNode]:
        """Get workers with expired heartbeats."""
        from datetime import datetime, timedelta
        
        cutoff = datetime.utcnow() - timedelta(seconds=self._heartbeat_timeout)
        
        with self._lock:
            return [
                w for w in self._workers.values()
                if w.info.last_heartbeat < cutoff
            ]
    
    def heartbeat(self, worker_id: str) -> bool:
        """Update worker heartbeat."""
        with self._lock:
            worker = self._workers.get(worker_id)
            if worker:
                worker.update_heartbeat()
                return True
            return False
    
    def get_worker_count(self) -> int:
        with self._lock:
            return len(self._workers)


class WorkStealing:
    """Work stealing for load balancing across workers."""
    
    def __init__(self, registry: WorkerRegistry, threshold: float = 0.3):
        self._registry = registry
        self._threshold = threshold
    
    def find_overloaded_workers(self) -> List[WorkerNode]:
        """Find workers with high load."""
        workers = self._registry.get_active_workers()
        overloaded = []
        
        for worker in workers:
            capacity = worker.info.max_concurrent_jobs
            current = len(worker.info.current_jobs)
            if capacity > 0 and (current / capacity) > (1 - self._threshold):
                overloaded.append(worker)
        
        return overloaded
    
    def find_underloaded_workers(self) -> List[WorkerNode]:
        """Find workers with low load."""
        workers = self._registry.get_active_workers()
        underloaded = []
        
        for worker in workers:
            capacity = worker.info.max_concurrent_jobs
            current = len(worker.info.current_jobs)
            if capacity > 0 and (current / capacity) < self._threshold:
                underloaded.append(worker)
        
        return underloaded
    
    def get_steal_candidates(self, from_worker: WorkerNode) -> List[Job]:
        """Get jobs that can be stolen from a worker."""
        jobs = from_worker.get_running_jobs()
        return [j for j in jobs if j.status == JobStatus.PENDING]
    
    def steal_job(self, job: Job, from_worker: WorkerNode, to_worker: WorkerNode) -> bool:
        """Transfer a job from one worker to another."""
        stolen = from_worker.complete_job(job.id, success=False)
        if stolen:
            if to_worker.assign_job(stolen):
                return True
            from_worker.assign_job(stolen)
        return False
    
    def steal_jobs(self, count: int = 1) -> List[str]:
        """Attempt to steal jobs from overloaded workers to underloaded ones."""
        stolen_job_ids = []
        
        overloaded = self.find_overloaded_workers()
        underloaded = self.find_underloaded_workers()
        
        if not overloaded or not underloaded:
            return stolen_job_ids
        
        for from_worker in overloaded:
            if len(stolen_job_ids) >= count:
                break
            
            job_ids = list(from_worker.info.current_jobs)
            for job_id in job_ids:
                if len(stolen_job_ids) >= count:
                    break
                
                for to_worker in underloaded:
                    capacity = to_worker.info.max_concurrent_jobs
                    current = len(to_worker.info.current_jobs)
                    
                    if current < capacity:
                        # Move job reference
                        if job_id in from_worker.info.current_jobs:
                            from_worker.info.current_jobs.remove(job_id)
                            to_worker.info.current_jobs.append(job_id)
                            stolen_job_ids.append(job_id)
                            break
        
        return stolen_job_ids


class GracefulShutdown:
    """Handles graceful worker shutdown with job reassignment."""
    
    def __init__(
        self,
        worker: WorkerNode,
        registry: WorkerRegistry,
        on_job_reassign: Optional[Callable[[Job], None]] = None,
    ):
        self._worker = worker
        self._registry = registry
        self._on_job_reassign = on_job_reassign
        self._shutdown_requested = threading.Event()
        self._shutdown_complete = threading.Event()
    
    def request_shutdown(self):
        """Signal that shutdown has been requested."""
        self._shutdown_requested.set()
    
    def is_shutdown_requested(self) -> bool:
        return self._shutdown_requested.is_set()
    
    def wait_for_shutdown(self, timeout: Optional[float] = None) -> bool:
        """Wait for shutdown to complete."""
        return self._shutdown_complete.wait(timeout)
    
    def execute_shutdown(self, timeout_seconds: float = 30) -> List[Job]:
        """Execute graceful shutdown, returning unfinished jobs."""
        self._worker.info.status = "draining"
        
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            running = self._worker.get_running_jobs()
            if not running:
                break
            time.sleep(0.1)
        
        unfinished = self._worker.get_running_jobs()
        
        for job in unfinished:
            self._worker.complete_job(job.id, success=False)
            job.status = JobStatus.PENDING
            job.worker_id = None
            
            if self._on_job_reassign:
                self._on_job_reassign(job)
        
        self._registry.unregister(self._worker.info.id)
        self._worker.info.status = "stopped"
        self._shutdown_complete.set()
        
        return unfinished


class WorkerProcess:
    """Main worker process that processes jobs."""
    
    def __init__(
        self,
        name: str,
        handler: Callable[[Job], JobResult],
        max_concurrent: int = 10,
        heartbeat_interval: float = 10,
    ):
        self._handler = handler
        self._heartbeat_interval = heartbeat_interval
        
        self.info = WorkerInfo(
            id=str(uuid.uuid4()),
            name=name,
            host=socket.gethostname(),
            port=os.getpid(),
            max_concurrent_jobs=max_concurrent,
        )
        
        self.node = WorkerNode(info=self.info)
        self._running = False
        self._leader_election: Optional[LeaderElection] = None
    
    def setup_leader_election(self, ttl_seconds: float = 30):
        """Enable leader election for this worker."""
        self._leader_election = LeaderElection(self.info.id, ttl_seconds)
    
    async def process_job(self, job: Job) -> JobResult:
        """Process a single job."""
        from datetime import datetime
        
        start_time = time.time()
        job.started_at = datetime.utcnow()
        
        try:
            result = self._handler(job)
            job.completed_at = datetime.utcnow()
            job.status = JobStatus.COMPLETED
            return result
        except Exception as e:
            job.completed_at = datetime.utcnow()
            job.status = JobStatus.FAILED
            job.last_error = str(e)
            
            return JobResult(
                job_id=job.id,
                success=False,
                error=str(e),
                duration_ms=(time.time() - start_time) * 1000,
            )
    
    def start(self):
        """Start the worker."""
        self._running = True
        self.info.status = "active"
    
    def stop(self):
        """Stop the worker."""
        self._running = False
        if self._leader_election:
            self._leader_election.resign()
    
    @property
    def is_running(self) -> bool:
        return self._running
    
    @property
    def is_leader(self) -> bool:
        if self._leader_election:
            return self._leader_election.is_leader
        return False
