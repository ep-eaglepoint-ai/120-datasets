"""Tests for Redis integration, REST API, MessagePack, and new features."""
import os
import sys
import time
import asyncio
from datetime import datetime
from typing import Dict, Any
from unittest.mock import Mock, patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'repository_after'))

from repository_after import (
    Job,
    JobResult,
    JobStatus,
    Priority,
    TypedJob,
    RedisConfig,
    RedisConnection,
    RedisStreamsQueue,
    RedisDistributedLock,
    RedisLeaderElection,
    configure_logging,
    get_logger,
    TaskQueuePrometheusMetrics,
    get_metrics,
    MultiprocessWorkerPool,
    AsyncWorkerPool,
    HybridWorkerPool,
    Alert,
    AlertSeverity,
    AlertManager,
    LogAlertHandler,
    WebhookAlertHandler,
    CallbackAlertHandler,
    get_alert_manager,
    MessagePackSerializer,
    GracefulShutdown,
    WorkStealing,
    WorkerNode,
    WorkerRegistry,
)
from repository_after.models import WorkerInfo
from pydantic import BaseModel


class TestRedisIntegration:
    """Tests for Redis Streams integration."""
    
    def test_redis_config_defaults(self):
        """Test RedisConfig default values."""
        config = RedisConfig()
        assert config.host == "localhost"
        assert config.port == 6379
        assert config.db == 0
        assert config.decode_responses is True
    
    def test_redis_config_custom(self):
        """Test RedisConfig with custom values."""
        config = RedisConfig(
            host="redis.example.com",
            port=6380,
            db=1,
            password="secret",
        )
        assert config.host == "redis.example.com"
        assert config.port == 6380
        assert config.db == 1
        assert config.password == "secret"
    
    @pytest.mark.skipif(
        os.environ.get("REDIS_HOST") is None,
        reason="Redis not available"
    )
    def test_redis_connection(self):
        """Test Redis connection with actual server."""
        config = RedisConfig(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
        )
        conn = RedisConnection.get_connection(config)
        assert conn.ping()
        RedisConnection.close()
    
    @pytest.mark.skipif(
        os.environ.get("REDIS_HOST") is None,
        reason="Redis not available"
    )
    def test_redis_streams_enqueue_dequeue(self):
        """Test Redis Streams queue operations."""
        config = RedisConfig(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
        )
        RedisConnection.get_connection(config)
        
        queue = RedisStreamsQueue()
        
        job = Job(name="test_job", payload={"data": "test"}, priority=Priority.NORMAL)
        message_id = queue.enqueue(job)
        assert message_id is not None
        
        jobs = queue.dequeue(consumer_name="test_consumer", timeout_ms=1000)
        assert len(jobs) >= 1
        
        for msg_id, dequeued_job in jobs:
            queue.acknowledge(dequeued_job, msg_id)
        
        RedisConnection.close()
    
    @pytest.mark.skipif(
        os.environ.get("REDIS_HOST") is None,
        reason="Redis not available"
    )
    def test_redis_distributed_lock(self):
        """Test Redis-based distributed locking."""
        config = RedisConfig(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
        )
        RedisConnection.get_connection(config)
        
        lock = RedisDistributedLock()
        
        acquired = lock.acquire("test_lock", "owner1", ttl_seconds=10)
        assert acquired
        
        not_acquired = lock.acquire("test_lock", "owner2", ttl_seconds=10)
        assert not not_acquired
        
        released = lock.release("test_lock", "owner1")
        assert released
        
        acquired_by_2 = lock.acquire("test_lock", "owner2", ttl_seconds=10)
        assert acquired_by_2
        
        lock.release("test_lock", "owner2")
        RedisConnection.close()
    
    @pytest.mark.skipif(
        os.environ.get("REDIS_HOST") is None,
        reason="Redis not available"
    )
    def test_redis_leader_election(self):
        """Test Redis-based leader election."""
        config = RedisConfig(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
        )
        RedisConnection.get_connection(config)
        
        election1 = RedisLeaderElection("worker1", ttl_seconds=10)
        election2 = RedisLeaderElection("worker2", ttl_seconds=10)
        
        assert election1.try_become_leader()
        assert election1.is_leader
        
        assert not election2.try_become_leader()
        assert not election2.is_leader
        
        election1.resign()
        
        assert election2.try_become_leader()
        assert election2.is_leader
        
        election2.resign()
        RedisConnection.close()


class TestStructlog:
    """Tests for structlog integration."""
    
    def test_configure_logging(self):
        """Test logging configuration."""
        configure_logging(level="DEBUG", json_format=False)
        logger = get_logger(__name__)
        assert logger is not None
    
    def test_logger_methods(self):
        """Test logger methods work correctly."""
        logger = get_logger("test")
        
        logger.info("test_message", key="value")
        logger.debug("debug_message", data=123)
        logger.warning("warning_message")
        logger.error("error_message", error="test error")


class TestPrometheusMetrics:
    """Tests for Prometheus client metrics."""
    
    def test_metrics_creation(self):
        """Test metrics are created correctly."""
        from prometheus_client import REGISTRY, CollectorRegistry
        
        registry = CollectorRegistry()
        metrics = TaskQueuePrometheusMetrics(registry=registry)
        
        assert metrics.jobs_submitted is not None
        assert metrics.jobs_completed is not None
        assert metrics.jobs_failed is not None
        assert metrics.queue_depth is not None
        assert metrics.job_processing_duration is not None
    
    def test_record_job_submitted(self):
        """Test recording job submission."""
        from prometheus_client import CollectorRegistry
        
        registry = CollectorRegistry()
        metrics = TaskQueuePrometheusMetrics(registry=registry)
        
        metrics.record_job_submitted(Priority.NORMAL)
        metrics.record_job_submitted(Priority.CRITICAL)
        
        assert metrics.jobs_submitted.labels(priority="NORMAL")._value.get() == 1
        assert metrics.jobs_submitted.labels(priority="CRITICAL")._value.get() == 1
    
    def test_record_job_completed(self):
        """Test recording job completion with duration."""
        from prometheus_client import CollectorRegistry
        
        registry = CollectorRegistry()
        metrics = TaskQueuePrometheusMetrics(registry=registry)
        
        metrics.record_job_completed(0.5, priority="NORMAL", job_name="test_job", wait_seconds=0.1)
        
        assert metrics.jobs_completed.labels(priority="NORMAL")._value.get() == 1
    
    def test_prometheus_export(self):
        """Test Prometheus metrics export."""
        from prometheus_client import CollectorRegistry
        
        registry = CollectorRegistry()
        metrics = TaskQueuePrometheusMetrics(registry=registry)
        
        metrics.record_job_submitted(Priority.NORMAL)
        
        output = metrics.export()
        assert b"taskqueue_jobs_submitted_total" in output


class TestMultiprocessWorker:
    """Tests for multiprocessing workers."""
    
    def test_worker_pool_creation(self):
        """Test worker pool creation."""
        pool = MultiprocessWorkerPool(num_workers=2)
        assert pool.worker_count == 0
        assert not pool.is_running
    
    def test_register_handler(self):
        """Test handler registration."""
        pool = MultiprocessWorkerPool(num_workers=2)
        
        def my_handler(payload):
            return {"processed": True}
        
        pool.register_handler("my_task", my_handler)
        assert "my_task" in pool._handlers
    
    def test_async_worker_pool(self):
        """Test async worker pool."""
        pool = AsyncWorkerPool(max_concurrent=10)
        
        async def my_handler(payload):
            return {"result": "done"}
        
        pool.register_handler("async_task", my_handler)
        assert "async_task" in pool._handlers
    
    def test_hybrid_worker_pool(self):
        """Test hybrid worker pool with both CPU and I/O handlers."""
        pool = HybridWorkerPool(cpu_workers=2, io_concurrency=50)
        
        def cpu_handler(payload):
            return {"computed": sum(range(1000))}
        
        async def io_handler(payload):
            await asyncio.sleep(0.01)
            return {"fetched": True}
        
        pool.register_cpu_handler("cpu_task", cpu_handler)
        pool.register_io_handler("io_task", io_handler)
        
        assert "cpu_task" in pool._cpu_handlers
        assert "io_task" in pool._io_handlers


class TestAlerting:
    """Tests for alerting and failure callbacks."""
    
    def test_alert_creation(self):
        """Test Alert creation."""
        alert = Alert(
            id="test-1",
            severity=AlertSeverity.ERROR,
            title="Test Alert",
            message="This is a test",
        )
        assert alert.id == "test-1"
        assert alert.severity == AlertSeverity.ERROR
    
    def test_log_alert_handler(self):
        """Test LogAlertHandler."""
        handler = LogAlertHandler()
        alert = Alert(
            id="test-2",
            severity=AlertSeverity.WARNING,
            title="Warning",
            message="Test warning",
        )
        
        result = asyncio.run(handler.send(alert))
        assert result is True
    
    def test_callback_alert_handler(self):
        """Test CallbackAlertHandler with custom callback."""
        received_alerts = []
        
        def my_callback(alert):
            received_alerts.append(alert)
            return True
        
        handler = CallbackAlertHandler(my_callback)
        alert = Alert(
            id="test-3",
            severity=AlertSeverity.INFO,
            title="Info",
            message="Test info",
        )
        
        result = asyncio.run(handler.send(alert))
        assert result is True
        assert len(received_alerts) == 1
        assert received_alerts[0].id == "test-3"
    
    def test_alert_manager(self):
        """Test AlertManager with multiple handlers."""
        manager = AlertManager()
        
        received = []
        handler = CallbackAlertHandler(lambda a: received.append(a) or True)
        manager.add_handler(handler)
        
        async def send_alert():
            return await manager.send_alert(
                severity=AlertSeverity.ERROR,
                title="Test",
                message="Test message",
            )
        
        alert_id = asyncio.run(send_alert())
        assert alert_id is not None
        assert len(received) == 1


class TestMessagePackSerialization:
    """Tests for MessagePack serialization."""
    
    def test_messagepack_serializer(self):
        """Test MessagePack serialization."""
        serializer = MessagePackSerializer()
        
        data = {"key": "value", "numbers": [1, 2, 3]}
        encoded = serializer.serialize(data)
        decoded = serializer.deserialize(encoded)
        
        assert decoded == data
    
    def test_messagepack_complex_data(self):
        """Test MessagePack with complex nested data."""
        serializer = MessagePackSerializer()
        
        data = {
            "user": {"id": 123, "name": "test"},
            "items": [{"id": 1}, {"id": 2}],
            "metadata": {"nested": {"deep": "value"}},
        }
        encoded = serializer.serialize(data)
        decoded = serializer.deserialize(encoded)
        
        assert decoded == data


class TestTypeSafePayloads:
    """Tests for type-safe job payloads with generics."""
    
    def test_typed_job_with_pydantic_payload(self):
        """Test TypedJob with Pydantic model payload."""
        
        class UserPayload(BaseModel):
            user_id: int
            email: str
            action: str
        
        payload = UserPayload(user_id=123, email="test@example.com", action="create")
        
        job = TypedJob[UserPayload](
            name="process_user",
            payload=payload,
            priority=Priority.HIGH,
        )
        
        assert job.payload.user_id == 123
        assert job.payload.email == "test@example.com"
        assert job.priority == Priority.HIGH
    
    def test_typed_job_validation(self):
        """Test TypedJob validates payload type."""
        
        class OrderPayload(BaseModel):
            order_id: str
            amount: float
        
        payload = OrderPayload(order_id="ORD-001", amount=99.99)
        job = TypedJob[OrderPayload](name="process_order", payload=payload)
        
        assert job.payload.order_id == "ORD-001"
        assert job.payload.amount == 99.99


class TestGracefulShutdown:
    """Tests for graceful shutdown functionality."""
    
    def test_graceful_shutdown_creation(self):
        """Test GracefulShutdown creation."""
        registry = WorkerRegistry()
        worker = WorkerNode(
            info=WorkerInfo(id="w1", name="test", host="localhost", port=8000)
        )
        registry.register(worker)
        
        shutdown = GracefulShutdown(
            worker,
            registry,
            on_job_reassign=lambda job: None,
        )
        
        assert not shutdown.is_shutdown_requested()
    
    def test_graceful_shutdown_request(self):
        """Test requesting graceful shutdown."""
        registry = WorkerRegistry()
        worker = WorkerNode(
            info=WorkerInfo(id="w1", name="test", host="localhost", port=8000)
        )
        registry.register(worker)
        
        shutdown = GracefulShutdown(
            worker,
            registry,
            on_job_reassign=lambda job: None,
        )
        
        shutdown.request_shutdown()
        assert shutdown.is_shutdown_requested()


class TestWorkStealing:
    """Tests for work stealing functionality."""
    
    def test_work_stealing_find_overloaded(self):
        """Test finding overloaded workers."""
        registry = WorkerRegistry()
        
        info1 = WorkerInfo(
            id="w1",
            name="overloaded",
            host="localhost",
            port=8000,
            max_concurrent_jobs=10,
            current_jobs=["j1", "j2", "j3", "j4", "j5", "j6", "j7", "j8"],
        )
        worker1 = WorkerNode(info=info1)
        registry.register(worker1)
        
        stealing = WorkStealing(registry, threshold=0.3)
        overloaded = stealing.find_overloaded_workers()
        
        assert len(overloaded) == 1
        assert overloaded[0].info.id == "w1"
    
    def test_work_stealing_find_underloaded(self):
        """Test finding underloaded workers."""
        registry = WorkerRegistry()
        
        info1 = WorkerInfo(
            id="w1",
            name="idle",
            host="localhost",
            port=8000,
            max_concurrent_jobs=10,
            current_jobs=[],
        )
        worker1 = WorkerNode(info=info1)
        registry.register(worker1)
        
        stealing = WorkStealing(registry, threshold=0.3)
        underloaded = stealing.find_underloaded_workers()
        
        assert len(underloaded) == 1
        assert underloaded[0].info.id == "w1"


class TestRESTAPI:
    """Tests for FastAPI REST API."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        from fastapi.testclient import TestClient
        from repository_after.api import app, set_task_queue
        from repository_after import TaskQueue
        
        queue = TaskQueue()
        set_task_queue(queue)
        
        return TestClient(app)
    
    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_submit_job_endpoint(self, client):
        """Test job submission via API."""
        response = client.post("/jobs", json={
            "name": "test_job",
            "payload": {"data": "test"},
            "priority": "NORMAL",
        })
        assert response.status_code == 201
        assert "job_id" in response.json()
    
    def test_get_job_endpoint(self, client):
        """Test getting job details."""
        submit_response = client.post("/jobs", json={
            "name": "test_job",
            "payload": {},
        })
        job_id = submit_response.json()["job_id"]
        
        response = client.get(f"/jobs/{job_id}")
        assert response.status_code == 200
        assert response.json()["id"] == job_id
    
    def test_get_stats_endpoint(self, client):
        """Test queue stats endpoint."""
        response = client.get("/stats")
        assert response.status_code == 200
        assert "total_jobs" in response.json()
    
    def test_prometheus_metrics_endpoint(self, client):
        """Test Prometheus metrics endpoint."""
        response = client.get("/metrics")
        assert response.status_code == 200
        assert b"taskqueue" in response.content
    
    def test_list_workers_endpoint(self, client):
        """Test list workers endpoint."""
        response = client.get("/workers")
        assert response.status_code == 200
        assert "workers" in response.json()
