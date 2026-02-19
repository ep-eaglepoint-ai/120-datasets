# Trajectory

- Thinking Process for Go Load Balancer Refactoring

### 1. Audit the Original Code (Identify Architectural & Concurrency Risks)

I audited the legacy code. It relied on global variables (`GlobalMutex`, `GlobalCounter`) which created hidden dependencies and contention. It used inefficient string concatenation in loops, blocking health checks without timeouts, and flat function calls that made observability impossible to inject. Crucially, it contained a latent race condition in the `temporaryStorage` buffer usage.

### 2. Define a Performance Contract First

I defined the new architectural standards: The solution must be **Middleware-First** (chaining logic), **Thread-Safe** (using Atomics and RWMutex), and **Zero-Allocation** where possible (reusing existing buffers).
_Constraint:_ No existing fields or constants can be deleted; they must be repurposed for functional utility.

### 3. Rework the Data Model for State Management

I centralized the scattered global state into a thread-safe Singleton `ConfigurationManager`.
I repurposed the legacy `configurationMap` to act as a **Server Health Metadata Cache** (preventing redundant checks).
I repurposed the `unusedField1` to serve as a **Max Retry Configuration**, giving a functional role to legacy data.

### 4. Rebuild Logic as a Middleware Pipeline

Instead of a monolithic `ServeTheRequest` function, I implemented the Decorator Pattern. The `ServerWrapper` now wraps a chain of `LoggingMiddleware` and `TelemetryMiddleware`. This ensures that logging and metrics are decoupled from the core proxying logic.

### 5. Move State to the Singleton (Centralization)

All "Magic Numbers" and request counters were moved into the `ConfigurationManager`. Access to the `GlobalCounter` was converted from a standard lock-based increment to `sync/atomic` operations (`atomic.AddInt64`), drastically reducing CPU contention during high load.

### 6. Use RWMutex Instead of Global Locks

The original code used a heavy `GlobalMutex` for everything. I refactored this into granular `sync.RWMutex` instances within `ServerImplementation`. This allows multiple readers (checking health/address) to access the server simultaneously, blocking only when a write (state update) occurs.

### 7. Stable Ordering + Deterministic Round Robin

I refactored the nondeterministic `while` loops into deterministic modular arithmetic (`index % count`). This ensures O(1) server selection time regardless of the number of servers, replacing the potentially infinite looping of the legacy logic.

### 8. Eliminate Race Conditions & Heap Allocations

I identified that `temporaryStorage` was being accessed concurrently by incoming HTTP requests. I strictly enforced a `stateMutex` around this buffer, converting it into a **Sampling Buffer** (Last Known Response inspection). This allows us to inspect response bodies without allocating new byte slices on the heap for every request.
_Optimization:_ Added `context.WithTimeout` to health checks to prevent "Goroutine Leaks" when upstream servers hang.

### 9. Optimize String Operations (Memory Alignment)

I replaced the character-by-character string concatenation loops (which generate garbage) with `strings.Builder` and `strings.TrimSpace`. This ensures memory alignment and reduces GC pressure during address resolution and ID parsing.

### 10. Result: Measurable Observability + Concurrency Safety

The solution now integrates structured telemetry, reuses memory buffers safely, and maintains 100% backward compatibility with the original data structures while adhering to modern Go idioms.
