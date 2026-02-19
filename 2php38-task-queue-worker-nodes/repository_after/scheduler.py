"""Scheduler for delayed and recurring job execution."""
from __future__ import annotations

import hashlib
import heapq
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional, Set
from zoneinfo import ZoneInfo

from .models import Job, JobStatus


class CronExpression:
    """Parser for cron-like expressions."""
    
    def __init__(self, expression: str):
        self.expression = expression
        self._parts = self._parse(expression)
    
    def _parse(self, expr: str) -> Dict[str, Set[int]]:
        parts = expr.strip().split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {expr}")
        
        return {
            "minute": self._parse_field(parts[0], 0, 59),
            "hour": self._parse_field(parts[1], 0, 23),
            "day": self._parse_field(parts[2], 1, 31),
            "month": self._parse_field(parts[3], 1, 12),
            "weekday": self._parse_field(parts[4], 0, 6),
        }
    
    def _parse_field(self, field: str, min_val: int, max_val: int) -> Set[int]:
        if field == "*":
            return set(range(min_val, max_val + 1))
        
        values = set()
        for part in field.split(","):
            if "/" in part:
                base, step = part.split("/")
                step = int(step)
                if base == "*":
                    values.update(range(min_val, max_val + 1, step))
                else:
                    start = int(base)
                    values.update(range(start, max_val + 1, step))
            elif "-" in part:
                start, end = map(int, part.split("-"))
                values.update(range(start, end + 1))
            else:
                values.add(int(part))
        
        return values
    
    def matches(self, dt: datetime) -> bool:
        """Check if datetime matches the cron expression."""
        return (
            dt.minute in self._parts["minute"]
            and dt.hour in self._parts["hour"]
            and dt.day in self._parts["day"]
            and dt.month in self._parts["month"]
            and dt.weekday() in self._parts["weekday"]
        )
    
    def next_run(self, after: datetime) -> datetime:
        """Calculate next run time after the given datetime."""
        dt = after.replace(second=0, microsecond=0) + timedelta(minutes=1)
        
        for _ in range(366 * 24 * 60):
            if self.matches(dt):
                return dt
            dt += timedelta(minutes=1)
        
        raise ValueError("Could not find next run time within a year")


@dataclass(order=True)
class ScheduledItem:
    """Item in the scheduler's priority queue."""
    run_at: float
    job_id: str = field(compare=False)
    is_recurring: bool = field(compare=False, default=False)


class DelayedJobScheduler:
    """Scheduler for delayed job execution with millisecond precision."""
    
    def __init__(self):
        self._heap: List[ScheduledItem] = []
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.RLock()
        self._unique_keys: Dict[str, str] = {}
    
    def schedule(self, job: Job, delay_ms: int = 0) -> bool:
        """Schedule a job for delayed execution."""
        with self._lock:
            if job.unique_key:
                if job.unique_key in self._unique_keys:
                    return False
                self._unique_keys[job.unique_key] = job.id
            
            run_at = time.time() + (delay_ms / 1000)
            
            if job.scheduled_at:
                run_at = job.scheduled_at.timestamp()
            elif job.delay_ms > 0:
                run_at = time.time() + (job.delay_ms / 1000)
            
            item = ScheduledItem(run_at=run_at, job_id=job.id)
            heapq.heappush(self._heap, item)
            self._jobs[job.id] = job
            job.status = JobStatus.SCHEDULED
            return True
    
    def get_due_jobs(self) -> List[Job]:
        """Get all jobs that are due for execution."""
        now = time.time()
        due = []
        
        with self._lock:
            while self._heap and self._heap[0].run_at <= now:
                item = heapq.heappop(self._heap)
                job = self._jobs.pop(item.job_id, None)
                if job:
                    if job.unique_key and job.unique_key in self._unique_keys:
                        del self._unique_keys[job.unique_key]
                    due.append(job)
        
        return due
    
    def cancel(self, job_id: str) -> Optional[Job]:
        """Cancel a scheduled job."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
            if job:
                if job.unique_key and job.unique_key in self._unique_keys:
                    del self._unique_keys[job.unique_key]
                self._heap = [item for item in self._heap if item.job_id != job_id]
                heapq.heapify(self._heap)
            return job
    
    def reschedule(self, job_id: str, new_delay_ms: int) -> bool:
        """Reschedule a job with a new delay."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            
            self._heap = [item for item in self._heap if item.job_id != job_id]
            heapq.heapify(self._heap)
            
            run_at = time.time() + (new_delay_ms / 1000)
            item = ScheduledItem(run_at=run_at, job_id=job_id)
            heapq.heappush(self._heap, item)
            return True
    
    def get_scheduled_count(self) -> int:
        with self._lock:
            return len(self._jobs)
    
    def get_next_due_time(self) -> Optional[float]:
        with self._lock:
            if self._heap:
                return self._heap[0].run_at
            return None
    
    def is_unique_key_used(self, key: str) -> bool:
        with self._lock:
            return key in self._unique_keys


class RecurringJobScheduler:
    """Scheduler for cron-like recurring jobs."""
    
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._cron_expressions: Dict[str, CronExpression] = {}
        self._next_runs: Dict[str, datetime] = {}
        self._timezones: Dict[str, ZoneInfo] = {}
        self._lock = threading.RLock()
    
    def register(self, job: Job) -> bool:
        """Register a recurring job with cron expression."""
        if not job.cron_expression:
            return False
        
        with self._lock:
            try:
                cron = CronExpression(job.cron_expression)
            except ValueError:
                return False
            
            tz = ZoneInfo(job.timezone) if job.timezone else ZoneInfo("UTC")
            now = datetime.now(tz)
            next_run = cron.next_run(now)
            
            self._jobs[job.id] = job
            self._cron_expressions[job.id] = cron
            self._next_runs[job.id] = next_run
            self._timezones[job.id] = tz
            return True
    
    def unregister(self, job_id: str) -> Optional[Job]:
        """Unregister a recurring job."""
        with self._lock:
            job = self._jobs.pop(job_id, None)
            self._cron_expressions.pop(job_id, None)
            self._next_runs.pop(job_id, None)
            self._timezones.pop(job_id, None)
            return job
    
    def get_due_jobs(self) -> List[Job]:
        """Get recurring jobs that are due for execution."""
        due = []
        
        with self._lock:
            for job_id, next_run in list(self._next_runs.items()):
                tz = self._timezones.get(job_id, ZoneInfo("UTC"))
                now = datetime.now(tz)
                
                if next_run <= now:
                    job = self._jobs.get(job_id)
                    if job:
                        due.append(job)
                        cron = self._cron_expressions[job_id]
                        self._next_runs[job_id] = cron.next_run(now)
        
        return due
    
    def get_next_run(self, job_id: str) -> Optional[datetime]:
        with self._lock:
            return self._next_runs.get(job_id)
    
    def get_registered_count(self) -> int:
        with self._lock:
            return len(self._jobs)


class BulkJobSubmitter:
    """Handles bulk job submission with transactional semantics."""
    
    def __init__(
        self,
        delayed_scheduler: DelayedJobScheduler,
        on_submit: Optional[Callable[[Job], None]] = None,
    ):
        self._scheduler = delayed_scheduler
        self._on_submit = on_submit
    
    def submit_batch(
        self,
        jobs: List[Job],
        atomic: bool = True,
    ) -> tuple[List[str], List[tuple[str, str]]]:
        """Submit multiple jobs with optional atomic semantics."""
        if atomic:
            return self._submit_atomic(jobs)
        else:
            return self._submit_best_effort(jobs)
    
    def _submit_atomic(self, jobs: List[Job]) -> tuple[List[str], List[tuple[str, str]]]:
        """Submit all jobs or none (transactional)."""
        for job in jobs:
            if job.unique_key and self._scheduler.is_unique_key_used(job.unique_key):
                return [], [(j.id, "Duplicate unique key in batch" if j.unique_key == job.unique_key else "Batch rolled back") for j in jobs]
        
        successful = []
        for job in jobs:
            if self._scheduler.schedule(job):
                successful.append(job.id)
                if self._on_submit:
                    self._on_submit(job)
            else:
                for sid in successful:
                    self._scheduler.cancel(sid)
                return [], [(j.id, "Batch submission failed") for j in jobs]
        
        return successful, []
    
    def _submit_best_effort(self, jobs: List[Job]) -> tuple[List[str], List[tuple[str, str]]]:
        """Submit as many jobs as possible."""
        successful = []
        failed = []
        
        for job in jobs:
            if self._scheduler.schedule(job):
                successful.append(job.id)
                if self._on_submit:
                    self._on_submit(job)
            else:
                failed.append((job.id, "Failed to schedule job"))
        
        return successful, failed


class UniquenessConstraint:
    """Manages job uniqueness constraints."""
    
    def __init__(self):
        self._keys: Dict[str, str] = {}
        self._lock = threading.RLock()
    
    def generate_key(self, job: Job) -> str:
        """Generate a unique key for a job based on its properties."""
        key_data = f"{job.name}:{job.payload}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]
    
    def acquire(self, key: str, job_id: str) -> bool:
        """Try to acquire a uniqueness constraint."""
        with self._lock:
            if key in self._keys:
                return False
            self._keys[key] = job_id
            return True
    
    def release(self, key: str) -> bool:
        """Release a uniqueness constraint."""
        with self._lock:
            if key in self._keys:
                del self._keys[key]
                return True
            return False
    
    def is_held(self, key: str) -> bool:
        """Check if a uniqueness constraint is held."""
        with self._lock:
            return key in self._keys
    
    def get_holder(self, key: str) -> Optional[str]:
        """Get the job ID holding a uniqueness constraint."""
        with self._lock:
            return self._keys.get(key)
