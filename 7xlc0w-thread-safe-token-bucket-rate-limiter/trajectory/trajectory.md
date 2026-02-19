# Trajectory (Thinking Process for Token Bucket Rate Limiter)

## 1. Audit the Requirements (Identify Core Constraints)

I audited the requirements for the rate limiter. The system needed to handle thousands of concurrent requests with zero race conditions, use lazy refill instead of background threads, maintain O(1) memory, and work with Python standard library only.

Key constraints identified:
- Token Bucket algorithm specifically (not Leaky Bucket or Fixed Window)
- Thread-safe `allow_request()` preventing double-spend
- Non-blocking immediate boolean return
- Floating-point precision for sub-millisecond accuracy
- Graceful handling of clock adjustments

## 2. Define a Correctness Contract First

I defined correctness conditions before implementation:
- Tokens must never exceed capacity after refill
- Tokens must never go negative after consumption
- Concurrent threads must not consume more tokens than available
- `allow_request()` must complete in microseconds, never block
- Clock going backward must not crash or add infinite tokens

Reference for thread-safe design patterns:
- Python threading.RLock for reentrant locking
- Atomic check-and-consume pattern

## 3. Design the Data Model for Efficiency

I designed a minimal state model with O(1) memory:
```python
_capacity: float      # Maximum bucket size
_refill_rate: float   # Tokens per second
_tokens: float        # Current token count
_last_refill_time: float  # Monotonic timestamp
_lock: RLock          # Thread synchronization
```

No request history stored. Only current state maintained.

## 4. Implement Lazy Refill Mechanism

The refill calculation happens on-demand during `allow_request()`:
```python
time_delta = current_time - last_refill_time
tokens_to_add = time_delta * refill_rate
tokens = min(capacity, tokens + tokens_to_add)
```

This eliminates background threads and timer overhead.

Reference for monotonic time:
- `time.monotonic()` immune to system clock adjustments
- Negative deltas handled by skipping token addition

## 5. Implement Thread-Safe Token Consumption

The `allow_request()` method uses atomic check-and-consume:
```python
with self._lock:
    self._refill()
    if self._tokens >= tokens:
        self._tokens -= tokens
        return True
    return False
```

`RLock` chosen over `Lock` to allow reentrant access from property getters.

## 6. Handle Edge Cases Gracefully

Edge cases addressed:
- Zero/negative capacity → ValueError
- Zero/negative refill rate → ValueError
- Zero/negative token request → ValueError
- Request exceeding capacity → Returns False
- Clock adjustment (negative delta) → Skip refill, update timestamp
- Very small/large values → Floating-point handles correctly

## 7. Build Comprehensive Test Suite

Test categories covering all 8 requirements:
- `TestTokenBucketAlgorithm` - Core algorithm correctness
- `TestThreadSafety` - Concurrent access with 50 threads
- `TestLazyRefillMechanism` - No background threads
- `TestFloatingPointPrecision` - Sub-millisecond accuracy
- `TestMemoryComplexity` - O(1) verification
- `TestNonBlocking` - Immediate return verification
- `TestClockAdjustments` - Negative delta handling
- `TestStandardLibraryOnly` - Import verification
- `TestEdgeCases` - Boundary conditions
- `TestRapidBurstRequests` - Burst handling

## 8. Result: Verified Implementation

Final verification:
- 41 tests passing
- Thread safety verified with 5000 concurrent requests
- Non-blocking confirmed (< 10ms per call)
- Memory constant regardless of request count
- Standard library only (threading, time, typing)

## Files Created

| File | Purpose |
|------|---------|
| `repository_after/rate_limiter.py` | RateLimiter class implementation |
| `repository_after/__init__.py` | Module exports |
| `tests/test_rate_limiter.py` | 41 comprehensive tests |
| `evaluation/evaluation.py` | Test runner and JSON report generator |

## Verification Commands

```bash
docker compose build
docker compose run --rm app pytest tests/ -v
docker compose run --rm app python evaluation/evaluation.py
```
