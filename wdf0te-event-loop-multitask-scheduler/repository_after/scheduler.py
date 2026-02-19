import time
import heapq
import itertools
from collections import deque
from typing import Generator, Any, List, Tuple, Optional, Union


class SystemCall:
    """Base class for all system calls yielded by tasks."""
    pass

class Sleep(SystemCall):
    """Call to put the task to sleep for a duration."""
    def __init__(self, duration: float):
        self.duration = duration

class Yield(SystemCall):
    """Call to voluntarily yield control back to scheduler."""
    pass

class TaskExit(SystemCall):
    """Internal call to signal task completion."""
    pass

class Task:
    """
    Represents a process/task in the scheduler.
    Wraps the generator and manages state/priority.
    """
    _id_generator = itertools.count()

    def __init__(self, name: str, coro: Generator, priority: int = 10):
        self.id = next(self._id_generator)
        self.name = name
        self.coro = coro
        self.priority = priority
        self.created_at = time.time()

        # 'sequence' is now managed by the Scheduler to ensure Round-Robin fairness.
        # It represents the order in which the task entered the Ready Queue.
        self.sequence = 0

    def run(self):
        """Executes the task until it yields or finishes."""
        try:
            # Advance the generator
            result = next(self.coro)
            return result
        except StopIteration:
            return TaskExit()
        except Exception as e:
            print(f"[KERNEL ERROR] Task '{self.name}' crashed: {e}")
            return TaskExit()

    def __lt__(self, other: 'Task'):
        """
        Comparison for Priority Queue (Min-Heap).
        1. Lower priority number = Higher importance.
        2. If priorities equal, use sequence (FIFO).
           Smaller sequence means it was added to the queue earlier.
        """
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.sequence < other.sequence

    def __repr__(self):
        return f"<Task {self.id}: {self.name} (Prio:{self.priority})>"

# --- The Cooperative Scheduler ---

class Scheduler:
    """
    A cooperative multitasking kernel.
    Uses a priority queue for ready tasks and a list for sleeping tasks.
    """
    def __init__(self):
        # Min-heap for tasks ready to run: (priority, sequence, task) logic via Task.__lt__
        self.ready_queue: List[Task] = []

        # List of (wake_time, task) for sleeping tasks
        self.sleeping_tasks: List[Tuple[float, Task]] = []

        self.is_running = False

        # Global counter to maintain FIFO order within priority levels
        self._sequence_generator = itertools.count()

    def log(self, message: str):
        """Simple logging mechanism with timestamp."""
        print(f"[{time.strftime('%H:%M:%S')}] {message}")

    def add_task(self, coro: Generator, name: str = "Task", priority: int = 10):
        """Add a new task to the scheduler."""
        new_task = Task(name, coro, priority)

        # Assign strict FIFO ordering for entry
        new_task.sequence = next(self._sequence_generator)

        heapq.heappush(self.ready_queue, new_task)
        self.log(f"Started: {new_task}")

    def _check_sleeping_tasks(self):
        """
        Checks if any sleeping tasks need to wake up.
        Moves them from sleeping_tasks to ready_queue.
        """
        now = time.time()
        active_sleepers = []
        for wake_time, task in self.sleeping_tasks:
            if now >= wake_time:
                # Update sequence so it goes to the back of the line for its priority
                task.sequence = next(self._sequence_generator)
                heapq.heappush(self.ready_queue, task)
                # self.log(f"Woke up: {task.name}")
            else:
                active_sleepers.append((wake_time, task))

        self.sleeping_tasks = active_sleepers

    def run(self):
        """The main event loop."""
        self.log("Scheduler started. Ctrl+C to stop.")
        self.is_running = True

        try:
            while self.is_running:
                # 1. Wake up tasks
                self._check_sleeping_tasks()

                # 2. Check if we have work to do
                if not self.ready_queue:
                    if not self.sleeping_tasks:
                        self.log("No tasks left. System halting.")
                        break
                    else:
                        # Idle loop: nothing ready, but tasks are sleeping.
                        time.sleep(0.01)
                        continue

                # 3. Context Switch: Get highest priority task
                current_task = heapq.heappop(self.ready_queue)

                # 4. Execute Task
                syscall = current_task.run()

                # 5. Handle System Call / Task Result
                if isinstance(syscall, TaskExit):
                    self.log(f"Finished: {current_task.name}")
                    # Task is dropped (garbage collected)

                elif isinstance(syscall, Sleep):
                    wake_time = time.time() + syscall.duration
                    self.sleeping_tasks.append((wake_time, current_task))

                elif isinstance(syscall, Yield):
                    # Voluntarily yielding.
                    # Update sequence to ensure Round-Robin
                    current_task.sequence = next(self._sequence_generator)
                    heapq.heappush(self.ready_queue, current_task)

                else:
                    # Task yielded something generic (implicit yield)
                    current_task.sequence = next(self._sequence_generator)
                    heapq.heappush(self.ready_queue, current_task)

        except KeyboardInterrupt:
            self.log("\nForce stopping scheduler.")