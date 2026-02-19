"""Prometheus metrics using the official prometheus-client library."""
from __future__ import annotations

from typing import Dict, Optional

from prometheus_client import (
    REGISTRY,
    Counter,
    Gauge,
    Histogram,
    Info,
    generate_latest,
    CollectorRegistry,
)

from .models import Priority


class TaskQueuePrometheusMetrics:
    """Prometheus metrics for the task queue system."""
    
    def __init__(self, registry: Optional[CollectorRegistry] = None):
        self._registry = registry or REGISTRY
        
        self.jobs_submitted = Counter(
            "taskqueue_jobs_submitted_total",
            "Total number of jobs submitted",
            ["priority"],
            registry=self._registry,
        )
        
        self.jobs_completed = Counter(
            "taskqueue_jobs_completed_total",
            "Total number of jobs completed successfully",
            ["priority"],
            registry=self._registry,
        )
        
        self.jobs_failed = Counter(
            "taskqueue_jobs_failed_total",
            "Total number of jobs that failed",
            ["priority", "error_type"],
            registry=self._registry,
        )
        
        self.jobs_retried = Counter(
            "taskqueue_jobs_retried_total",
            "Total number of job retries",
            ["priority"],
            registry=self._registry,
        )
        
        self.jobs_dead_lettered = Counter(
            "taskqueue_jobs_dead_lettered_total",
            "Total number of jobs sent to dead letter queue",
            ["priority"],
            registry=self._registry,
        )
        
        self.queue_depth = Gauge(
            "taskqueue_queue_depth",
            "Current queue depth",
            ["priority"],
            registry=self._registry,
        )
        
        self.running_jobs = Gauge(
            "taskqueue_running_jobs",
            "Number of currently running jobs",
            ["worker_id"],
            registry=self._registry,
        )
        
        self.worker_count = Gauge(
            "taskqueue_worker_count",
            "Number of active workers",
            registry=self._registry,
        )
        
        self.job_processing_duration = Histogram(
            "taskqueue_job_processing_duration_seconds",
            "Job processing duration in seconds",
            ["priority", "job_name"],
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
            registry=self._registry,
        )
        
        self.job_wait_duration = Histogram(
            "taskqueue_job_wait_duration_seconds",
            "Time jobs spend waiting in queue",
            ["priority"],
            buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0),
            registry=self._registry,
        )
        
        self.throughput = Gauge(
            "taskqueue_throughput_jobs_per_second",
            "Current job throughput (jobs/sec)",
            registry=self._registry,
        )
        
        self.dlq_depth = Gauge(
            "taskqueue_dlq_depth",
            "Number of jobs in dead letter queue",
            registry=self._registry,
        )
        
        self.worker_info = Info(
            "taskqueue_worker",
            "Worker information",
            registry=self._registry,
        )
        
        self._jobs_completed_count = 0
        self._jobs_completed_window_start = 0
    
    def record_job_submitted(self, priority):
        """Record a job submission."""
        priority_name = priority if isinstance(priority, str) else priority.name
        self.jobs_submitted.labels(priority=priority_name).inc()
    
    def record_job_completed(
        self, 
        duration_seconds: float,
        priority = "normal",
        job_name: str = "unknown",
        wait_seconds: float = 0,
    ):
        """Record successful job completion."""
        priority_name = priority if isinstance(priority, str) else priority.name
        self.jobs_completed.labels(priority=priority_name).inc()
        self.job_processing_duration.labels(
            priority=priority_name, 
            job_name=job_name,
        ).observe(duration_seconds)
        
        if wait_seconds > 0:
            self.job_wait_duration.labels(priority=priority_name).observe(wait_seconds)
        
        self._update_throughput()
    
    def record_job_failed(
        self, 
        priority = "normal",
        error_type: str = "unknown",
    ):
        """Record job failure."""
        priority_name = priority if isinstance(priority, str) else priority.name
        self.jobs_failed.labels(priority=priority_name, error_type=error_type).inc()
    
    def record_job_retried(self, priority = "normal"):
        """Record job retry."""
        priority_name = priority if isinstance(priority, str) else priority.name
        self.jobs_retried.labels(priority=priority_name).inc()
    
    def record_job_dead_lettered(self, priority = "normal"):
        """Record job sent to DLQ."""
        priority_name = priority if isinstance(priority, str) else priority.name
        self.jobs_dead_lettered.labels(priority=priority_name).inc()
    
    def record_dlq_added(self):
        """Record job added to DLQ (simplified)."""
        self.dlq_depth.inc()
    
    def set_queue_depth(self, depth: int):
        """Set total queue depth."""
        self.queue_depth.labels(priority="total").set(depth)
    
    def set_dlq_depth(self, depth: int):
        """Set DLQ depth."""
        self.dlq_depth.set(depth)
    
    def set_worker_count(self, count: int):
        """Set worker count."""
        self.worker_count.set(count)
    
    def update_queue_depth(self, depths):
        """Update queue depth gauges."""
        for priority, depth in depths.items():
            priority_name = priority if isinstance(priority, str) else priority.name
            self.queue_depth.labels(priority=priority_name).set(depth)
    
    def update_running_jobs(self, worker_id: str, count: int):
        """Update running jobs count for a worker."""
        self.running_jobs.labels(worker_id=worker_id).set(count)
    
    def update_worker_count(self, count: int):
        """Update active worker count."""
        self.worker_count.set(count)
    
    def set_worker_info(self, info: Dict[str, str]):
        """Set worker information."""
        self.worker_info.info(info)
    
    def _update_throughput(self):
        """Update throughput calculation."""
        import time
        current_time = time.time()
        
        if self._jobs_completed_window_start == 0:
            self._jobs_completed_window_start = current_time
        
        self._jobs_completed_count += 1
        
        window_duration = current_time - self._jobs_completed_window_start
        if window_duration >= 1.0:
            throughput = self._jobs_completed_count / window_duration
            self.throughput.set(throughput)
            self._jobs_completed_count = 0
            self._jobs_completed_window_start = current_time
    
    def export(self) -> bytes:
        """Export metrics in Prometheus format."""
        return generate_latest(self._registry)


_metrics_instance: Optional[TaskQueuePrometheusMetrics] = None


def get_metrics() -> TaskQueuePrometheusMetrics:
    """Get global metrics instance."""
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = TaskQueuePrometheusMetrics()
    return _metrics_instance
