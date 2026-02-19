# test_timeout_with_mocked_time.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from freezegun import freeze_time
from models import Task, TaskStatus
from queue import TaskQueue


class TestRequirement4TaskTimeoutWithMockedTime:
    """Requirement 4: Task timeout must kill long-running handlers with mocked time."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_timeout_triggers_retry_with_mocked_time(self):
        """Handlers exceeding timeout should trigger retry using mocked time."""
        async def slow_handler(payload):
            # This would normally sleep, but we'll mock asyncio.sleep
            await asyncio.sleep(10)
            return "done"
        
        queue = TaskQueue()
        queue.register_handler("slow_task", slow_handler)
        
        task = Task(id="task-1", name="slow_task", payload={}, 
                   timeout_seconds=0.01, max_retries=5)
        await queue.enqueue(task)
        
        # Mock asyncio.sleep to track calls
        sleep_calls = []
        async def mock_sleep(delay):
            sleep_calls.append(delay)
            # Simulate time passing for freezegun
            # We can't directly manipulate freezegun, so we'll just track
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            # Also mock asyncio.wait_for to simulate timeout
            with patch('asyncio.wait_for') as mock_wait_for:
                async def mock_wait_for_func(coro, timeout):
                    # Simulate timeout by raising TimeoutError
                    raise asyncio.TimeoutError()
                
                mock_wait_for.side_effect = mock_wait_for_func
                
                await queue.process_one()
        
        assert task.retry_count == 1
        assert task.status == TaskStatus.PENDING

    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_timeout_error_message_with_mocked_time(self):
        """Timeout should record 'Task timeout exceeded' error using mocked time."""
        async def slow_handler(payload):
            await asyncio.sleep(10)
            return "done"
        
        queue = TaskQueue()
        queue.register_handler("slow_task", slow_handler)
        
        task = Task(id="task-2", name="slow_task", payload={}, 
                   timeout_seconds=0.01, max_retries=5)
        await queue.enqueue(task)
        
        with patch('asyncio.sleep'):
            with patch('asyncio.wait_for') as mock_wait_for:
                async def mock_wait_for_func(coro, timeout):
                    raise asyncio.TimeoutError()
                
                mock_wait_for.side_effect = mock_wait_for_func
                
                await queue.process_one()
        
        assert task.retry_history[0]["error"] == "Task timeout exceeded"

    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_timeout_follows_retry_logic_with_mocked_time(self):
        """Timeout should follow same retry logic as other failures using mocked time."""
        async def slow_handler(payload):
            await asyncio.sleep(10)
            return "done"
        
        queue = TaskQueue()
        queue.register_handler("slow_task", slow_handler)
        
        task = Task(id="task-3", name="slow_task", payload={}, 
                   timeout_seconds=0.01, max_retries=2)
        await queue.enqueue(task)
        
        with patch('asyncio.sleep'):
            with patch('asyncio.wait_for') as mock_wait_for:
                async def mock_wait_for_func(coro, timeout):
                    raise asyncio.TimeoutError()
                
                mock_wait_for.side_effect = mock_wait_for_func
                
                with patch.object(queue, '_calculate_backoff', return_value=0):
                    await queue.process_one()
                    await queue.process_one()
        
        assert task.status == TaskStatus.DEAD
        dlq = queue.get_dead_letter_queue()
        assert len(dlq) == 1
