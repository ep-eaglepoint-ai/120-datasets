"""Redis backend for distributed task queue using Redis Streams."""
from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import redis
from redis import Redis
from redis.exceptions import RedisError

from .logging_config import get_logger
from .models import Job, JobStatus, Priority

logger = get_logger(__name__)


class RedisConfig:
    """Redis connection configuration."""
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        decode_responses: bool = True,
        socket_timeout: float = 5.0,
        socket_connect_timeout: float = 5.0,
    ):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.decode_responses = decode_responses
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout


class RedisConnection:
    """Redis connection manager with connection pooling."""
    
    _instance: Optional[Redis] = None
    _pool: Optional[redis.ConnectionPool] = None
    
    @classmethod
    def get_connection(cls, config: Optional[RedisConfig] = None) -> Redis:
        """Get or create Redis connection with pooling."""
        if cls._instance is None:
            config = config or RedisConfig()
            cls._pool = redis.ConnectionPool(
                host=config.host,
                port=config.port,
                db=config.db,
                password=config.password,
                decode_responses=config.decode_responses,
                socket_timeout=config.socket_timeout,
                socket_connect_timeout=config.socket_connect_timeout,
            )
            cls._instance = Redis(connection_pool=cls._pool)
            logger.info("redis_connection_established", host=config.host, port=config.port)
        return cls._instance
    
    @classmethod
    def close(cls):
        """Close Redis connection."""
        if cls._instance:
            cls._instance.close()
            cls._instance = None
        if cls._pool:
            cls._pool.disconnect()
            cls._pool = None
            logger.info("redis_connection_closed")


class RedisStreamsQueue:
    """Priority queue implementation using Redis Streams."""
    
    STREAM_PREFIX = "taskqueue:stream:"
    JOB_PREFIX = "taskqueue:job:"
    CONSUMER_GROUP = "taskqueue_workers"
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self._redis = redis_client or RedisConnection.get_connection()
        self._ensure_consumer_groups()
    
    def _ensure_consumer_groups(self):
        """Create consumer groups for each priority level if they don't exist."""
        for priority in Priority:
            stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
            try:
                self._redis.xgroup_create(
                    stream_key, 
                    self.CONSUMER_GROUP, 
                    id="0", 
                    mkstream=True
                )
                logger.debug("consumer_group_created", stream=stream_key)
            except redis.ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    raise
    
    def enqueue(self, job: Job) -> str:
        """Add job to Redis Stream based on priority."""
        priority = Priority(job.priority) if isinstance(job.priority, int) else job.priority
        stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
        job_key = f"{self.JOB_PREFIX}{job.id}"
        
        job_data = job.model_dump_json()
        self._redis.set(job_key, job_data)
        
        message_id = self._redis.xadd(
            stream_key,
            {"job_id": job.id, "created_at": time.time()},
        )
        
        logger.info(
            "job_enqueued",
            job_id=job.id,
            priority=priority.name,
            stream=stream_key,
            message_id=message_id,
        )
        return message_id
    
    def dequeue(
        self, 
        consumer_name: str,
        timeout_ms: int = 5000,
        count: int = 1,
    ) -> List[Tuple[str, Job]]:
        """Dequeue jobs from Redis Streams in priority order."""
        jobs = []
        
        for priority in Priority:
            if len(jobs) >= count:
                break
                
            stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
            
            try:
                messages = self._redis.xreadgroup(
                    self.CONSUMER_GROUP,
                    consumer_name,
                    {stream_key: ">"},
                    count=count - len(jobs),
                    block=timeout_ms if not jobs else 0,
                )
                
                if messages:
                    for stream_name, stream_messages in messages:
                        for message_id, data in stream_messages:
                            job_id = data.get("job_id")
                            if job_id:
                                job = self.get_job(job_id)
                                if job:
                                    jobs.append((message_id, job))
                                    logger.debug(
                                        "job_dequeued",
                                        job_id=job_id,
                                        consumer=consumer_name,
                                    )
            except RedisError as e:
                logger.error("dequeue_error", error=str(e), stream=stream_key)
        
        return jobs
    
    def acknowledge(self, job: Job, message_id: str):
        """Acknowledge job completion."""
        priority = Priority(job.priority) if isinstance(job.priority, int) else job.priority
        stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
        
        self._redis.xack(stream_key, self.CONSUMER_GROUP, message_id)
        logger.debug("job_acknowledged", job_id=job.id, message_id=message_id)
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Retrieve job by ID."""
        job_key = f"{self.JOB_PREFIX}{job_id}"
        job_data = self._redis.get(job_key)
        
        if job_data:
            return Job.model_validate_json(job_data)
        return None
    
    def update_job(self, job: Job):
        """Update job in Redis."""
        job_key = f"{self.JOB_PREFIX}{job.id}"
        self._redis.set(job_key, job.model_dump_json())
    
    def delete_job(self, job_id: str):
        """Delete job from Redis."""
        job_key = f"{self.JOB_PREFIX}{job_id}"
        self._redis.delete(job_key)
    
    def get_queue_depth(self, priority: Optional[Priority] = None) -> Dict[Priority, int]:
        """Get queue depth per priority level."""
        depths = {}
        
        priorities = [priority] if priority else list(Priority)
        
        for p in priorities:
            stream_key = f"{self.STREAM_PREFIX}{p.name.lower()}"
            try:
                info = self._redis.xinfo_stream(stream_key)
                depths[p] = info.get("length", 0)
            except RedisError:
                depths[p] = 0
        
        return depths
    
    def get_pending_count(self, priority: Priority, consumer_name: Optional[str] = None) -> int:
        """Get count of pending (unacknowledged) messages."""
        stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
        
        try:
            pending = self._redis.xpending(stream_key, self.CONSUMER_GROUP)
            return pending.get("pending", 0) if pending else 0
        except RedisError:
            return 0
    
    def size(self) -> int:
        """Get total queue size across all priorities."""
        depths = self.get_queue_depth()
        return sum(depths.values())
    
    def size_by_priority(self) -> Dict[Priority, int]:
        """Get queue size by priority level."""
        return self.get_queue_depth()
    
    def clear(self):
        """Clear all jobs from Redis queues."""
        for priority in Priority:
            stream_key = f"{self.STREAM_PREFIX}{priority.name.lower()}"
            try:
                self._redis.delete(stream_key)
            except RedisError:
                pass
    
    def remove_job(self, job_id: str):
        """Remove a specific job from the queue."""
        job_key = f"{self.JOB_PREFIX}{job_id}"
        self._redis.delete(job_key)


class RedisDistributedLock:
    """Redis-based distributed locking for coordination."""
    
    LOCK_PREFIX = "taskqueue:lock:"
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self._redis = redis_client or RedisConnection.get_connection()
    
    def acquire(
        self, 
        lock_name: str, 
        owner_id: str, 
        ttl_seconds: int = 30,
        blocking: bool = False,
        timeout: float = 10.0,
    ) -> bool:
        """Acquire a distributed lock."""
        lock_key = f"{self.LOCK_PREFIX}{lock_name}"
        
        if blocking:
            end_time = time.time() + timeout
            while time.time() < end_time:
                if self._try_acquire(lock_key, owner_id, ttl_seconds):
                    return True
                time.sleep(0.1)
            return False
        else:
            return self._try_acquire(lock_key, owner_id, ttl_seconds)
    
    def _try_acquire(self, lock_key: str, owner_id: str, ttl_seconds: int) -> bool:
        """Try to acquire lock using SET NX."""
        result = self._redis.set(
            lock_key,
            owner_id,
            nx=True,
            ex=ttl_seconds,
        )
        
        if result:
            logger.debug("lock_acquired", lock=lock_key, owner=owner_id)
            return True
        return False
    
    def release(self, lock_name: str, owner_id: str) -> bool:
        """Release a distributed lock (only if owned)."""
        lock_key = f"{self.LOCK_PREFIX}{lock_name}"
        
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        result = self._redis.eval(lua_script, 1, lock_key, owner_id)
        
        if result:
            logger.debug("lock_released", lock=lock_key, owner=owner_id)
            return True
        return False
    
    def extend(self, lock_name: str, owner_id: str, ttl_seconds: int = 30) -> bool:
        """Extend lock TTL (only if owned)."""
        lock_key = f"{self.LOCK_PREFIX}{lock_name}"
        
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        
        result = self._redis.eval(lua_script, 1, lock_key, owner_id, ttl_seconds)
        return bool(result)
    
    def is_locked(self, lock_name: str) -> bool:
        """Check if lock is held."""
        lock_key = f"{self.LOCK_PREFIX}{lock_name}"
        return self._redis.exists(lock_key) > 0
    
    def get_owner(self, lock_name: str) -> Optional[str]:
        """Get current lock owner."""
        lock_key = f"{self.LOCK_PREFIX}{lock_name}"
        return self._redis.get(lock_key)


class RedisLeaderElection:
    """Redis-based leader election for worker coordination."""
    
    LEADER_KEY = "taskqueue:leader"
    
    def __init__(
        self, 
        worker_id: str, 
        redis_client: Optional[Redis] = None,
        ttl_seconds: int = 30,
    ):
        self._redis = redis_client or RedisConnection.get_connection()
        self._worker_id = worker_id
        self._ttl_seconds = ttl_seconds
        self._lock = RedisDistributedLock(self._redis)
        self._is_leader = False
    
    def try_become_leader(self) -> bool:
        """Attempt to become the leader."""
        self._is_leader = self._lock.acquire(
            self.LEADER_KEY,
            self._worker_id,
            self._ttl_seconds,
        )
        
        if self._is_leader:
            logger.info("became_leader", worker_id=self._worker_id)
        
        return self._is_leader
    
    def renew_leadership(self) -> bool:
        """Renew leadership TTL."""
        if self._is_leader:
            renewed = self._lock.extend(
                self.LEADER_KEY,
                self._worker_id,
                self._ttl_seconds,
            )
            if not renewed:
                self._is_leader = False
                logger.warning("leadership_lost", worker_id=self._worker_id)
            return renewed
        return False
    
    def resign(self):
        """Resign from leadership."""
        if self._is_leader:
            self._lock.release(self.LEADER_KEY, self._worker_id)
            self._is_leader = False
            logger.info("resigned_leadership", worker_id=self._worker_id)
    
    @property
    def is_leader(self) -> bool:
        return self._is_leader
    
    def get_current_leader(self) -> Optional[str]:
        """Get current leader ID."""
        return self._lock.get_owner(self.LEADER_KEY)
