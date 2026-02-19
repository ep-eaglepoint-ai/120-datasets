from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, List
from datetime import datetime
import uuid


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    DEAD = "dead"  # moved to dead letter queue


class Priority(Enum):
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass
class Task:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    payload: dict = field(default_factory=dict)
    priority: Priority = Priority.NORMAL
    status: TaskStatus = TaskStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 300
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Any = None
    error: Optional[str] = None
    retry_history: List[dict] = field(default_factory=list)


@dataclass
class DeadLetterEntry:
    task: Task
    reason: str
    moved_at: datetime = field(default_factory=datetime.utcnow)
