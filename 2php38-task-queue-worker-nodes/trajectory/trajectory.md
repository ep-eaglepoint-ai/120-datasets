# Trajectory - Distributed Task Queue Worker Nodes

## Analysis

The task requires implementing a high-performance distributed task queue system in Python 3.11+ with the following core components:

1. **Multi-level Priority Queue** (5 levels: critical, high, normal, low, batch) with fair scheduling, configurable weights, and dynamic priority adjustment
2. **Dependency Management** with topological sorting, circular dependency detection, and automatic triggering of dependent jobs
3. **Worker Management** with registration, heartbeat monitoring, work stealing for load balancing, graceful shutdown with job reassignment, and Redis-based leader election
4. **Retry Mechanism** with fixed delay, exponential backoff with jitter, custom schedules, max attempt limits, and dead-letter queue routing
5. **Scheduler** supporting delayed execution with millisecond precision, cron-like recurring jobs with timezone support, uniqueness constraints, and bulk submission with transactional semantics
6. **Observability** with Prometheus metrics (queue depth gauges, latency histograms, worker utilization, throughput counters) and REST API for job inspection
7. **Serialization** supporting JSON, MessagePack, and pickle with compression options, type-safe job definitions using Python generics and Pydantic, and job versioning

Technology stack specified: Python 3.11+, asyncio, Redis with Redis Streams, multiprocessing, Pydantic, structlog, prometheus-client, pip-installable library with CLI.

## Strategy

1. **Models Layer** (`models.py`): Define Pydantic models for Job, JobResult, Priority enum (5 levels), JobStatus, RetryConfig, RetryStrategy, WorkerInfo, QueueStats, TypedJob with generics
2. **Redis Backend** (`redis_backend.py`): Implement RedisStreamsQueue for priority-based message delivery, RedisDistributedLock for coordination, RedisLeaderElection for worker coordination
3. **Dependency Management** (`dependencies.py`): DependencyGraph with topological sorting using Kahn's algorithm, circular dependency detection via DFS, DependencyResolver for batch operations
4. **Retry System** (`retry.py`): Strategy pattern with FixedDelayStrategy, ExponentialBackoffStrategy, CustomScheduleStrategy; RetryManager for DLQ routing; RetryScheduler for timing
5. **Scheduler** (`scheduler.py`): DelayedJobScheduler using heap for millisecond precision, RecurringJobScheduler with CronExpression parser, BulkJobSubmitter with atomic/best-effort modes, UniquenessConstraint
6. **Worker System** (`worker.py`): WorkerNode, WorkerRegistry with heartbeat monitoring, WorkStealing for load balancing, GracefulShutdown with job reassignment, LeaderElection
7. **Multiprocessing** (`multiprocess_worker.py`): MultiprocessWorkerPool for CPU-bound tasks, AsyncWorkerPool for I/O-bound, HybridWorkerPool combining both
8. **Observability** (`prometheus_metrics.py`): TaskQueuePrometheusMetrics using official prometheus-client with counters, gauges, histograms
9. **API** (`api.py`): FastAPI REST API for job submission, inspection, stats, metrics endpoint
10. **Serialization** (`serialization.py`): Pluggable serializers (JSON, MessagePack, Pickle), CompressedSerializer wrapper, PayloadEncoder with versioning
11. **Client** (`client.py`): Main TaskQueue interface combining all components
12. **CLI** (`cli.py`): Command-line interface for worker management
13. **Alerting** (`alerting.py`): AlertManager with handlers for logging, webhooks, callbacks

## Execution

The implementation is complete with all components in `repository_after/`:

- `models.py`: 5 priority levels (CRITICAL=0 to BATCH=4), Job/JobResult/WorkerInfo Pydantic models, TypedJob[PayloadT] generic
- `redis_backend.py`: RedisStreamsQueue using XADD/XREADGROUP/XACK, RedisDistributedLock with Lua scripts for atomic operations, RedisLeaderElection
- `dependencies.py`: DependencyGraph with topological_sort(), detect_cycle(), mark_completed() triggering dependents
- `retry.py`: Three strategies with get_delay_ms() and should_retry(), RetryManager routing to DLQ after max_attempts
- `scheduler.py`: DelayedJobScheduler with heap-based scheduling, CronExpression parser supporting */N, ranges, lists; BulkJobSubmitter with atomic rollback
- `worker.py`: WorkerRegistry with heartbeat timeout detection, WorkStealing finding overloaded/underloaded workers, GracefulShutdown with job reassignment callback
- `multiprocess_worker.py`: MultiprocessWorkerPool using concurrent.futures, AsyncWorkerPool with asyncio, HybridWorkerPool combining both
- `prometheus_metrics.py`: All required metrics (jobs_submitted_total, jobs_completed_total, queue_depth, job_processing_duration_seconds, etc.)
- `api.py`: FastAPI endpoints POST /jobs, GET /jobs/{id}, DELETE /jobs/{id}, PUT /jobs/{id}/priority, GET /stats, GET /workers, GET /dlq, GET /metrics, GET /health
- `serialization.py`: JSONSerializer, MessagePackSerializer, PickleSerializer, CompressedSerializer with gzip, PayloadEncoder with version migration
- `client.py`: TaskQueue orchestrating all components with submit(), get_job(), complete_job(), update_priority(), cancel_job(), get_stats()
- `alerting.py`: AlertManager with LogAlertHandler, WebhookAlertHandler, CallbackAlertHandler for failure notifications

Tests in `tests/test_task_queue.py` cover all 7 requirements with dedicated test classes, plus integration tests, edge cases, and concurrency tests.

## Resources

- `repository_after/models.py` - Pydantic models with Priority enum and TypedJob generic
- `repository_after/redis_backend.py` - Redis Streams queue and distributed locking
- `repository_after/dependencies.py` - Topological sorting and cycle detection
- `repository_after/retry.py` - Retry strategies and dead-letter queue
- `repository_after/scheduler.py` - Delayed/recurring job scheduling
- `repository_after/worker.py` - Worker management and work stealing
- `repository_after/multiprocess_worker.py` - Multiprocessing worker pools
- `repository_after/prometheus_metrics.py` - Prometheus metrics
- `repository_after/api.py` - FastAPI REST API
- `repository_after/serialization.py` - Pluggable serialization
- `repository_after/client.py` - Main TaskQueue interface
- `repository_after/alerting.py` - Failure alerting
- `tests/test_task_queue.py` - Comprehensive test suite
