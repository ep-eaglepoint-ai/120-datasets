import asyncio
import heapq
from typing import Callable, Dict, Optional, List
from datetime import datetime
from models import Task, TaskStatus, Priority, DeadLetterEntry


class TaskQueue:
    def __init__(self, max_workers: int = 4):
        self._queue: List[tuple] = []  # heap: (priority, created_at, task)
        self._tasks: Dict[str, Task] = {}
        self._handlers: Dict[str, Callable] = {}
        self._dead_letter: List[DeadLetterEntry] = []
        self._max_workers = max_workers
        self._active_workers = 0
        self._running = False
        self._lock = asyncio.Lock()

    def register_handler(self, task_name: str, handler: Callable) -> None:
        """Register a handler function for a task type."""
        self._handlers[task_name] = handler

    async def enqueue(self, task: Task) -> bool:
        """Add a task to the queue. Returns False if task ID already exists."""
        async with self._lock:
            if task.id in self._tasks:
                return False  # Idempotent: don't add duplicates

            self._tasks[task.id] = task
            heapq.heappush(
                self._queue,
                (task.priority.value, task.created_at.timestamp(), task)
            )
            return True

    async def cancel(self, task_id: str) -> bool:
        """Cancel a pending task. Returns False if task not found or already running."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if not task or task.status != TaskStatus.PENDING:
                return False

            task.status = TaskStatus.CANCELLED
            return True

    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        return self._tasks.get(task_id)

    def get_dead_letter_queue(self) -> List[DeadLetterEntry]:
        """Get all entries in dead letter queue."""
        return self._dead_letter.copy()

    async def _get_next_task(self) -> Optional[Task]:
        """Get next pending task from queue."""
        async with self._lock:
            while self._queue:
                _, _, task = heapq.heappop(self._queue)
                if task.status == TaskStatus.PENDING:
                    return task
            return None

    def _calculate_backoff(self, retry_count: int) -> float:
        """Calculate exponential backoff delay in seconds."""
        base_delay = 1.0
        max_delay = 300.0  # 5 minutes max
        delay = base_delay * (2 ** retry_count)
        return min(delay, max_delay)

    async def _execute_task(self, task: Task) -> None:
        """Execute a single task with timeout and retry handling."""
        handler = self._handlers.get(task.name)
        if not handler:
            task.status = TaskStatus.FAILED
            task.error = f"No handler registered for task: {task.name}"
            await self._move_to_dead_letter(task, "No handler")
            return

        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()

        try:
            result = await asyncio.wait_for(
                handler(task.payload),
                timeout=task.timeout_seconds
            )
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = datetime.utcnow()

        except asyncio.TimeoutError:
            await self._handle_failure(task, "Task timeout exceeded")

        except Exception as e:
            await self._handle_failure(task, str(e))

    async def _handle_failure(self, task: Task, error: str) -> None:
        """Handle task failure with retry logic."""
        task.retry_count += 1
        task.retry_history.append({
            "attempt": task.retry_count,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        })

        if task.retry_count >= task.max_retries:
            task.status = TaskStatus.FAILED
            task.error = error
            await self._move_to_dead_letter(task, f"Max retries exceeded: {error}")
        else:
            # Schedule retry with backoff
            task.status = TaskStatus.PENDING
            backoff = self._calculate_backoff(task.retry_count)
            await asyncio.sleep(backoff)

            async with self._lock:
                heapq.heappush(
                    self._queue,
                    (task.priority.value, datetime.utcnow().timestamp(), task)
                )

    async def _move_to_dead_letter(self, task: Task, reason: str) -> None:
        """Move failed task to dead letter queue."""
        task.status = TaskStatus.DEAD
        entry = DeadLetterEntry(task=task, reason=reason)
        self._dead_letter.append(entry)

    async def _worker(self) -> None:
        """Worker coroutine that processes tasks."""
        while self._running:
            task = await self._get_next_task()
            if task:
                self._active_workers += 1
                try:
                    await self._execute_task(task)
                finally:
                    self._active_workers -= 1
            else:
                await asyncio.sleep(0.1)  # No tasks, wait briefly

    async def start(self) -> None:
        """Start the task queue workers."""
        self._running = True
        workers = [self._worker() for _ in range(self._max_workers)]
        await asyncio.gather(*workers)

    async def stop(self) -> None:
        """Stop the task queue."""
        self._running = False

    async def process_one(self) -> Optional[Task]:
        """Process a single task (for testing)."""
        task = await self._get_next_task()
        if task:
            await self._execute_task(task)
            return task
        return None
