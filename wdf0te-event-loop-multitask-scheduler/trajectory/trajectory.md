# Trajectory: event-loop-multitask-scheduler

## 1. Requirements & Constraint Analysis (The Audit)

I audited the project constraints to identify the architectural boundaries.
The requirement to avoid `threads` and `asyncio` immediately dictated the core mechanism: **Python Generators**.

- **Constraint: No OS-level threading**
  → Single-threaded event loop required.

- **Constraint: "Simulated delays" without blocking**
  → `time.sleep()` is forbidden in the loop; a **Wait Queue** strategy is required.

- **Constraint: Fairness & Priority**
  → A simple FIFO list is insufficient; a **Priority Queue (Min-Heap)** is necessary.

---

## 2. Define the Execution Contract

I defined the performance and behavioral conditions required for a valid scheduler:

- **Non-Blocking Contract**
  The scheduler must never halt the CPU for a sleeping task. It must check the clock and move on.

- **Priority Contract**
  Lower priority numbers (e.g., `1`) must execute before higher numbers (e.g., `10`).

- **Fairness Contract (Round-Robin)**
  Tasks with equal priority must cycle. One task yielding must go to the back of the line for its specific priority level to prevent starvation.

- **Safety Contract**
  A crashing task must not crash the kernel (scheduler).

---

## 3. Scaffold the Domain Model (Data Model Refactor)

I designed the data structures to support the contract efficiently, avoiding heavy object overhead.

- **The Task Object**
  A lightweight wrapper around the generator to store metadata (`id`, `priority`, `sequence`).

- **The System Call Interface**
  Instead of direct function calls, tasks yield objects (`Sleep`, `Yield`, `TaskExit`) to signal intent to the kernel.

- **The Ready Queue**
  Implemented using `heapq` (Min-Heap) for **O(log n)** access to the highest-priority task.

- **The Wait Queue**
  A simple list for sleeping tasks; wake-up checks run in **O(N)** per tick, acceptable for simulation purposes.

---

## 4. Implement the Event Loop (Projection-First Execution)

I built the main `run()` loop as a state machine that projects tasks into execution slots.

1. **Phase 1 – Wake**
   Check `sleeping_tasks`. If `now >= wake_time`, move the task to `ready_queue`.

2. **Phase 2 – Select**
   `heapq.heappop` selects the next task.

3. **Phase 3 – Execute**
   `next(task.coro)` runs user code until it yields.

4. **Phase 4 – Handle**
   Process the returned `SystemCall` (suspend, re-queue, or drop the task).

---

## 5. Verification & Iterative Correction (The Fix)

During the verification phase (running `test_scheduler.py`), a critical failure was detected in the **Fairness Contract**.

- **The Bug**
  The test `test_req_3_voluntary_yield` failed. Tasks with equal priority were not round-robin cycling; the same task kept running immediately after yielding.

- **The Root Cause**
  The `Task.sequence` value (used for tie-breaking in the heap) was static and set only at task creation. The heap always favored the older task, ignoring recent yields.

- **The Refactor: Dynamic Sequencing**

  - Introduced a global `_sequence_generator` in the Scheduler.
  - Every time a task is re-added to the queue (via `Yield` or wake-up), it receives a new sequence number.

- **Result**
  Yielded tasks are pushed to the back of the line within their priority tier, satisfying the fairness requirement.

---

## 6. Final Validation

- **Memory Efficiency**
  Confirmed that finished tasks are dropped from references, allowing Python’s garbage collector to reclaim memory.

- **Concurrency**
  Validated via logs that tasks interleave execution on the main thread without blocking.

- **Correctness**
  All tests passed, confirming that the scheduler correctly handles `Yield`, `Sleep`, and `Priority` according to the defined execution contract.
