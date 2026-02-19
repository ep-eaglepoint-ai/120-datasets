"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta
from models import Task, TaskStatus
from queue import TaskQueue



class TestTaskQueueProcessOne:
    """Tests for the process_one method which can be used for controlled testing."""
    
    @pytest.mark.asyncio
    async def test_process_one_for_controlled_execution(self):
        """Test process_one() method for testing without background workers."""
        queue = TaskQueue()
        
        results = []
        
        async def test_handler(payload):
            results.append(payload.get("data"))
            return "processed"
        
        queue.register_handler("test", test_handler)
        
        # Add tasks with distinct timestamps to avoid heap comparison issues
        base_time = datetime(2024, 1, 1, 12, 0, 0)
        task1 = Task(id="task1", name="test", payload={"data": "first"}, created_at=base_time)
        task2 = Task(id="task2", name="test", payload={"data": "second"}, created_at=base_time + timedelta(seconds=1))
        
        await queue.enqueue(task1)
        await queue.enqueue(task2)
        
        # Process tasks one by one
        processed_task1 = await queue.process_one()
        assert processed_task1 is not None
        assert processed_task1.id == "task1"
        assert processed_task1.status == TaskStatus.COMPLETED
        
        processed_task2 = await queue.process_one()
        assert processed_task2 is not None
        assert processed_task2.id == "task2"
        
        # No more tasks
        processed_none = await queue.process_one()
        assert processed_none is None
        
        assert results == ["first", "second"]
    
    @pytest.mark.asyncio 
    async def test_process_one_handles_failures(self):
        """Test process_one() with failing tasks."""
        queue = TaskQueue()
        
        async def failing_handler(payload):
            raise ValueError("Handler failed")
        
        queue.register_handler("failing", failing_handler)
        
        # max_retries=2 means: initial attempt + 1 retry = 2 total attempts
        task = Task(
            id="fail_task",
            name="failing",
            max_retries=2
        )
        
        await queue.enqueue(task)
        
        # First attempt (initial execution)
        processed = await queue.process_one()
        assert processed is not None
        assert processed.id == "fail_task"
        assert processed.retry_count == 1
        assert processed.status == TaskStatus.PENDING  # Will retry once
        
        # Second attempt (first and only retry, final attempt)
        processed = await queue.process_one()
        assert processed is not None
        assert processed.id == "fail_task"
        assert processed.retry_count == 2
        assert processed.status == TaskStatus.DEAD  # Max retries exceeded (2 total attempts)
        
        # Task should be in dead letter after max retries
        dead_letter = queue.get_dead_letter_queue()
        assert len(dead_letter) == 1
        assert dead_letter[0].task.id == "fail_task"
    
