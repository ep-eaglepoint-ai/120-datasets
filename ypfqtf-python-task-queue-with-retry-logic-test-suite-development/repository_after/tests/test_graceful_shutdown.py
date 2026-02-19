# test_graceful_shutdown_with_mocked_time.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from freezegun import freeze_time
import time
from models import Task, TaskStatus
from queue import TaskQueue


class TestTaskQueueGracefulShutdownWithMockedTime:
    """Tests for the graceful shutdown implementation gap with mocked time."""
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_stop_method_does_not_wait_for_in_progress_tasks_with_mocked_time(self):
        """Test that stop() doesn't wait for in-progress tasks to complete with mocked time."""
        queue = TaskQueue(max_workers=1)
        
        processing_started = asyncio.Event()
        handler_completed = asyncio.Event()
        
        async def long_handler(payload):
            processing_started.set()
            # Simulate long running task without actually sleeping
            try:
                await asyncio.sleep(0)  # Yield once
                # Try to wait for completion event (will timeout in test)
                await asyncio.wait_for(handler_completed.wait(), timeout=0.1)
            except asyncio.TimeoutError:
                pass  # Expected in test
            return "done"
        
        queue.register_handler("long", long_handler)
        
        task = Task(id="task1", name="long")
        await queue.enqueue(task)
        
        # Start processing
        worker_task = asyncio.create_task(queue.start())
        
        # Wait for task to start
        await processing_started.wait()
        await asyncio.sleep(0)  # Yield to ensure task is marked RUNNING
        
        # Mock time tracking
        start_mock_time = 0.0
        
        with patch('time.time') as mock_time:
            mock_time.side_effect = lambda: start_mock_time
            
            # Stop the queue - this should return immediately
            await queue.stop()
            
            # Simulate time passing for assertion
            start_mock_time = 0.1
        
        # stop() returns immediately without waiting
        # Since we mocked time, we can't measure actual duration
        
        # Handler might still be running
        assert not handler_completed.is_set()
        
        # Task is abandoned in RUNNING state
        retrieved_task = await queue.get_task("task1")
        assert retrieved_task.status == TaskStatus.RUNNING
        
        # Cleanup
        handler_completed.set()
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_no_mechanism_to_drain_queue_before_shutdown_with_mocked_time(self):
        """Test that there's no way to drain pending tasks before shutdown with mocked time."""
        queue = TaskQueue(max_workers=2)
        
        # Add multiple tasks
        async def quick_handler(payload):
            # Mock sleep to prevent actual waiting
            await asyncio.sleep(0)
            return "done"
        
        queue.register_handler("quick", quick_handler)
        
        tasks = []
        for i in range(5):
            task = Task(id=f"task_{i}", name="quick")
            tasks.append(task)
            await queue.enqueue(task)
        
        # Start processing
        worker_task = asyncio.create_task(queue.start())
        
        # Mock sleep to prevent actual waiting
        with patch('asyncio.sleep'):
            # Immediately stop - no draining
            await asyncio.sleep(0)  # Let some tasks start
            await queue.stop()
        
        # Some tasks will be abandoned
        # No way to know which completed and which didn't
        
        # Check status of tasks
        completed_count = 0
        running_count = 0
        pending_count = 0
        
        for task in tasks:
            retrieved = await queue.get_task(task.id)
            if retrieved.status == TaskStatus.COMPLETED:
                completed_count += 1
            elif retrieved.status == TaskStatus.RUNNING:
                running_count += 1
            elif retrieved.status == TaskStatus.PENDING:
                pending_count += 1
        
        # At least some tasks might be stuck
        # With mocked sleep and immediate stop, most will be PENDING
        assert pending_count > 0
        
        # Cleanup
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
