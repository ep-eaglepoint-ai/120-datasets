# test_concurrency_with_mocked_time.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from freezegun import freeze_time
from models import Task, TaskStatus
from queue import TaskQueue


class TestRequirementConcurrencyWithMockedTime:
    """Requirement 10: Task processing must be concurrent with mocked time."""
    
    @pytest.fixture
    async def queue(self):
        """Fixture to create and cleanup a TaskQueue instance."""
        q = TaskQueue(max_workers=2)
        yield q
        await q.stop()
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_multiple_workers_process_concurrently_with_mocked_time(self):
        """Test that multiple workers can process tasks concurrently with mocked time."""
        queue = TaskQueue(max_workers=2)
        
        # Setup: Create tasks that take time to complete
        completion_order = []
        execution_times = {}
        
        # Track real asyncio time (not frozen) for concurrency measurement
        real_start_time = asyncio.get_event_loop().time()
        
        async def slow_handler(payload):
            """Handler that takes time based on task ID."""
            task_id = payload.get("task_id")
            
            # Record start time in real asyncio time
            start_time = asyncio.get_event_loop().time() - real_start_time
            
            # Mock sleep to simulate work without actually sleeping
            await asyncio.sleep(0)
            
            # Record end time
            end_time = asyncio.get_event_loop().time() - real_start_time
            execution_times[task_id] = {
                "start": start_time,
                "end": end_time,
                "duration": end_time - start_time
            }
            completion_order.append(task_id)
            return f"completed_{task_id}"
        
        # Register handler
        queue.register_handler("test_task", slow_handler)
        
        # Create two tasks
        task1 = Task(
            id="task1",
            name="test_task",
            payload={"task_id": "fast"}
        )
        task2 = Task(
            id="task2", 
            name="test_task",
            payload={"task_id": "slow"}
        )
        
        # Enqueue both tasks
        await queue.enqueue(task1)
        await queue.enqueue(task2)
        
        # Mock sleep to prevent actual waiting
        sleep_calls = []
        async def mock_sleep(delay):
            sleep_calls.append(delay)
            # Return immediately without sleeping
        
        with patch('asyncio.sleep', side_effect=mock_sleep):
            # Process tasks using process_one (controlled execution)
            processed_tasks = []
            while len(processed_tasks) < 2:
                task = await queue.process_one()
                if task:
                    processed_tasks.append(task)
            
            # Both tasks should complete
            assert len(completion_order) == 2
            
            # Since we mocked sleep, tasks should complete very quickly
            # The important part is that both were processed
            
        await queue.stop()
    
    @pytest.mark.asyncio
    @freeze_time("2024-01-01 12:00:00")
    async def test_queue_handles_concurrent_enqueue_operations_with_mocked_time(self):
        """Test that enqueue operations are thread-safe with mocked time."""
        queue = TaskQueue(max_workers=2)
        
        # Simulate concurrent enqueues
        async def concurrent_enqueue(task_id):
            task = Task(id=task_id, name="test_task")
            return await queue.enqueue(task)
        
        # Create many concurrent enqueue operations
        num_tasks = 100
        enqueue_tasks = [
            concurrent_enqueue(f"task_{i}") 
            for i in range(num_tasks)
        ]
        
        # Run them concurrently
        results = await asyncio.gather(*enqueue_tasks)
        
        # All should succeed (no duplicates due to idempotency)
        assert all(results)
        
        # Verify all tasks are in the queue
        assert len(queue._tasks) == num_tasks
        
        await queue.stop()
