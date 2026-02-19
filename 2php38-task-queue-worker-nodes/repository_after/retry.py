"""Sophisticated retry mechanism with multiple strategies."""
from __future__ import annotations

import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from .models import Job, JobStatus, RetryConfig, RetryStrategy


class RetryStrategyHandler(ABC):
    """Abstract base class for retry strategies."""
    
    @abstractmethod
    def get_delay_ms(self, attempt: int, config: RetryConfig) -> int:
        """Calculate delay in milliseconds for the given attempt."""
        pass
    
    @abstractmethod
    def should_retry(self, attempt: int, config: RetryConfig) -> bool:
        """Determine if another retry should be attempted."""
        pass


class FixedDelayStrategy(RetryStrategyHandler):
    """Fixed delay between retry attempts."""
    
    def get_delay_ms(self, attempt: int, config: RetryConfig) -> int:
        delay = config.base_delay_ms
        if config.jitter:
            jitter = random.uniform(-0.1, 0.1) * delay
            delay = int(delay + jitter)
        return max(0, min(delay, config.max_delay_ms))
    
    def should_retry(self, attempt: int, config: RetryConfig) -> bool:
        return attempt < config.max_attempts


class ExponentialBackoffStrategy(RetryStrategyHandler):
    """Exponential backoff with optional jitter."""
    
    def get_delay_ms(self, attempt: int, config: RetryConfig) -> int:
        delay = config.base_delay_ms * (2 ** (attempt - 1))
        
        if config.jitter:
            jitter = random.uniform(0, 0.5) * delay
            delay = int(delay + jitter)
        
        return min(delay, config.max_delay_ms)
    
    def should_retry(self, attempt: int, config: RetryConfig) -> bool:
        return attempt < config.max_attempts


class CustomScheduleStrategy(RetryStrategyHandler):
    """Custom retry schedule with predefined delays."""
    
    def get_delay_ms(self, attempt: int, config: RetryConfig) -> int:
        if not config.custom_delays_ms:
            return config.base_delay_ms
        
        idx = min(attempt - 1, len(config.custom_delays_ms) - 1)
        delay = config.custom_delays_ms[idx]
        
        if config.jitter:
            jitter = random.uniform(-0.1, 0.1) * delay
            delay = int(delay + jitter)
        
        return max(0, min(delay, config.max_delay_ms))
    
    def should_retry(self, attempt: int, config: RetryConfig) -> bool:
        if config.custom_delays_ms:
            return attempt <= len(config.custom_delays_ms)
        return attempt < config.max_attempts


class RetryStrategyFactory:
    """Factory for creating retry strategy handlers."""
    
    _strategies: Dict[RetryStrategy, type] = {
        RetryStrategy.FIXED: FixedDelayStrategy,
        RetryStrategy.EXPONENTIAL: ExponentialBackoffStrategy,
        RetryStrategy.CUSTOM: CustomScheduleStrategy,
    }
    
    @classmethod
    def create(cls, strategy: RetryStrategy) -> RetryStrategyHandler:
        handler_cls = cls._strategies.get(strategy)
        if not handler_cls:
            raise ValueError(f"Unknown retry strategy: {strategy}")
        return handler_cls()
    
    @classmethod
    def register(cls, strategy: RetryStrategy, handler_cls: type):
        cls._strategies[strategy] = handler_cls


@dataclass
class RetryDecision:
    """Decision about whether and how to retry a job."""
    should_retry: bool
    delay_ms: int = 0
    send_to_dlq: bool = False
    reason: str = ""


class RetryManager:
    """Manages job retry logic and dead-letter queue routing."""
    
    def __init__(
        self,
        on_retry: Optional[Callable[[Job, int, int], None]] = None,
        on_dlq: Optional[Callable[[Job, str], None]] = None,
        on_failure: Optional[Callable[[Job, str], None]] = None,
    ):
        self._on_retry = on_retry
        self._on_dlq = on_dlq
        self._on_failure = on_failure
        self._dlq: List[Job] = []
    
    def evaluate(self, job: Job, error: str) -> RetryDecision:
        """Evaluate if job should be retried based on its configuration."""
        config = job.retry_config
        strategy = RetryStrategyFactory.create(RetryStrategy(config.strategy))
        
        next_attempt = job.attempt + 1
        
        if strategy.should_retry(next_attempt, config):
            delay_ms = strategy.get_delay_ms(next_attempt, config)
            return RetryDecision(
                should_retry=True,
                delay_ms=delay_ms,
                send_to_dlq=False,
                reason=f"Retry attempt {next_attempt}/{config.max_attempts}",
            )
        else:
            return RetryDecision(
                should_retry=False,
                delay_ms=0,
                send_to_dlq=True,
                reason=f"Max attempts ({config.max_attempts}) exhausted",
            )
    
    def handle_failure(self, job: Job, error: str) -> RetryDecision:
        """Handle job failure with retry or DLQ routing."""
        decision = self.evaluate(job, error)
        
        job.last_error = error
        
        if decision.should_retry:
            job.status = JobStatus.RETRYING
            job.attempt += 1
            
            if self._on_retry:
                self._on_retry(job, job.attempt, decision.delay_ms)
        
        elif decision.send_to_dlq:
            job.status = JobStatus.DEAD
            self._dlq.append(job)
            
            if self._on_dlq:
                self._on_dlq(job, decision.reason)
            
            if self._on_failure:
                self._on_failure(job, error)
        
        return decision
    
    def get_dlq(self) -> List[Job]:
        """Get all jobs in the dead-letter queue."""
        return self._dlq.copy()
    
    def get_dlq_size(self) -> int:
        """Get count of jobs in dead-letter queue."""
        return len(self._dlq)
    
    def remove_from_dlq(self, job_id: str) -> Optional[Job]:
        """Remove and return a job from the dead-letter queue."""
        for i, job in enumerate(self._dlq):
            if job.id == job_id:
                return self._dlq.pop(i)
        return None
    
    def requeue_from_dlq(self, job_id: str, reset_attempts: bool = True) -> Optional[Job]:
        """Remove job from DLQ and prepare for requeue."""
        job = self.remove_from_dlq(job_id)
        if job:
            if reset_attempts:
                job.attempt = 0
            job.status = JobStatus.PENDING
            job.last_error = None
        return job
    
    def clear_dlq(self) -> int:
        """Clear all jobs from the dead-letter queue."""
        count = len(self._dlq)
        self._dlq.clear()
        return count


class RetryScheduler:
    """Schedules retry attempts with proper timing."""
    
    def __init__(self, retry_manager: RetryManager):
        self._retry_manager = retry_manager
        self._scheduled_retries: Dict[str, float] = {}
    
    def schedule_retry(self, job: Job, delay_ms: int) -> float:
        """Schedule a retry and return the scheduled timestamp."""
        retry_time = time.time() + (delay_ms / 1000)
        self._scheduled_retries[job.id] = retry_time
        return retry_time
    
    def get_due_retries(self) -> List[str]:
        """Get job IDs with retries that are due."""
        now = time.time()
        due = [jid for jid, ts in self._scheduled_retries.items() if ts <= now]
        return due
    
    def pop_retry(self, job_id: str) -> Optional[float]:
        """Remove and return scheduled retry time for job."""
        return self._scheduled_retries.pop(job_id, None)
    
    def cancel_retry(self, job_id: str) -> bool:
        """Cancel a scheduled retry."""
        if job_id in self._scheduled_retries:
            del self._scheduled_retries[job_id]
            return True
        return False
    
    def get_pending_retry_count(self) -> int:
        """Get count of pending retries."""
        return len(self._scheduled_retries)
