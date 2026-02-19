# Trajectory (Async Resource Pool Leak Stabilization)

## 1. Audit the Original Code (Identify Resource Leaks)

I audited the legacy event processing pipeline. It suffered from "fire-and-forget" async task spawning, improper resource lifecycle management, and manual transaction handling. This led to linear memory growth, file descriptor exhaustion ("Too many open files"), and database connection pool saturation ("idle in transaction").

**Key findings:**

- **Unbounded Concurrency:** `asyncio.create_task` was used without reference tracking, allowing tasks to pile up indefinitely during load spikes.
- **Leaked File Handles:** `aiofiles.open` was awaited directly without a context manager or `.close()` call, relying on GC which is too slow for high throughput.
- **Transaction Zombie States:** Manual `BEGIN` statements without guaranteed `COMMIT`/`ROLLBACK` paths caused connections to hang when errors occurred.

_I explored and understood about Asyncio Concurrency and RAII:_
[Python Asyncio Best Practices - Managing Tasks](https://docs.python.org/3/library/asyncio-task.html)

## 2. Define a Performance & Correctness Contract

I defined strict resource boundaries and correctness conditions:

- **Zero Leak Policy:** All file handles, network sessions, and DB connections must be returned to the OS/Pool immediately upon task completion (success or failure).
- **Bounded Concurrency:** The number of concurrent processing tasks must never exceed the database pool size (20) to prevent timeout queues.
- **Atomic Transactions:** Database operations must be atomic; no connection should ever be returned to the pool in a "dirty" state.
- **Graceful Shutdown:** All spawned tasks must be awaited and accounted for before the batch processor exits.

## 3. Rework the Architecture for Structured Concurrency

I introduced a **Semaphore-based pattern** and **Structured Concurrency**. Instead of allowing the event loop to accept infinite tasks, I injected a `Semaphore(20)` into the `EventProcessor`.

- **Logic Change:** Usage of `asyncio.gather` ensures the main loop waits for completion.
- **Resource Guard:** The Semaphore aligns the application throughput with the database's physical capacity, providing backpressure.

## 4. Refactor Resource Management (RAII Implementation)

I rewrote the core I/O handling to enforce **Resource Acquisition Is Initialization (RAII)** using Python's context managers (`async with`).

### A. File I/O (Audit Logs)

**Before:** Manual open/write (leaked on error or high load).
**After:** `async with aiofiles.open(...)` guarantees the file descriptor is flushed and closed immediately after the block exits.

### B. Database Transactions

**Before:** Manual `await conn.execute("BEGIN")` (error-prone).
**After:** `async with db_pool.transaction() as conn:`
This utilizes nested context managers to ensure that if an error occurs, the transaction is rolled back, and the connection is sanitized before returning to the pool.

### C. HTTP Client Lifecycle

**Before:** Single shared session that was implicitly initialized but never explicitly managed during lifecycle events.
**After:** Enforced `async with session.get(...)` to ensure response buffers are fully consumed and released.

## 5. Verify with Deterministic Resource Tracking

I replaced the standard functional tests with a **Resource Leak Detection Suite**.

- **Mock Injection:** I injected strict mocks into `sys.modules` to intercept every `open()`, `connect()`, and `task` creation.
- **Counting Strategy:** The test counts resources _before_ and _after_ a batch execution.
- **Invariant Check:**
  - `Open Files == 0`
  - `Active Transactions == 0`
  - `Pending Tasks ~= 0`

**Result:** The refactored solution processes batches with **0 leaked resources**, adheres to the concurrency limit (20), and passes the rigorous regression test suite where the legacy code failed because of resource leakage.
