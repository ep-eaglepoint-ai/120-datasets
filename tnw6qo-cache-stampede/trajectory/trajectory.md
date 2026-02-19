# Cache Stampede Prevention

## Problem
When a cache misses, multiple threads compute the same expensive value simultaneously—wasting resources and causing inconsistent failures.

## Constraints
- No busy waiting, background threads, thread pools, or global locks
- Java standard library only

## Approach
Use `ConcurrentHashMap<K, CompletableFuture<V>>` with atomic `putIfAbsent` to elect one computation leader per key. Others wait on the shared future.

## Flow
```
Thread A: putIfAbsent(key, future) → null → compute → complete → cleanup
Thread B: putIfAbsent(key, future) → existing → wait → receive result
```

## Components
- `SingleFlightCache.java` - coordination logic
- `ComputeFunction.java` - computation interface
- `ComputationException.java` - failure wrapper

## Test Coverage
| Requirement | Test |
|-------------|------|
| Single execution per key | `testConcurrentAccessComputesOnce` |
| Same result for all | `testConcurrentCallersReceiveSameResult` |
| Failure propagation | `testFailurePropagatedToAllCallers` |
| Key isolation | `testDifferentKeysDoNotBlock` |
| High concurrency | `testHighConcurrencyMultipleKeys` |
| No repeat on failure | `testFailureDoesNotRepeatDuringSameRequest` |
| Cleanup | `testCleanupAfterSuccess/Failure` |

## Trade-offs
- No timeout handling (callers can add their own)
- No result caching (separate concern)
- Memory for CompletableFuture objects (acceptable)

## Why It Works
`putIfAbsent` is atomic—only one thread wins. `CompletableFuture.get()` parks threads efficiently without busy waiting. `remove(key, future)` ensures safe cleanup.
