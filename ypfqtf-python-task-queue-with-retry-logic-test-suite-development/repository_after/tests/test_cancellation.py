"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock
from models import Task, TaskStatus
from queue import TaskQueue


class TestRequirement6CancelledTasks:
    """Requirement 6: Cancelled tasks must not be executed."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_cancel_sets_cancelled_status(self, queue):
        """Calling cancel() on a PENDING task should set status to CANCELLED."""
        task = Task(id="task-1", name="test_task", payload={})
        await queue.enqueue(task)
        
        result = await queue.cancel("task-1")
        
        assert result is True
        assert task.status == TaskStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_cancelled_task_handler_not_called(self, queue):
        """Handler should never be invoked for cancelled tasks."""
        handler = AsyncMock(return_value="done")
        queue.register_handler("test_task", handler)
        
        task = Task(id="task-1", name="test_task", payload={})
        await queue.enqueue(task)
        await queue.cancel("task-1")
        
        result = await queue.process_one()
        
        handler.assert_not_called()

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_task_returns_false(self, queue):
        """Cancelling a non-existent task should return False."""
        result = await queue.cancel("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_running_task_returns_false(self, queue):
        """Cancelling a task that is already running should return False."""
        task = Task(id="task-1", name="test_task", payload={})
        task.status = TaskStatus.RUNNING
        queue._tasks["task-1"] = task
        
        result = await queue.cancel("task-1")
        assert result is False


