from __future__ import annotations

from celery import Celery

from .config import settings


celery_app = Celery(
    "file_processor",
    broker=settings.resolved_broker_url(),
    backend=settings.resolved_backend_url(),
)

celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
    worker_max_tasks_per_child=10,
    task_always_eager=settings.celery_task_always_eager,
    task_soft_time_limit=settings.task_soft_time_limit_seconds,
    task_time_limit=settings.task_time_limit_seconds,
    worker_shutdown_timeout=settings.worker_shutdown_timeout_seconds,
)
