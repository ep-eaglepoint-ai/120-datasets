# Trajectory

# Trajectory: Refactoring the Distributed Lease Manager

## 1. Audit the Original Code (Identify Safety Violations)

I audited the existing `LeaseManager`. It was a naive stub that returned success immediately with a `0` token. It lacked locking mechanisms, fencing tokens, and heartbeat monitoring.

**Identified Risks:**

- **Zombie Workers:** Processes delayed by GC pauses could resume and commit stale data because they didn't know their lease had expired.
- **Race Conditions:** Multiple workers could believe they held the lock simultaneously.
- **Thundering Herd:** Any attempt to implement waiting via polling (sleep-loops) would hammer the storage backend.

**I read an interesting resource regarding distributed locking. The link is attached below:**

- _How to do distributed locking correctly (Martin Kleppmann):_ [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

## 2. Define the Safety Contract

Before writing code, I defined the strict performance and safety conditions required for a production-grade orchestrator:

- **Mutual Exclusion:** Only one worker holds the lock at any given nanosecond.
- **Fencing Tokens:** Every lease acquisition must return a monotonically increasing `int64` token to fence off stale writes at the storage layer.
- **Fail-Fast Revocation:** If the backend becomes unreachable (partition), the worker must be killed _before_ the lease expires on the server.
- **Event-Driven Waiting:** No polling. Use `Watch` channels to wake up exactly when a lock is released.

## 3. Rework the Data Model for State Management

I moved away from a stateless "Manager" to a stateful `Lease` object. The `Lease` struct now encapsulates the lifecycle of the lock.

- **Context Binding:** The `Lease` holds a `context.CancelFunc`. If the heartbeat fails, this context is canceled, immediately stopping the worker.
- **Atomic Release:** A specific closure is generated per lease to ensure we only delete the lock if we still own it (via `CompareAndDelete`).

```go
type Lease struct {
    Token   int64           // The Fencing Token
    Context context.Context // The lifecycle signal (cancels on partition)
    release func() error    // Closure for safe cleanup
}
```

## 4. Implementing the Watch-Based Wait Queue

To eliminate polling latency and ensure strict linearizability, I implemented a **watch-based acquisition loop** instead of a retry-with-sleep strategy.

### The Core Idea: Linearizable Acquisition Loop

Rather than repeatedly polling the store to check if a lease is available, contenders subscribe to changes on the lock key and block efficiently until a state transition occurs.

### Critical Logic Fix: The “Lost Notification” Race

**Initial Bug**

The first implementation started watching **only after** a failed acquisition attempt.
This introduced a subtle but dangerous race condition:

- Worker attempts `PutIfAbsent` → fails
- Lock is released **before** `Watch` starts
- Worker begins watching
- No event arrives → **deadlock**

The notification was lost because it occurred before the watch was active.

### Solution: Watch First, Then Attempt

The fix was to **reverse the order of operations**, ensuring no events are missed.

#### Correct Acquisition Flow

1. Start watching the key
2. Attempt `PutIfAbsent`
3. If successful → return lease
4. If failed → block on the watch channel (wait queue)

This guarantees that every state change is observed, eliminating the lost-notification race entirely.

---

## 5. Async-Safe Heartbeat Monitor

To prevent the worker from blocking on network I/O, lease renewal is handled by a **dedicated background goroutine**.

The main worker thread never waits on the store.

### Timing Strategy

- **Lease TTL**: `T`
- **Renewal Interval**: `T / 3`
  Frequent enough to survive scheduling jitter and GC pauses
- **Safety Window**: `T / 2`
  The “point of no return”

### The Fail-Fast Guarantee

If the heartbeat cannot confirm ownership within the safety window (using `CompareAndSwap`):

- A network partition is assumed
- The worker’s context is **immediately canceled**
- The worker exits before the lock can be reassigned server-side

This prevents **Zombie Workers**—clients that continue executing after losing ownership.

The client always dies _before_ the server can grant the lease to another owner.

---

## 6. Verification via Deterministic Simulation

Instead of relying on a real Etcd instance (which is unreliable in unit tests), I validated correctness using a **MockStore** capable of simulating:

- High contention
- Network partitions
- Deterministic timing

---

## 7. Final Result

The final **LeaseOrchestrator** provides **strict linearizability**.

It transforms wall-clock leases into **rigid execution lifecycles**, ensuring:

- Correctness under high concurrency
- Safety during network partitions
- Robustness against GC pauses and scheduler delays

This design guarantees data consistency even in the presence of real-world distributed system failures.

```

```
