"""Distributed Task Queue System.

A high-performance distributed task queue with intelligent priority scheduling,
automatic retry mechanisms, and comprehensive job lifecycle management.

Uses Redis Streams for reliable message delivery, structlog for structured logging,
and Prometheus client for metrics exposition.
"""
from .client import AsyncTaskQueue, TaskQueue
from .dependencies import CircularDependencyError, DependencyGraph, DependencyResolver
from .models import (
    Job,
    JobPayload,
    JobResult,
    JobStatus,
    Priority,
    QueueStats,
    RetryConfig,
    RetryStrategy,
    TypedJob,
    WorkerInfo,
)
from .retry import (
    ExponentialBackoffStrategy,
    FixedDelayStrategy,
    RetryDecision,
    RetryManager,
    RetryScheduler,
    RetryStrategyFactory,
    RetryStrategyHandler,
)
from .scheduler import (
    BulkJobSubmitter,
    CronExpression,
    DelayedJobScheduler,
    RecurringJobScheduler,
    UniquenessConstraint,
)
from .serialization import (
    CompressedSerializer,
    JSONSerializer,
    MessagePackSerializer,
    PayloadEncoder,
    PickleSerializer,
    SerializationFormat,
    Serializer,
    SerializerFactory,
)
from .worker import (
    DistributedLock,
    GracefulShutdown,
    LeaderElection,
    WorkerNode,
    WorkerProcess,
    WorkerRegistry,
    WorkStealing,
)

from .redis_backend import (
    RedisConfig,
    RedisConnection,
    RedisStreamsQueue,
    RedisDistributedLock,
    RedisLeaderElection,
)
from .logging_config import (
    configure_logging,
    get_logger,
    bind_context,
    clear_context,
)
from .prometheus_metrics import (
    TaskQueuePrometheusMetrics,
    get_metrics,
)
from .multiprocess_worker import (
    MultiprocessWorkerPool,
    AsyncWorkerPool,
    HybridWorkerPool,
)
from .alerting import (
    Alert,
    AlertSeverity,
    AlertHandler,
    AlertManager,
    LogAlertHandler,
    WebhookAlertHandler,
    CallbackAlertHandler,
    get_alert_manager,
)

__version__ = "1.0.0"
__all__ = [
    # Client
    "TaskQueue",
    "AsyncTaskQueue",
    # Models
    "Job",
    "JobPayload",
    "JobResult",
    "JobStatus",
    "Priority",
    "QueueStats",
    "RetryConfig",
    "RetryStrategy",
    "WorkerInfo",
    "TypedJob",
    # Dependencies
    "DependencyGraph",
    "DependencyResolver",
    "CircularDependencyError",
    # Retry
    "RetryManager",
    "RetryScheduler",
    "RetryDecision",
    "RetryStrategyHandler",
    "RetryStrategyFactory",
    "FixedDelayStrategy",
    "ExponentialBackoffStrategy",
    # Scheduler
    "DelayedJobScheduler",
    "RecurringJobScheduler",
    "BulkJobSubmitter",
    "CronExpression",
    "UniquenessConstraint",
    # Worker
    "WorkerProcess",
    "WorkerNode",
    "WorkerRegistry",
    "WorkStealing",
    "GracefulShutdown",
    "LeaderElection",
    "DistributedLock",
    # Serialization
    "Serializer",
    "SerializerFactory",
    "SerializationFormat",
    "JSONSerializer",
    "MessagePackSerializer",
    "PickleSerializer",
    "CompressedSerializer",
    "PayloadEncoder",
    # Redis Backend (distributed queue)
    "RedisConfig",
    "RedisConnection",
    "RedisStreamsQueue",
    "RedisDistributedLock",
    "RedisLeaderElection",
    # Logging (structlog)
    "configure_logging",
    "get_logger",
    "bind_context",
    "clear_context",
    # Prometheus Metrics (official client)
    "TaskQueuePrometheusMetrics",
    "get_metrics",
    # Multiprocessing Workers
    "MultiprocessWorkerPool",
    "AsyncWorkerPool",
    "HybridWorkerPool",
    # Alerting
    "Alert",
    "AlertSeverity",
    "AlertHandler",
    "AlertManager",
    "LogAlertHandler",
    "WebhookAlertHandler",
    "CallbackAlertHandler",
    "get_alert_manager",
]
