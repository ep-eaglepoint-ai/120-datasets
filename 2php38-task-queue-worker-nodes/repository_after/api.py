"""FastAPI REST API for job inspection and queue management."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .logging_config import get_logger
from .models import Job, JobStatus, Priority, RetryConfig, QueueStats
from .prometheus_metrics import get_metrics

logger = get_logger(__name__)

app = FastAPI(
    title="Task Queue API",
    description="REST API for distributed task queue management",
    version="1.0.0",
)


class JobSubmitRequest(BaseModel):
    """Request model for job submission."""
    name: str = Field(..., description="Job name/type")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Job payload")
    priority: str = Field(default="NORMAL", description="Job priority level")
    delay_ms: int = Field(default=0, ge=0, description="Delay in milliseconds")
    depends_on: List[str] = Field(default_factory=list, description="Job dependencies")
    unique_key: Optional[str] = Field(default=None, description="Unique constraint key")
    retry_max_attempts: int = Field(default=3, ge=1, description="Max retry attempts")
    retry_base_delay_ms: int = Field(default=1000, ge=0, description="Base retry delay")


class JobSubmitResponse(BaseModel):
    """Response model for job submission."""
    job_id: str
    status: str
    created_at: str


class JobResponse(BaseModel):
    """Response model for job details."""
    id: str
    name: str
    status: str
    priority: str
    payload: Dict[str, Any]
    attempt: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    last_error: Optional[str] = None
    depends_on: List[str] = []


class JobListResponse(BaseModel):
    """Response model for job list."""
    jobs: List[JobResponse]
    total: int
    cursor: Optional[str] = None


class QueueStatsResponse(BaseModel):
    """Response model for queue statistics."""
    total_jobs: int
    pending_jobs: int
    running_jobs: int
    completed_jobs: int
    failed_jobs: int
    dead_jobs: int
    avg_processing_time_ms: float
    throughput_per_second: float
    queue_depths: Dict[str, int]
    worker_count: int


class WorkerResponse(BaseModel):
    """Response model for worker details."""
    id: str
    name: str
    host: str
    port: int
    status: str
    current_jobs: int
    max_concurrent_jobs: int
    last_heartbeat: str


class WorkerListResponse(BaseModel):
    """Response model for worker list."""
    workers: List[WorkerResponse]
    total: int


_task_queue = None


def set_task_queue(queue):
    """Set the task queue instance for the API."""
    global _task_queue
    _task_queue = queue


def get_task_queue():
    """Get the task queue instance."""
    if _task_queue is None:
        raise HTTPException(status_code=503, detail="Task queue not initialized")
    return _task_queue


@app.post("/jobs", response_model=JobSubmitResponse, status_code=201)
async def submit_job(request: JobSubmitRequest):
    """Submit a new job to the queue."""
    queue = get_task_queue()
    
    try:
        priority = Priority[request.priority.upper()]
    except KeyError:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid priority: {request.priority}. Valid values: {[p.name for p in Priority]}"
        )
    
    try:
        job_id = queue.submit(
            name=request.name,
            payload=request.payload,
            priority=priority,
            delay_ms=request.delay_ms,
            depends_on=request.depends_on,
            unique_key=request.unique_key,
            retry_config=RetryConfig(
                max_attempts=request.retry_max_attempts,
                base_delay_ms=request.retry_base_delay_ms,
            ),
        )
        
        logger.info("job_submitted_via_api", job_id=job_id, name=request.name)
        
        return JobSubmitResponse(
            job_id=job_id,
            status="PENDING",
            created_at=datetime.utcnow().isoformat(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("job_submit_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to submit job")


@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get job details by ID."""
    queue = get_task_queue()
    
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    
    priority = Priority(job.priority) if isinstance(job.priority, int) else job.priority
    
    return JobResponse(
        id=job.id,
        name=job.name,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        priority=priority.name,
        payload=job.payload,
        attempt=job.attempt,
        created_at=job.created_at.isoformat() if job.created_at else "",
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        last_error=job.last_error,
        depends_on=job.depends_on or [],
    )


@app.delete("/jobs/{job_id}", status_code=204)
async def cancel_job(job_id: str):
    """Cancel a pending job."""
    queue = get_task_queue()
    
    if not queue.cancel_job(job_id):
        raise HTTPException(status_code=404, detail=f"Job not found or cannot be cancelled: {job_id}")
    
    logger.info("job_cancelled_via_api", job_id=job_id)


@app.put("/jobs/{job_id}/priority")
async def update_job_priority(job_id: str, priority: str):
    """Update job priority."""
    queue = get_task_queue()
    
    try:
        new_priority = Priority[priority.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")
    
    if not queue.update_priority(job_id, new_priority):
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    
    return {"job_id": job_id, "priority": new_priority.name}


@app.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
):
    """List jobs with optional filters."""
    queue = get_task_queue()
    
    jobs = queue.list_jobs(
        status=status,
        priority=priority,
        limit=limit,
        cursor=cursor,
    )
    
    job_responses = []
    for job in jobs:
        p = Priority(job.priority) if isinstance(job.priority, int) else job.priority
        job_responses.append(JobResponse(
            id=job.id,
            name=job.name,
            status=job.status.value if isinstance(job.status, JobStatus) else job.status,
            priority=p.name,
            payload=job.payload,
            attempt=job.attempt,
            created_at=job.created_at.isoformat() if job.created_at else "",
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            last_error=job.last_error,
            depends_on=job.depends_on or [],
        ))
    
    next_cursor = jobs[-1].id if len(jobs) == limit else None
    
    return JobListResponse(
        jobs=job_responses,
        total=len(job_responses),
        cursor=next_cursor,
    )


@app.post("/jobs/{job_id}/retry", response_model=JobResponse)
async def retry_job(job_id: str):
    """Retry a failed job."""
    queue = get_task_queue()
    
    job = queue.retry_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found or cannot be retried: {job_id}")
    
    logger.info("job_retried_via_api", job_id=job_id)
    
    p = Priority(job.priority) if isinstance(job.priority, int) else job.priority
    return JobResponse(
        id=job.id,
        name=job.name,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        priority=p.name,
        payload=job.payload,
        attempt=job.attempt,
        created_at=job.created_at.isoformat() if job.created_at else "",
        depends_on=job.depends_on or [],
    )


@app.get("/stats", response_model=QueueStatsResponse)
async def get_stats():
    """Get queue statistics."""
    queue = get_task_queue()
    metrics = get_metrics()
    
    stats = queue.get_stats()
    depths = queue.get_queue_depths()
    
    return QueueStatsResponse(
        total_jobs=stats.total_jobs,
        pending_jobs=stats.pending_jobs,
        running_jobs=stats.running_jobs,
        completed_jobs=stats.completed_jobs,
        failed_jobs=stats.failed_jobs,
        dead_jobs=stats.dead_jobs,
        avg_processing_time_ms=stats.avg_processing_time_ms,
        throughput_per_second=getattr(stats, 'throughput_per_second', 0.0),
        queue_depths={p.name: d for p, d in depths.items()},
        worker_count=queue.get_worker_count(),
    )


@app.get("/workers", response_model=WorkerListResponse)
async def list_workers():
    """List all registered workers."""
    queue = get_task_queue()
    
    workers = queue.get_workers()
    
    worker_responses = []
    for w in workers:
        worker_responses.append(WorkerResponse(
            id=w.info.id,
            name=w.info.name,
            host=w.info.host,
            port=w.info.port,
            status="active" if w.is_active() else "inactive",
            current_jobs=len(w.info.current_jobs),
            max_concurrent_jobs=w.info.max_concurrent_jobs,
            last_heartbeat=w.info.last_heartbeat.isoformat() if w.info.last_heartbeat else "",
        ))
    
    return WorkerListResponse(
        workers=worker_responses,
        total=len(worker_responses),
    )


@app.get("/dlq")
async def list_dead_letter_queue(
    limit: int = Query(50, ge=1, le=100),
):
    """List jobs in dead letter queue."""
    queue = get_task_queue()
    
    dlq_jobs = queue.get_dlq_jobs(limit=limit)
    
    return {
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "last_error": job.last_error,
                "attempts": job.attempt,
            }
            for job in dlq_jobs
        ],
        "total": len(dlq_jobs),
    }


@app.post("/dlq/{job_id}/requeue")
async def requeue_from_dlq(job_id: str, reset_attempts: bool = Query(True)):
    """Requeue a job from dead letter queue."""
    queue = get_task_queue()
    
    job = queue.requeue_from_dlq(job_id, reset_attempts=reset_attempts)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found in DLQ: {job_id}")
    
    return {"job_id": job.id, "status": "requeued"}


@app.get("/metrics")
async def prometheus_metrics():
    """Expose Prometheus metrics."""
    metrics = get_metrics()
    return Response(
        content=metrics.export(),
        media_type="text/plain; charset=utf-8",
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    logger.info("api_startup")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("api_shutdown")
