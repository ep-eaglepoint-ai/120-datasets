"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from unittest.mock import AsyncMock
from models import Task, TaskStatus
from queue import TaskQueue
from unittest.mock import patch




class TestRequirement3DeadLetterQueue:
    """Requirement 3: Max retries reached must move task to dead letter queue."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_max_retries_moves_to_dead_letter(self, queue):
        """After exhausting max_retries, task should be in dead letter queue."""
        handler = AsyncMock(side_effect=Exception("Persistent error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-1", name="failing_task", payload={}, max_retries=2)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
            await queue.process_one()
        
        dlq = queue.get_dead_letter_queue()
        assert len(dlq) == 1
        assert dlq[0].task.id == "task-1"

    @pytest.mark.asyncio
    async def test_dead_task_status(self, queue):
        """Task status should become DEAD after max retries."""
        handler = AsyncMock(side_effect=Exception("Error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-2", name="failing_task", payload={}, max_retries=1)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
        
        assert task.status == TaskStatus.DEAD

    @pytest.mark.asyncio
    async def test_dead_letter_contains_full_retry_history(self, queue):
        """DeadLetterEntry should contain task with complete retry_history."""
        handler = AsyncMock(side_effect=Exception("Error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-3", name="failing_task", payload={}, max_retries=3)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
            await queue.process_one()
            await queue.process_one()
        
        dlq = queue.get_dead_letter_queue()
        assert len(dlq) == 1
        assert len(dlq[0].task.retry_history) == 3
        
        for i, entry in enumerate(dlq[0].task.retry_history):
            assert entry["attempt"] == i + 1
            assert "error" in entry
            assert "timestamp" in entry

    @pytest.mark.asyncio
    async def test_dead_letter_entry_has_reason(self, queue):
        """DeadLetterEntry should have a reason string."""
        handler = AsyncMock(side_effect=Exception("Specific error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-4", name="failing_task", payload={}, max_retries=1)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
        
        dlq = queue.get_dead_letter_queue()
        assert "Max retries exceeded" in dlq[0].reason


