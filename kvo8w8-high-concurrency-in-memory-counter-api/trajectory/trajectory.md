# Trajectory: High Concurrency Counter API Optimization

## 1. Audit / Requirements Analysis (What is the actual problem?)

The current counter API uses an in-memory HashMap to track event counts. My first intuition was to use Java atomics and locking-based safe concurrency control, but then I realized it should have to be horizontally scalable so we can't use any in-memory state. I then tried to use SQL but then SQL is not that fast when accessing data frequently, so I ended up using Redis.

Initial observations reveal several critical issues:

- **Race conditions**: Multiple threads accessing HashMap simultaneously cause lost updates
- **No thread safety**: HashMap is not thread-safe, leading to data corruption under load
- **Horizontal scaling failure**: Each instance maintains separate state, breaking distributed deployments
- **Memory-only persistence**: Restarts lose all counter data

Root cause analysis shows this isn't just a performance issue—it's a fundamental architecture problem. The system violates basic concurrency principles and cannot scale beyond a single instance.

## 2. Question Assumptions (Why are we doing this?)

Original thinking: "We need to make the HashMap thread-safe with AtomicInteger or synchronized blocks"
Reality: "We need external, atomic state management that works across multiple instances"
Conclusion: "In-memory solutions cannot solve horizontal scaling, and SQL databases are too slow for frequent counter operations"

The real question isn't how to fix HashMap concurrency, but whether we should use local state at all. Redis provides atomic operations (INCR, GET) that solve both thread safety and horizontal scaling simultaneously while maintaining high performance for frequent access patterns.

## 3. Define Success Criteria (What does 'better' mean?)

**Concurrency**:
- Before: Race conditions cause lost increments under load
- After: 100 concurrent requests produce correct final count

**Statelessness**:
- Before: Controller stores state in instance memory
- After: Controller delegates all state to Redis

**Horizontal Scaling**:
- Before: Multiple instances have separate counter states
- After: All instances share single Redis state

**API Preservation**:
- Before: Existing endpoints and response format
- After: Identical endpoints and response format maintained

## 4. Map Requirements to Validation (How will we prove correctness?)

**Concurrency Tests**: Execute 100 parallel increments, verify final count equals 100
**Statelessness Tests**: Restart controller, verify counters persist
**Scaling Tests**: Multiple instances increment same counter, verify shared state
**API Contract Tests**: Verify response structure unchanged
**Regression Tests**: Ensure existing functionality preserved

Expected behavior: repository_before fails concurrency/scaling tests, repository_after passes all tests.

## 5. Scope the Solution (What is the smallest edit?)

**Remove**:
- In-memory HashMap field
- Manual increment logic
- Local state management

**Add**:
- Redis dependency and configuration
- RedisTemplate autowiring
- Atomic Redis operations (INCR, GET, DBSIZE)

**Modify**:
- increment() method to use Redis INCR
- getCount() method to use Redis GET
- Response building to use Redis results

Net change: ~15 lines removed, ~20 lines added, external Redis dependency.

## 6. Trace Data/Control Flow (How does flow change?)

**Before**:
Request → Controller → HashMap.get() → HashMap.put() → Response

**After**:
Request → Controller → Redis.INCR() → Response

The flow eliminates local state access entirely. Redis operations are atomic, removing the need for manual synchronization or state management.

## 7. Anticipate Objections (What could go wrong?)

**Objection 1**: "Redis adds external dependency complexity"
Counter: Redis is industry-standard for distributed state. The complexity of managing thread-safe local state exceeds Redis operational overhead.

**Objection 2**: "Network latency will hurt performance"
Counter: Redis operations are sub-millisecond. The current solution's race conditions cause incorrect results, making performance irrelevant.

**Objection 3**: "What if Redis goes down?"
Counter: The current solution loses all data on restart anyway. Redis provides persistence and high availability options.

## 8. Verify Invariants (What must remain true?)

**Must preserve**:
- API endpoints (/api/counter/increment/{name}, /api/counter/count/{name}) ✓
- Response JSON structure (name, count, totalKeys) ✓
- HTTP status codes and error handling ✓

**Must improve**:
- Thread safety under concurrent access ✓ (Redis atomic operations)
- Horizontal scaling capability ✓ (shared Redis state)
- Data consistency ✓ (no race conditions)

**Must not break**:
- Existing client integrations ✓ (API unchanged)
- Response field types ✓ (integers remain integers)

## 9. Execute with Surgical Precision (Implementation order)

**Step 1**: Add Redis configuration and dependencies
- Why first? Establishes foundation without breaking existing code
- Risk: Low - configuration only, no logic changes

**Step 2**: Replace HashMap with RedisTemplate injection
- Why second? Prepares controller for Redis operations
- Risk: Medium - changes controller structure

**Step 3**: Replace increment logic with Redis INCR
- Why third? Core functionality change, most critical
- Risk: High - changes business logic

**Step 4**: Replace getCount logic with Redis GET
- Why fourth? Completes state management migration
- Risk: Medium - affects read operations

**Step 5**: Update totalKeys calculation with Redis DBSIZE
- Why last? Non-critical feature, can be adjusted
- Risk: Low - cosmetic response field

## 10. Measure Impact (Did we actually improve?)

**Concurrency**:
- Thread safety: HashMap (unsafe) → Redis atomic operations (safe)
- Lost updates: Frequent under load → Zero (atomic INCR)

**Scalability**:
- Instance isolation: Each has separate state → Shared Redis state
- Horizontal scaling: Impossible → Fully supported

**Test Results**:
- Concurrent test: Fails on before → Passes on after
- Statelessness test: Fails on before → Passes on after
- API contract tests: Pass on both (preserved)

## 11. Document the Decision (Context for future)

**Problem**: In-memory HashMap caused race conditions and prevented horizontal scaling
**Solution**: Redis atomic operations provide thread-safe, distributed state management
**Trade-offs**: Added external dependency for guaranteed correctness and scalability
**Why this works**: Redis INCR is atomic, eliminating race conditions while enabling shared state across instances
**When to revisit**: If Redis becomes a bottleneck (unlikely) or if requirements change to need complex state operations
**Test Coverage**: Comprehensive concurrency, statelessness, and scaling validation ensures transformation success