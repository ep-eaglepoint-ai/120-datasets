"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from unittest.mock import AsyncMock
from models import Task
from queue import TaskQueue




class TestRequirement7IdempotentEnqueue:
    """Requirement 7: Duplicate task IDs must be handled idempotently."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_first_enqueue_succeeds(self, queue):
        """First enqueue with a task ID should succeed."""
        task = Task(id="unique-id", name="test_task", payload={"data": "original"})
        result = await queue.enqueue(task)
        
        assert result is True

    @pytest.mark.asyncio
    async def test_duplicate_enqueue_returns_false(self, queue):
        """Enqueue with existing task ID should return False."""
        task1 = Task(id="same-id", name="test_task", payload={"data": "first"})
        task2 = Task(id="same-id", name="test_task", payload={"data": "second"})
        
        result1 = await queue.enqueue(task1)
        result2 = await queue.enqueue(task2)
        
        assert result1 is True
        assert result2 is False

    @pytest.mark.asyncio
    async def test_duplicate_does_not_modify_existing(self, queue):
        """Duplicate enqueue should not modify the existing task."""
        task1 = Task(id="same-id", name="test_task", payload={"data": "original"})
        task2 = Task(id="same-id", name="test_task", payload={"data": "modified"})
        
        await queue.enqueue(task1)
        await queue.enqueue(task2)
        
        stored_task = await queue.get_task("same-id")
        assert stored_task.payload["data"] == "original"

    @pytest.mark.asyncio
    async def test_duplicate_not_added_to_queue(self, queue):
        """Duplicate should not be added to the processing queue."""
        handler = AsyncMock(return_value="done")
        queue.register_handler("test_task", handler)
        
        task1 = Task(id="same-id", name="test_task", payload={})
        task2 = Task(id="same-id", name="test_task", payload={})
        
        await queue.enqueue(task1)
        await queue.enqueue(task2)
        
        await queue.process_one()
        result = await queue.process_one()
        
        assert handler.call_count == 1
        assert result is None


