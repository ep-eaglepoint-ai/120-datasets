"""Main task queue client interface.

Uses Redis Streams for distributed queue, Prometheus client for metrics,
and structlog for structured logging.
"""
from __future__ import annotations

import asyncio
import os
import threading
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, TypeVar

from .dependencies import CircularDependencyError, DependencyGraph, DependencyResolver
from .models import Job, JobResult, JobStatus, Priority, QueueStats, RetryConfig
from .prometheus_metrics import TaskQueuePrometheusMetrics, get_metrics
from .redis_backend import RedisConfig, RedisConnection, RedisStreamsQueue
from .retry import RetryDecision, RetryManager, RetryScheduler
from .scheduler import (
    BulkJobSubmitter,
    DelayedJobScheduler,
    RecurringJobScheduler,
    UniquenessConstraint,
)
from .worker import WorkerNode, WorkerProcess, WorkerRegistry, WorkStealing
from .logging_config import get_logger

logger = get_logger(__name__)
T = TypeVar("T")


class TaskQueue:
    """Main task queue client for submitting and managing jobs.
    
    Uses Redis Streams for distributed message delivery and Prometheus
    client for metrics exposition.
    """
    
    def __init__(
        self,
        redis_config: Optional[RedisConfig] = None,
        heartbeat_timeout: float = 30.0,
    ):
        # Redis configuration with environment variable support
        self._redis_config = redis_config or RedisConfig(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
        )
        
        # Initialize Redis-based distributed queue
        try:
            self._redis_conn = RedisConnection.get_connection(self._redis_config)
            self._queue = RedisStreamsQueue(self._redis_conn)
            self._use_redis = True
            logger.info("connected_to_redis", host=self._redis_config.host, port=self._redis_config.port)
        except Exception as e:
            logger.warning("redis_connection_failed", error=str(e), fallback="in-memory")
            self._redis_conn = None
            self._queue = None
            self._use_redis = False
        
        # In-memory job storage for tracking
        self._jobs: Dict[str, Job] = {}
        self._jobs_lock = threading.RLock()
        
        self._delayed_scheduler = DelayedJobScheduler()
        self._recurring_scheduler = RecurringJobScheduler()
        self._dependency_resolver = DependencyResolver()
        self._uniqueness = UniquenessConstraint()
        
        # Prometheus metrics
        self._metrics = get_metrics()
        
        self._retry_manager = RetryManager(
            on_retry=self._on_job_retry,
            on_dlq=self._on_job_dlq,
            on_failure=self._on_job_failure,
        )
        self._retry_scheduler = RetryScheduler(self._retry_manager)
        
        self._worker_registry = WorkerRegistry(heartbeat_timeout)
        self._work_stealing = WorkStealing(self._worker_registry)
        
        self._bulk_submitter = BulkJobSubmitter(
            self._delayed_scheduler,
            on_submit=self._on_job_submitted,
        )
        
        self._handlers: Dict[str, Callable[[Job], JobResult]] = {}
        self._running = False
        self._lock = threading.RLock()
    
    def _register_job(self, job: Job):
        """Register a job in the local tracking store."""
        with self._jobs_lock:
            self._jobs[job.id] = job
    
    def _get_job(self, job_id: str) -> Optional[Job]:
        """Get a job from local tracking store."""
        with self._jobs_lock:
            return self._jobs.get(job_id)
    
    def _enqueue(self, job: Job):
        """Enqueue a job to Redis or in-memory fallback."""
        if self._use_redis and self._queue:
            self._queue.enqueue(job)
        self._register_job(job)
    
    def _dequeue(self, timeout: Optional[float] = None) -> Optional[Job]:
        """Dequeue a job from Redis or in-memory fallback."""
        if self._use_redis and self._queue:
            # Redis dequeue returns list of (message_id, job) tuples
            timeout_ms = int(timeout * 1000) if timeout else 1000
            results = self._queue.dequeue(
                consumer_name=f"worker_{id(self)}",
                timeout_ms=timeout_ms,
                count=1,
            )
            if results:
                message_id, job = results[0]
                return job
        return None
    
    def size(self) -> int:
        """Get total queue size."""
        if self._use_redis and self._queue:
            return self._queue.size()
        with self._jobs_lock:
            return len([j for j in self._jobs.values() if j.status == JobStatus.PENDING])
    
    def size_by_priority(self) -> Dict[Priority, int]:
        """Get queue size by priority level."""
        if self._use_redis and self._queue:
            return self._queue.size_by_priority()
        result = {p: 0 for p in Priority}
        with self._jobs_lock:
            for job in self._jobs.values():
                if job.status == JobStatus.PENDING:
                    result[Priority(job.priority)] += 1
        return result
    
    def register_handler(self, job_name: str, handler: Callable[[Job], JobResult]):
        """Register a handler function for a job type."""
        with self._lock:
            self._handlers[job_name] = handler
    
    def submit(
        self,
        name: str,
        payload: Dict[str, Any],
        priority: Priority = Priority.NORMAL,
        delay_ms: int = 0,
        depends_on: Optional[List[str]] = None,
        retry_config: Optional[RetryConfig] = None,
        unique_key: Optional[str] = None,
        cron_expression: Optional[str] = None,
        timezone: str = "UTC",
    ) -> str:
        """Submit a new job to the queue."""
        job = Job(
            name=name,
            payload=payload,
            priority=priority,
            delay_ms=delay_ms,
            depends_on=depends_on or [],
            retry_config=retry_config or RetryConfig(),
            unique_key=unique_key,
            cron_expression=cron_expression,
            timezone=timezone,
        )
        
        return self._submit_job(job)
    
    def _submit_job(self, job: Job) -> str:
        """Internal job submission."""
        if job.unique_key:
            if not self._uniqueness.acquire(job.unique_key, job.id):
                raise ValueError(f"Duplicate job with unique key: {job.unique_key}")
        
        if job.depends_on:
            success, error = self._dependency_resolver.submit_job(job)
            if not success:
                if job.unique_key:
                    self._uniqueness.release(job.unique_key)
                raise CircularDependencyError([error or "Unknown dependency error"])
        
        if job.cron_expression:
            self._recurring_scheduler.register(job)
            self._register_job(job)
            self._metrics.record_job_submitted(Priority(job.priority).name.lower())
            return job.id
        
        if job.delay_ms > 0 or job.scheduled_at:
            self._delayed_scheduler.schedule(job)
            self._register_job(job)
            self._metrics.record_job_submitted(Priority(job.priority).name.lower())
            return job.id
        
        if job.depends_on and self._dependency_resolver.graph.has_unmet_dependencies(job.id):
            job.status = JobStatus.PENDING
            self._register_job(job)
            self._metrics.record_job_submitted(Priority(job.priority).name.lower())
            return job.id
        
        self._enqueue(job)
        self._metrics.record_job_submitted(Priority(job.priority).name.lower())
        self._update_metrics()
        
        return job.id
    
    def submit_batch(
        self,
        jobs: List[Dict[str, Any]],
        atomic: bool = True,
    ) -> tuple[List[str], List[tuple[str, str]]]:
        """Submit multiple jobs with optional atomic semantics."""
        job_objects = []
        for job_data in jobs:
            job = Job(
                name=job_data["name"],
                payload=job_data.get("payload", {}),
                priority=job_data.get("priority", Priority.NORMAL),
                delay_ms=job_data.get("delay_ms", 0),
                depends_on=job_data.get("depends_on", []),
                retry_config=job_data.get("retry_config", RetryConfig()),
                unique_key=job_data.get("unique_key"),
            )
            job_objects.append(job)
        
        return self._bulk_submitter.submit_batch(job_objects, atomic)
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get a job by its ID."""
        return self._get_job(job_id)
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending or scheduled job."""
        job = self._get_job(job_id)
        if not job:
            return False
        
        if job.status == JobStatus.SCHEDULED:
            self._delayed_scheduler.cancel(job_id)
        elif job.status == JobStatus.PENDING:
            if self._use_redis and self._queue:
                self._queue.remove_job(job_id)
        else:
            return False
        
        if job.unique_key:
            self._uniqueness.release(job.unique_key)
        
        job.status = JobStatus.FAILED
        job.last_error = "Cancelled by user"
        return True
    
    def update_priority(self, job_id: str, new_priority: Priority) -> bool:
        """Update a job's priority."""
        job = self._get_job(job_id)
        if job:
            job.priority = new_priority.value
            return True
        return False
    
    def get_next_job(self, timeout: Optional[float] = None) -> Optional[Job]:
        """Get the next job to process from the queue."""
        due_delayed = self._delayed_scheduler.get_due_jobs()
        for job in due_delayed:
            if not self._dependency_resolver.graph.has_unmet_dependencies(job.id):
                return job
            self._enqueue(job)
        
        due_recurring = self._recurring_scheduler.get_due_jobs()
        for job in due_recurring:
            new_job = Job(
                name=job.name,
                payload=job.payload,
                priority=job.priority,
            )
            self._enqueue(new_job)
        
        due_retries = self._retry_scheduler.get_due_retries()
        for job_id in due_retries:
            self._retry_scheduler.pop_retry(job_id)
            job = self._get_job(job_id)
            if job:
                job.status = JobStatus.PENDING
                self._enqueue(job)
        
        job = self._dequeue(timeout)
        if job:
            self._update_metrics()
        return job
    
    def complete_job(self, job_id: str, result: JobResult):
        """Mark a job as complete."""
        job = self._get_job(job_id)
        if not job:
            return
        
        if result.success:
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            runnable = self._dependency_resolver.complete_job(job_id)
            for dep_job in runnable:
                self._enqueue(dep_job)
            
            self._metrics.record_job_completed(
                result.duration_ms / 1000,
                Priority(job.priority).name.lower(),
            )
        else:
            decision = self._retry_manager.handle_failure(job, result.error or "Unknown error")
            
            if decision.should_retry:
                self._retry_scheduler.schedule_retry(job, decision.delay_ms)
            else:
                self._dependency_resolver.fail_job(job_id)
                self._metrics.record_job_failed(Priority(job.priority).name.lower())
        
        if job.unique_key and job.status in (JobStatus.COMPLETED, JobStatus.DEAD):
            self._uniqueness.release(job.unique_key)
        
        self._update_metrics()
    
    def get_stats(self) -> QueueStats:
        """Get queue statistics."""
        return QueueStats(
            total_jobs=len(self._jobs),
            pending_jobs=len([j for j in self._jobs.values() if j.status == JobStatus.PENDING]),
            completed_jobs=len([j for j in self._jobs.values() if j.status == JobStatus.COMPLETED]),
            failed_jobs=len([j for j in self._jobs.values() if j.status == JobStatus.FAILED]),
            queue_depth=self.size(),
        )
    
    def get_dlq(self) -> List[Job]:
        """Get jobs in the dead-letter queue."""
        return self._retry_manager.get_dlq()
    
    def requeue_from_dlq(self, job_id: str, reset_attempts: bool = True) -> Optional[str]:
        """Requeue a job from the dead-letter queue."""
        job = self._retry_manager.requeue_from_dlq(job_id, reset_attempts)
        if job:
            self._enqueue(job)
            self._update_metrics()
            return job.id
        return None
    
    def get_prometheus_metrics(self) -> str:
        """Get metrics in Prometheus format."""
        return self._metrics.export()
    
    def _on_job_submitted(self, job: Job):
        """Callback when a job is submitted."""
        logger.info("job_submitted", job_id=job.id, name=job.name)
    
    def _on_job_retry(self, job: Job, attempt: int, delay_ms: int):
        """Callback when a job is scheduled for retry."""
        logger.info("job_retry_scheduled", job_id=job.id, attempt=attempt, delay_ms=delay_ms)
    
    def _on_job_dlq(self, job: Job, reason: str):
        """Callback when a job is sent to DLQ."""
        logger.warning("job_sent_to_dlq", job_id=job.id, reason=reason)
        self._metrics.record_dlq_added()
    
    def _on_job_failure(self, job: Job, error: str):
        """Callback when a job fails permanently."""
        logger.error("job_failed", job_id=job.id, error=error)
    
    def _update_metrics(self):
        """Update queue metrics."""
        size_by_priority = self.size_by_priority()
        total_size = self.size()
        self._metrics.set_queue_depth(total_size)
        self._metrics.set_dlq_depth(self._retry_manager.get_dlq_size())
        self._metrics.set_worker_count(self._worker_registry.get_worker_count())
    
    def register_worker(self, worker: WorkerProcess) -> bool:
        """Register a worker with the queue."""
        node = WorkerNode(info=worker.info)
        return self._worker_registry.register(node)
    
    def unregister_worker(self, worker_id: str):
        """Unregister a worker."""
        self._worker_registry.unregister(worker_id)
        self._update_metrics()
    
    def worker_heartbeat(self, worker_id: str) -> bool:
        """Update worker heartbeat."""
        return self._worker_registry.heartbeat(worker_id)
    
    def get_queue_size(self) -> int:
        """Get total queue size."""
        return self.size()
    
    def get_queue_size_by_priority(self) -> Dict[Priority, int]:
        """Get queue size by priority level."""
        return self.size_by_priority()
    
    def clear(self):
        """Clear all jobs from the queue."""
        if self._use_redis and self._queue:
            self._queue.clear()
        with self._jobs_lock:
            self._jobs.clear()
        self._update_metrics()
    
    def list_jobs(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> List[Job]:
        """List jobs with optional filters."""
        with self._jobs_lock:
            jobs = list(self._jobs.values())
            
            jobs.sort(key=lambda j: j.created_at, reverse=True)
            
            if status:
                target_status = status.upper()
                jobs = [j for j in jobs if j.status.value.upper() == target_status]
            if priority:
                target_priority = priority.upper()
                jobs = [j for j in jobs if Priority(j.priority).name == target_priority]
            
            if cursor:
                start_idx = 0
                for i, job in enumerate(jobs):
                    if job.id == cursor:
                        start_idx = i + 1
                        break
                jobs = jobs[start_idx:]
            
            return jobs[:limit]
    
    def get_queue_depths(self) -> Dict[Priority, int]:
        """Get queue depths per priority level."""
        return self.size_by_priority()
    
    def get_workers(self) -> List[WorkerNode]:
        """Get all registered workers."""
        return self._worker_registry.get_all_workers()
    
    def get_worker_count(self) -> int:
        """Get number of registered workers."""
        return self._worker_registry.get_worker_count()
    
    def get_dlq_jobs(self, limit: int = 50) -> List[Job]:
        """Get jobs from dead-letter queue."""
        return self._retry_manager.get_dlq()[:limit]
    
    def retry_job(self, job_id: str) -> Optional[Job]:
        """Retry a failed job from DLQ."""
        job = self._retry_manager.requeue_from_dlq(job_id, reset_attempts=True)
        if job:
            self._enqueue(job)
            self._update_metrics()
        return job


class AsyncTaskQueue:
    """Async wrapper for TaskQueue using Redis Streams."""
    
    def __init__(self, queue: Optional[TaskQueue] = None):
        self._queue = queue or TaskQueue()
    
    async def submit(
        self,
        name: str,
        payload: Dict[str, Any],
        priority: Priority = Priority.NORMAL,
        **kwargs,
    ) -> str:
        return self._queue.submit(name, payload, priority, **kwargs)
    
    async def get_next_job(self, timeout: Optional[float] = None) -> Optional[Job]:
        return self._queue.get_next_job(timeout)
    
    async def complete_job(self, job_id: str, result: JobResult):
        self._queue.complete_job(job_id, result)
    
    def get_stats(self) -> QueueStats:
        return self._queue.get_stats()
