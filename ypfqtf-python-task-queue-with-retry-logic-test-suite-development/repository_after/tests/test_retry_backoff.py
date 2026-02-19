"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from unittest.mock import AsyncMock
from queue import TaskQueue
from models import Task, TaskStatus
from unittest.mock import patch



class TestRequirement2RetryWithBackoff:
    """Requirement 2: Failed tasks must trigger automatic retry with exponential backoff."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_failed_task_increments_retry_count(self, queue):
        """When handler raises exception, retry_count should increment."""
        handler = AsyncMock(side_effect=Exception("Test error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-1", name="failing_task", payload={}, max_retries=5)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
        
        assert task.retry_count == 1

    @pytest.mark.asyncio
    async def test_failed_task_records_error_in_history(self, queue):
        """Error should be recorded in retry_history."""
        error_msg = "Connection timeout"
        handler = AsyncMock(side_effect=Exception(error_msg))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-2", name="failing_task", payload={}, max_retries=5)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
        
        assert len(task.retry_history) == 1
        assert task.retry_history[0]["error"] == error_msg
        assert task.retry_history[0]["attempt"] == 1
        assert "timestamp" in task.retry_history[0]

    @pytest.mark.asyncio
    async def test_failed_task_returns_to_pending(self, queue):
        """After failure (before max retries), task should return to PENDING."""
        handler = AsyncMock(side_effect=Exception("Error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-3", name="failing_task", payload={}, max_retries=5)
        await queue.enqueue(task)
        
        with patch.object(queue, '_calculate_backoff', return_value=0):
            await queue.process_one()
        
        assert task.status == TaskStatus.PENDING

    def test_backoff_calculation_exponential(self):
        """Backoff should be base_delay * 2^retry_count."""
        queue = TaskQueue()
        
        assert queue._calculate_backoff(0) == 1.0
        assert queue._calculate_backoff(1) == 2.0
        assert queue._calculate_backoff(2) == 4.0
        assert queue._calculate_backoff(3) == 8.0
        assert queue._calculate_backoff(4) == 16.0

    def test_backoff_capped_at_300_seconds(self):
        """Backoff should be capped at 300 seconds."""
        queue = TaskQueue()
        
        assert queue._calculate_backoff(10) == 300.0
        assert queue._calculate_backoff(20) == 300.0

    @pytest.mark.asyncio
    async def test_backoff_sequence_with_time_mocking(self, queue):
        """Scenario 3: Test backoff sequence with time mocking.
        
        The backoff formula is: base_delay * 2^retry_count
        With base_delay=1.0:
        - retry_count=1: 1 * 2^1 = 2s
        - retry_count=2: 1 * 2^2 = 4s
        - retry_count=3: 1 * 2^3 = 8s
        - retry_count=4: 1 * 2^4 = 16s
        """
        handler = AsyncMock(side_effect=Exception("Always fails"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="backoff-seq", name="failing_task", payload={}, max_retries=5)
        await queue.enqueue(task)
        
        # Track all sleep calls to verify backoff sequence
        sleep_delays = []
        
        async def mock_sleep(delay):
            sleep_delays.append(delay)
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            # Process multiple retries
            for _ in range(4):
                await queue.process_one()
        
        # Verify the exponential backoff sequence: 2s, 4s, 8s, 16s
        # (base_delay=1 * 2^retry_count where retry_count starts at 1)
        expected_sequence = [2.0, 4.0, 8.0, 16.0]
        assert sleep_delays == expected_sequence, f"Expected {expected_sequence}, got {sleep_delays}"
        
        # Also verify each delay doubles from previous
        for i in range(1, len(sleep_delays)):
            assert sleep_delays[i] == sleep_delays[i-1] * 2, "Backoff should double each retry"


