"""
Primary Tests for Task Queue with Retry Logic
Tests all 8 requirements for the task queue system.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from models import Task, Priority
from queue import TaskQueue




class TestRequirement5PriorityOrdering:
    """Requirement 5: Priority ordering must be respected during processing."""

    @pytest.fixture
    def queue(self):
        return TaskQueue(max_workers=1)

    @pytest.mark.asyncio
    async def test_high_priority_before_normal(self, queue):
        """HIGH priority tasks must be processed before NORMAL."""
        processed_order = []
        
        async def tracking_handler(payload):
            processed_order.append(payload["name"])
            return "done"
        
        queue.register_handler("task", tracking_handler)
        
        normal_task = Task(id="normal-1", name="task", 
                          payload={"name": "normal"}, priority=Priority.NORMAL)
        high_task = Task(id="high-1", name="task", 
                        payload={"name": "high"}, priority=Priority.HIGH)
        
        await queue.enqueue(normal_task)
        await queue.enqueue(high_task)
        
        await queue.process_one()
        await queue.process_one()
        
        assert processed_order == ["high", "normal"]

    @pytest.mark.asyncio
    async def test_normal_priority_before_low(self, queue):
        """NORMAL priority tasks must be processed before LOW."""
        processed_order = []
        
        async def tracking_handler(payload):
            processed_order.append(payload["name"])
            return "done"
        
        queue.register_handler("task", tracking_handler)
        
        low_task = Task(id="low-1", name="task", 
                       payload={"name": "low"}, priority=Priority.LOW)
        normal_task = Task(id="normal-1", name="task", 
                          payload={"name": "normal"}, priority=Priority.NORMAL)
        
        await queue.enqueue(low_task)
        await queue.enqueue(normal_task)
        
        await queue.process_one()
        await queue.process_one()
        
        assert processed_order == ["normal", "low"]

    @pytest.mark.asyncio
    async def test_full_priority_ordering(self, queue):
        """Tasks should be processed HIGH -> NORMAL -> LOW."""
        processed_order = []
        
        async def tracking_handler(payload):
            processed_order.append(payload["priority"])
            return "done"
        
        queue.register_handler("task", tracking_handler)
        
        await queue.enqueue(Task(id="low-1", name="task", 
                                payload={"priority": "low"}, priority=Priority.LOW))
        await queue.enqueue(Task(id="high-1", name="task", 
                                payload={"priority": "high"}, priority=Priority.HIGH))
        await queue.enqueue(Task(id="normal-1", name="task", 
                                payload={"priority": "normal"}, priority=Priority.NORMAL))
        
        await queue.process_one()
        await queue.process_one()
        await queue.process_one()
        
        assert processed_order == ["high", "normal", "low"]

    @pytest.mark.asyncio
    async def test_fifo_within_same_priority(self, queue):
        """Tasks with equal priority should be processed in creation order (FIFO)."""
        processed_order = []
        
        async def tracking_handler(payload):
            processed_order.append(payload["order"])
            return "done"
        
        queue.register_handler("task", tracking_handler)
        
        base_time = datetime.utcnow()
        
        task1 = Task(id="first", name="task", payload={"order": 1}, 
                    priority=Priority.NORMAL, created_at=base_time)
        task2 = Task(id="second", name="task", payload={"order": 2}, 
                    priority=Priority.NORMAL, created_at=base_time + timedelta(seconds=1))
        task3 = Task(id="third", name="task", payload={"order": 3}, 
                    priority=Priority.NORMAL, created_at=base_time + timedelta(seconds=2))
        
        await queue.enqueue(task3)
        await queue.enqueue(task1)
        await queue.enqueue(task2)
        
        await queue.process_one()
        await queue.process_one()
        await queue.process_one()
        
        assert processed_order == [1, 2, 3]


