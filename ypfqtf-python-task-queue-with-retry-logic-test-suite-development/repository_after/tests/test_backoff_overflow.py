# test_retry_backoff_with_mocked_time.py
import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from freezegun import freeze_time
import time
from models import Task, TaskStatus
from queue import TaskQueue


class TestRetryBackoffWithMockedTime:
    """Tests for Requirement 2: Failed tasks trigger automatic retry with exponential backoff."""
    
    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_backoff_delay_applied_to_retry(self):
        """Verify that backoff delay is applied between retries using mocked time."""
        queue = TaskQueue()
        
        handler = AsyncMock(side_effect=Exception("Test error"))
        queue.register_handler("failing_task", handler)
        
        task = Task(id="task-1", name="failing_task", payload={}, max_retries=3)
        await queue.enqueue(task)
        
        # Mock asyncio.sleep to track delays WITHOUT actually sleeping
        sleep_calls = []
        original_sleep = asyncio.sleep
        
        async def mock_sleep(delay):
            sleep_calls.append(delay)
            # Advance freezegun time
            current_time = datetime.utcnow()
            new_time = current_time.timestamp() + delay
            # Can't directly manipulate freezegun, so we'll just track
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            with patch('queue.datetime') as mock_datetime:
                # Setup datetime mock to simulate time passing
                current_time = datetime(2024, 1, 1, 12, 0, 0)
                
                def utcnow():
                    nonlocal current_time
                    return current_time
                
                mock_datetime.utcnow.side_effect = utcnow
                
                # First process - should fail and schedule retry with backoff
                processed = await queue.process_one()
                
                # Should have called sleep with backoff for retry_count=1
                assert len(sleep_calls) == 1
                # After first failure, retry_count=1, so backoff = 1.0 * 2^1 = 2.0
                assert sleep_calls[0] == 2.0
                
                # Task should be back in queue for retry
                assert processed.status == TaskStatus.PENDING
                assert processed.retry_count == 1
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_exponential_backoff_sequence(self):
        """Verify exponential backoff sequence: 2s, 4s, 8s... (starting from retry_count=1)"""
        queue = TaskQueue()
        
        # Track sleep delays
        sleep_delays = []
        
        async def mock_sleep(delay):
            sleep_delays.append(delay)
            # Don't actually sleep
        
        handler_calls = []
        async def failing_handler(payload):
            handler_calls.append(len(handler_calls) + 1)
            raise Exception(f"Fail attempt {len(handler_calls)}")
        
        queue.register_handler("test_task", failing_handler)
        
        task = Task(id="task-1", name="test_task", payload={}, max_retries=5)
        await queue.enqueue(task)
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            with patch('queue.datetime') as mock_datetime:
                # Setup datetime to advance with sleeps
                times = [datetime(2024, 1, 1, 12, 0, i) for i in range(10)]
                time_idx = [0]
                
                def utcnow():
                    result = times[time_idx[0]]
                    time_idx[0] += 1
                    return result
                
                mock_datetime.utcnow.side_effect = utcnow
                
                # Process multiple retries
                for i in range(3):
                    await queue.process_one()
                
                # Verify exponential backoff sequence
                # retry_count=1 → backoff(1) = 2.0 (after first failure)
                # retry_count=2 → backoff(2) = 4.0 (after second failure)  
                # retry_count=3 → backoff(3) = 8.0 (after third failure)
                assert sleep_delays == [2.0, 4.0, 8.0]
                
                # Verify handler was called each time
                assert handler_calls == [1, 2, 3]
                assert task.retry_count == 3
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_backoff_capped_at_max_delay(self):
        """Verify backoff is capped at 300 seconds for high retry counts."""
        queue = TaskQueue()
        
        sleep_delays = []
        async def mock_sleep(delay):
            sleep_delays.append(delay)
        
        handler = AsyncMock(side_effect=Exception("Always fail"))
        queue.register_handler("failing_task", handler)
        
        # Create task with high retry_count to test capping
        task = Task(id="task-1", name="failing_task", payload={}, max_retries=20)
        task.retry_count = 10  # Simulate already having 10 retries
        
        await queue.enqueue(task)
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            with patch('queue.datetime') as mock_datetime:
                mock_datetime.utcnow.return_value = datetime(2024, 1, 1, 12, 0, 0)
                
                await queue.process_one()
                
                # retry_count=10 → 2^10 = 1024, but capped at 300
                assert sleep_delays == [300.0]


class TestRequirement8BackoffOverflow:
    """Requirement 8: Backoff calculation must not overflow for high retry counts."""

    def test_backoff_high_retry_count_no_exception(self):
        """Computing backoff for retry_count=100 must not raise exceptions."""
        queue = TaskQueue()
        
        try:
            result = queue._calculate_backoff(100)
        except Exception as e:
            pytest.fail(f"Backoff calculation raised exception: {e}")

    def test_backoff_very_high_retry_count(self):
        """Computing backoff for retry_count=1000 must not raise exceptions."""
        queue = TaskQueue()
        
        try:
            result = queue._calculate_backoff(1000)
        except Exception as e:
            pytest.fail(f"Backoff calculation raised exception: {e}")

    def test_backoff_high_retry_capped_at_max(self):
        """High retry count backoff should be capped at 300 seconds."""
        queue = TaskQueue()
        
        result = queue._calculate_backoff(100)
        
        assert result == 300.0

    def test_backoff_not_infinity(self):
        """Backoff should not produce infinity."""
        queue = TaskQueue()
        import math
        
        result = queue._calculate_backoff(100)
        
        assert not math.isinf(result)

    def test_backoff_not_nan(self):
        """Backoff should not produce NaN."""
        queue = TaskQueue()
        import math
        
        result = queue._calculate_backoff(100)
        
        assert not math.isnan(result)

    def test_backoff_is_numeric(self):
        """Backoff should return a valid numeric value."""
        queue = TaskQueue()
        
        result = queue._calculate_backoff(100)
        
        assert isinstance(result, (int, float))
        assert result > 0
