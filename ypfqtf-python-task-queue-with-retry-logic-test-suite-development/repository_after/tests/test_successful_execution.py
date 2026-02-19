"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock
from models import Task, TaskStatus
from queue import TaskQueue



class TestRequirement1SuccessfulExecution:
    """Requirement 1: Successful task execution must complete and return results."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_successful_task_marks_completed(self, queue):
        """A registered handler that returns normally should mark the task as COMPLETED."""
        handler = AsyncMock(return_value={"result": "success"})
        queue.register_handler("test_task", handler)
        
        task = Task(id="task-1", name="test_task", payload={"key": "value"})
        await queue.enqueue(task)
        await queue.process_one()
        
        assert task.status == TaskStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_successful_task_stores_result(self, queue):
        """Handler result should be stored in task.result."""
        expected_result = {"data": [1, 2, 3], "status": "ok"}
        handler = AsyncMock(return_value=expected_result)
        queue.register_handler("test_task", handler)
        
        task = Task(id="task-2", name="test_task", payload={})
        await queue.enqueue(task)
        await queue.process_one()
        
        assert task.result == expected_result

    @pytest.mark.asyncio
    async def test_successful_task_sets_completed_at(self, queue):
        """completed_at timestamp should be set after successful execution."""
        handler = AsyncMock(return_value="done")
        queue.register_handler("test_task", handler)
        
        task = Task(id="task-3", name="test_task", payload={})
        assert task.completed_at is None
        
        await queue.enqueue(task)
        await queue.process_one()
        
        assert task.completed_at is not None
        assert isinstance(task.completed_at, datetime)

    @pytest.mark.asyncio
    async def test_handler_called_exactly_once(self, queue):
        """Handler must be called exactly once with the task's payload."""
        handler = AsyncMock(return_value="result")
        queue.register_handler("test_task", handler)
        
        payload = {"user_id": 123, "action": "process"}
        task = Task(id="task-4", name="test_task", payload=payload)
        await queue.enqueue(task)
        await queue.process_one()
        
        handler.assert_called_once_with(payload)

    @pytest.mark.asyncio
    async def test_started_at_timestamp_set(self, queue):
        """started_at timestamp should be set when task starts running."""
        handler = AsyncMock(return_value="done")
        queue.register_handler("test_task", handler)
        
        task = Task(id="task-5", name="test_task", payload={})
        assert task.started_at is None
        
        await queue.enqueue(task)
        await queue.process_one()
        
        assert task.started_at is not None


