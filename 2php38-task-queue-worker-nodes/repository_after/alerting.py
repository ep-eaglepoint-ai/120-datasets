"""Alerting and failure notification callbacks."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from .logging_config import get_logger
from .models import Job, Priority

logger = get_logger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    severity: AlertSeverity
    title: str
    message: str
    job_id: Optional[str] = None
    job_name: Optional[str] = None
    worker_id: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


class AlertHandler(ABC):
    """Abstract base class for alert handlers."""
    
    @abstractmethod
    async def send(self, alert: Alert) -> bool:
        """Send an alert. Returns True if successful."""
        pass


class LogAlertHandler(AlertHandler):
    """Alert handler that logs to structlog."""
    
    async def send(self, alert: Alert) -> bool:
        """Log the alert."""
        log_method = {
            AlertSeverity.INFO: logger.info,
            AlertSeverity.WARNING: logger.warning,
            AlertSeverity.ERROR: logger.error,
            AlertSeverity.CRITICAL: logger.critical,
        }.get(alert.severity, logger.error)
        
        log_method(
            "alert",
            alert_id=alert.id,
            severity=alert.severity.value,
            title=alert.title,
            message=alert.message,
            job_id=alert.job_id,
            worker_id=alert.worker_id,
            error=alert.error,
        )
        return True


class WebhookAlertHandler(AlertHandler):
    """Alert handler that sends to a webhook URL."""
    
    def __init__(self, webhook_url: str, headers: Optional[Dict[str, str]] = None):
        self._webhook_url = webhook_url
        self._headers = headers or {"Content-Type": "application/json"}
    
    async def send(self, alert: Alert) -> bool:
        """Send alert to webhook."""
        try:
            import httpx
            
            payload = {
                "id": alert.id,
                "severity": alert.severity.value,
                "title": alert.title,
                "message": alert.message,
                "job_id": alert.job_id,
                "job_name": alert.job_name,
                "worker_id": alert.worker_id,
                "error": alert.error,
                "timestamp": alert.timestamp.isoformat(),
                "metadata": alert.metadata,
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._webhook_url,
                    json=payload,
                    headers=self._headers,
                    timeout=10.0,
                )
                
                if response.status_code < 300:
                    logger.debug("webhook_alert_sent", alert_id=alert.id)
                    return True
                else:
                    logger.warning(
                        "webhook_alert_failed",
                        alert_id=alert.id,
                        status_code=response.status_code,
                    )
                    return False
                    
        except Exception as e:
            logger.error("webhook_alert_error", alert_id=alert.id, error=str(e))
            return False


class CallbackAlertHandler(AlertHandler):
    """Alert handler that calls a user-provided callback."""
    
    def __init__(self, callback: Callable[[Alert], Union[bool, Any]]):
        self._callback = callback
    
    async def send(self, alert: Alert) -> bool:
        """Call the callback with the alert."""
        try:
            if asyncio.iscoroutinefunction(self._callback):
                result = await self._callback(alert)
            else:
                result = self._callback(alert)
            return bool(result) if result is not None else True
        except Exception as e:
            logger.error("callback_alert_error", alert_id=alert.id, error=str(e))
            return False


class AlertManager:
    """Manages alert handlers and dispatches alerts."""
    
    def __init__(self):
        self._handlers: List[AlertHandler] = []
        self._alert_count = 0
        self._default_handler = LogAlertHandler()
    
    def add_handler(self, handler: AlertHandler):
        """Add an alert handler."""
        self._handlers.append(handler)
        logger.info("alert_handler_added", handler_type=type(handler).__name__)
    
    def remove_handler(self, handler: AlertHandler):
        """Remove an alert handler."""
        if handler in self._handlers:
            self._handlers.remove(handler)
    
    async def send_alert(
        self,
        severity: AlertSeverity,
        title: str,
        message: str,
        job: Optional[Job] = None,
        worker_id: Optional[str] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create and send an alert to all handlers."""
        import uuid
        
        self._alert_count += 1
        alert_id = f"alert-{uuid.uuid4().hex[:8]}"
        
        alert = Alert(
            id=alert_id,
            severity=severity,
            title=title,
            message=message,
            job_id=job.id if job else None,
            job_name=job.name if job else None,
            worker_id=worker_id,
            error=error,
            metadata=metadata or {},
        )
        
        handlers = self._handlers if self._handlers else [self._default_handler]
        
        tasks = [handler.send(alert) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        return alert_id
    
    async def alert_job_failed(
        self,
        job: Job,
        error: str,
        will_retry: bool = False,
    ):
        """Send alert for job failure."""
        severity = AlertSeverity.WARNING if will_retry else AlertSeverity.ERROR
        
        await self.send_alert(
            severity=severity,
            title=f"Job Failed: {job.name}",
            message=f"Job {job.id} failed after attempt {job.attempt}",
            job=job,
            error=error,
            metadata={"will_retry": will_retry, "attempt": job.attempt},
        )
    
    async def alert_job_dead_lettered(self, job: Job, error: str):
        """Send alert for job sent to DLQ."""
        await self.send_alert(
            severity=AlertSeverity.ERROR,
            title=f"Job Dead-Lettered: {job.name}",
            message=f"Job {job.id} exhausted all retries and was sent to DLQ",
            job=job,
            error=error,
            metadata={"final_attempt": job.attempt},
        )
    
    async def alert_worker_unhealthy(self, worker_id: str, reason: str):
        """Send alert for unhealthy worker."""
        await self.send_alert(
            severity=AlertSeverity.WARNING,
            title=f"Worker Unhealthy: {worker_id}",
            message=reason,
            worker_id=worker_id,
        )
    
    async def alert_worker_dead(self, worker_id: str, jobs_affected: int):
        """Send alert for dead worker."""
        await self.send_alert(
            severity=AlertSeverity.CRITICAL,
            title=f"Worker Dead: {worker_id}",
            message=f"Worker {worker_id} is unresponsive. {jobs_affected} jobs may need reassignment.",
            worker_id=worker_id,
            metadata={"jobs_affected": jobs_affected},
        )
    
    async def alert_queue_depth_high(self, priority: Priority, depth: int, threshold: int):
        """Send alert for high queue depth."""
        await self.send_alert(
            severity=AlertSeverity.WARNING,
            title=f"High Queue Depth: {priority.name}",
            message=f"Queue depth for {priority.name} is {depth}, exceeding threshold of {threshold}",
            metadata={"priority": priority.name, "depth": depth, "threshold": threshold},
        )
    
    async def alert_throughput_degraded(
        self, 
        current_throughput: float, 
        expected_throughput: float,
    ):
        """Send alert for degraded throughput."""
        await self.send_alert(
            severity=AlertSeverity.WARNING,
            title="Throughput Degraded",
            message=f"Current throughput {current_throughput:.2f}/s is below expected {expected_throughput:.2f}/s",
            metadata={
                "current_throughput": current_throughput,
                "expected_throughput": expected_throughput,
            },
        )


_alert_manager: Optional[AlertManager] = None


def get_alert_manager() -> AlertManager:
    """Get global alert manager instance."""
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
    return _alert_manager
