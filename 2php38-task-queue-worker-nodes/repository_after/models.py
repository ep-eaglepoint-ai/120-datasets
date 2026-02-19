"""Pydantic models for job definitions and payloads."""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field, field_validator


class Priority(int, Enum):
    """Job priority levels (lower value = higher priority)."""
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BATCH = 4


class JobStatus(str, Enum):
    """Job lifecycle states."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    DEAD = "dead"  # In dead-letter queue


class RetryStrategy(str, Enum):
    """Retry strategy types."""
    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    CUSTOM = "custom"


T = TypeVar("T")


class RetryConfig(BaseModel):
    """Configuration for job retry behavior."""
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    max_attempts: int = Field(default=3, ge=1)
    base_delay_ms: int = Field(default=1000, ge=0)
    max_delay_ms: int = Field(default=60000, ge=0)
    jitter: bool = True
    custom_delays_ms: Optional[List[int]] = None

    @field_validator("custom_delays_ms")
    @classmethod
    def validate_custom_delays(cls, v, info):
        if info.data.get("strategy") == RetryStrategy.CUSTOM and not v:
            raise ValueError("custom_delays_ms required for custom strategy")
        return v


class JobPayload(BaseModel, Generic[T]):
    """Generic job payload wrapper with versioning."""
    version: int = 1
    data: T
    metadata: Dict[str, Any] = Field(default_factory=dict)


PayloadT = TypeVar("PayloadT", bound=BaseModel)


class TypedJob(BaseModel, Generic[PayloadT]):
    """Type-safe job model with generic payload."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    payload: PayloadT
    priority: Priority = Priority.NORMAL
    status: JobStatus = JobStatus.PENDING
    
    scheduled_at: Optional[datetime] = None
    delay_ms: int = 0
    cron_expression: Optional[str] = None
    timezone: str = "UTC"
    depends_on: List[str] = Field(default_factory=list)
    dependent_jobs: List[str] = Field(default_factory=list)
    retry_config: "RetryConfig" = Field(default_factory=lambda: RetryConfig())
    attempt: int = 0
    last_error: Optional[str] = None
    unique_key: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    worker_id: Optional[str] = None
    on_success: Optional[str] = None
    on_failure: Optional[str] = None
    
    model_config = {"use_enum_values": True}


class Job(BaseModel):
    """Core job model representing a task in the queue."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    payload: Dict[str, Any]
    priority: Priority = Priority.NORMAL
    status: JobStatus = JobStatus.PENDING
    
    # Scheduling
    scheduled_at: Optional[datetime] = None
    delay_ms: int = 0
    cron_expression: Optional[str] = None
    timezone: str = "UTC"
    
    # Dependencies
    depends_on: List[str] = Field(default_factory=list)
    dependent_jobs: List[str] = Field(default_factory=list)
    
    # Retry configuration
    retry_config: RetryConfig = Field(default_factory=RetryConfig)
    attempt: int = 0
    last_error: Optional[str] = None
    
    # Uniqueness
    unique_key: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Worker assignment
    worker_id: Optional[str] = None
    
    # Callbacks
    on_success: Optional[str] = None
    on_failure: Optional[str] = None
    
    class Config:
        use_enum_values = True


class JobResult(BaseModel):
    """Result of job execution."""
    job_id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: float = 0
    completed_at: datetime = Field(default_factory=datetime.utcnow)


class WorkerInfo(BaseModel):
    """Worker node information."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    host: str
    port: int
    status: str = "active"
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)
    current_jobs: List[str] = Field(default_factory=list)
    max_concurrent_jobs: int = 10
    processed_count: int = 0
    failed_count: int = 0
    is_leader: bool = False


class QueueStats(BaseModel):
    """Queue statistics for monitoring."""
    total_jobs: int = 0
    pending_jobs: int = 0
    running_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    dead_jobs: int = 0
    jobs_by_priority: Dict[str, int] = Field(default_factory=dict)
    avg_processing_time_ms: float = 0
    throughput_per_second: float = 0
