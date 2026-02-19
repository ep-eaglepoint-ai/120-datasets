import unittest
import sys
import os
import time
import threading

# --- Path Setup ---
# Add the 'repository_after' folder to the python path so we can import the scheduler
current_dir = os.path.dirname(os.path.abspath(__file__))
repo_path = os.path.join(current_dir, '..', 'repository_after')
sys.path.append(repo_path)
from repository_after.scheduler import Scheduler, Yield, Sleep


class TestCooperativeScheduler(unittest.TestCase):

    def setUp(self):
        """Setup a fresh scheduler instance for each test."""
        self.kernel = Scheduler()
        # We use a list to track execution order for assertions
        self.execution_log = []

    def test_task_completion_and_cleanup(self):
        """
            Implement a cooperative multitasking scheduler.
            Gracefully handle task completion and removal.
        """
        def simple_task():
            self.execution_log.append("Run")
            yield Yield()
            self.execution_log.append("Finish")
            # Generator exits naturally here (StopIteration)

        self.kernel.add_task(simple_task(), name="SimpleTask")
        self.kernel.run()

        # Check execution occurred
        self.assertEqual(self.execution_log, ["Run", "Finish"])

        # Check Cleanup (Req 9): queues should be empty
        self.assertEqual(len(self.kernel.ready_queue), 0)
        self.assertEqual(len(self.kernel.sleeping_tasks), 0)

    def test_no_threads(self):
        """
        Support multiple tasks without using threads.
        """
        def check_thread_task():
            # Record the thread name. Should be MainThread.
            self.execution_log.append(threading.current_thread().name)
            yield Yield()

        self.kernel.add_task(check_thread_task(), name="ThreadCheck1")
        self.kernel.add_task(check_thread_task(), name="ThreadCheck2")

        self.kernel.run()

        self.assertEqual(self.execution_log[0], "MainThread")
        self.assertEqual(self.execution_log[1], "MainThread")
        self.assertEqual(len(self.execution_log), 2)

    def test_voluntary_yield(self):
        """
            Tasks must voluntarily yield control to the scheduler.
        """
        def task_a():
            self.execution_log.append("A1")
            yield Yield() # Explicit yield, should switch to B
            self.execution_log.append("A2")

        def task_b():
            self.execution_log.append("B1")
            yield Yield()
            self.execution_log.append("B2")

        # Same priority, so they should round-robin via yield
        self.kernel.add_task(task_a(), name="A", priority=1)
        self.kernel.add_task(task_b(), name="B", priority=1)

        self.kernel.run()

        # Expected: A starts, yields -> B starts, yields -> A resumes -> B resumes
        self.assertEqual(self.execution_log, ["A1", "B1", "A2", "B2"])

    def test_priority_scheduling(self):
        """
        Requirement 4: Support task priorities and ensure fair scheduling.
        """
        def high_prio_task():
            self.execution_log.append("High")
            yield Yield()

        def low_prio_task():
            self.execution_log.append("Low")
            yield Yield()

        # Add Low priority first (Higher number = Lower priority)
        self.kernel.add_task(low_prio_task(), name="Low", priority=20)
        # Add High priority second (Lower number = Higher priority)
        self.kernel.add_task(high_prio_task(), name="High", priority=1)

        self.kernel.run()

        # Scheduler must pick High first despite it being added last
        self.assertEqual(self.execution_log, ["High", "Low"])

    def test_simulated_delays(self):
        """
        Requirement 5: Handle simulated delays or “sleep” without blocking.
        """
        def sleeper_task():
            self.execution_log.append("SleepStart")
            yield Sleep(0.2) # Sleep 200ms
            self.execution_log.append("SleepEnd")

        def worker_task():
            # This task should run while the other is sleeping
            self.execution_log.append("Work")
            yield Yield()

        self.kernel.add_task(sleeper_task(), name="Sleeper", priority=1)
        self.kernel.add_task(worker_task(), name="Worker", priority=2) # Lower priority than sleeper

        start_time = time.time()
        self.kernel.run()
        duration = time.time() - start_time

        # Logic check:
        # 1. Sleeper runs, prints SleepStart, yields Sleep.
        # 2. Scheduler removes Sleeper from ready queue.
        # 3. Worker runs (because Scheduler isn't blocked), prints Work.
        # 4. ~0.2s passes.
        # 5. Sleeper wakes up, prints SleepEnd.
        self.assertEqual(self.execution_log, ["SleepStart", "Work", "SleepEnd"])

        # Verify it actually waited roughly 0.2 seconds
        self.assertTrue(duration >= 0.2, f"Simulation ran too fast: {duration}s")

    def test_starvation_and_deadlock_prevention(self):
        """
        Requirement 6: Prevent deadlocks and starvation; tasks can run indefinitely safely.
        (We simulate 'indefinite' with a finite loop to allow the test to finish,
        checking that the scheduler keeps cycling).
        """
        def cycling_task(name, cycles):
            for _ in range(cycles):
                self.execution_log.append(name)
                yield Yield()

        # We add two tasks. If the scheduler deadlocked or starved one,
        # we wouldn't see the alternating pattern.
        self.kernel.add_task(cycling_task("A", 3), priority=1)
        self.kernel.add_task(cycling_task("B", 3), priority=1)

        self.kernel.run()

        # Check that both got to run their full cycles interleaved
        self.assertEqual(self.execution_log.count("A"), 3)
        self.assertEqual(self.execution_log.count("B"), 3)
        # Should look like A, B, A, B, A, B
        self.assertEqual(self.execution_log, ["A", "B", "A", "B", "A", "B"])

    def test_memory_efficiency_stress(self):
        """
        Requirement 8: Use memory efficiently; avoid unnecessary objects or lists.
        We stress test by adding many short-lived tasks and checking the queue size afterwards.
        """
        def quick_task():
            yield Yield()

        # Add 1000 tasks
        for i in range(1000):
            self.kernel.add_task(quick_task(), name=f"T{i}")

        self.kernel.run()

        self.assertEqual(len(self.kernel.ready_queue), 0)
        self.assertEqual(len(self.kernel.sleeping_tasks), 0)

if __name__ == '__main__':
    print("Running Scheduler Unit Tests...")
    unittest.main()