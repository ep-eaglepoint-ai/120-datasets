"""
Comprehensive test suite for the Token Bucket Rate Limiter.

Tests cover all requirements:
1. Token Bucket algorithm implementation
2. Thread-safety with concurrent access
3. Lazy refill mechanism
4. Floating-point precision
5. O(1) memory complexity
6. Non-blocking behavior
7. Graceful handling of clock adjustments
8. Python standard library only
"""

import sys
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch

sys.path.insert(0, "/app")
from repository_after.rate_limiter import RateLimiter


class TestTokenBucketAlgorithm(unittest.TestCase):
    """Test Requirement 1: Token Bucket algorithm implementation."""

    def test_initial_tokens_equal_capacity(self):
        """Bucket starts with full capacity."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        self.assertEqual(limiter.tokens, 10.0)

    def test_tokens_consumed_on_allow_request(self):
        """Tokens are consumed when request is allowed."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        self.assertTrue(limiter.allow_request(1))
        self.assertAlmostEqual(limiter.tokens, 9.0, places=1)

    def test_request_denied_when_insufficient_tokens(self):
        """Request denied when not enough tokens."""
        limiter = RateLimiter(capacity=5, refill_rate=1)
        # Consume all tokens
        for _ in range(5):
            limiter.allow_request(1)
        # Next request should be denied
        self.assertFalse(limiter.allow_request(1))

    def test_tokens_never_exceed_capacity(self):
        """Tokens never exceed capacity after refill."""
        limiter = RateLimiter(capacity=10, refill_rate=100)
        time.sleep(0.2)  # Wait for potential refill
        self.assertLessEqual(limiter.tokens, 10.0)

    def test_tokens_never_go_negative(self):
        """Tokens never go below zero."""
        limiter = RateLimiter(capacity=5, refill_rate=0.1)
        # Try to consume more than available
        for _ in range(100):
            limiter.allow_request(1)
        self.assertGreaterEqual(limiter.tokens, 0.0)

    def test_partial_token_consumption(self):
        """Can consume fractional tokens."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        self.assertTrue(limiter.allow_request(0.5))
        self.assertAlmostEqual(limiter.tokens, 9.5, places=1)

    def test_burst_requests_allowed_up_to_capacity(self):
        """Burst of requests allowed up to bucket capacity."""
        limiter = RateLimiter(capacity=100, refill_rate=1)
        allowed = sum(1 for _ in range(100) if limiter.allow_request(1))
        self.assertEqual(allowed, 100)
        # Next request should fail
        self.assertFalse(limiter.allow_request(1))


class TestThreadSafety(unittest.TestCase):
    """Test Requirement 2: Thread-safe allow_request method."""

    def test_concurrent_requests_no_double_spend(self):
        """Concurrent calls must not consume more tokens than available."""
        limiter = RateLimiter(capacity=100, refill_rate=0.0001)  # Minimal refill
        allowed_count = [0]
        lock = threading.Lock()

        def make_request():
            if limiter.allow_request(1):
                with lock:
                    allowed_count[0] += 1

        threads = []
        for _ in range(200):
            t = threading.Thread(target=make_request)
            threads.append(t)

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Must not exceed capacity
        self.assertLessEqual(allowed_count[0], 100)
        self.assertEqual(allowed_count[0], 100)  # Exactly 100 allowed

    def test_high_concurrency_stress_test(self):
        """Stress test with high concurrency."""
        limiter = RateLimiter(capacity=1000, refill_rate=0.0001)
        allowed_count = [0]
        lock = threading.Lock()

        def worker():
            count = 0
            for _ in range(100):
                if limiter.allow_request(1):
                    count += 1
            with lock:
                allowed_count[0] += count

        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(worker) for _ in range(50)]
            for f in as_completed(futures):
                f.result()

        self.assertEqual(allowed_count[0], 1000)

    def test_thread_safety_with_refill(self):
        """Thread safety maintained during token refill."""
        limiter = RateLimiter(capacity=10, refill_rate=1000)
        errors = []

        def worker():
            try:
                for _ in range(100):
                    limiter.allow_request(1)
                    time.sleep(0.001)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(errors, [])
        self.assertGreaterEqual(limiter.tokens, 0)
        self.assertLessEqual(limiter.tokens, 10)


class TestLazyRefillMechanism(unittest.TestCase):
    """Test Requirement 3: Lazy refill mechanism."""

    def test_tokens_refill_over_time(self):
        """Tokens are added based on elapsed time."""
        limiter = RateLimiter(capacity=10, refill_rate=10)  # 10 tokens/sec
        limiter.allow_request(5)  # Consume 5 tokens
        time.sleep(0.3)  # Wait 300ms, should add ~3 tokens
        tokens = limiter.tokens
        self.assertGreater(tokens, 7.5)  # At least 5 + 2.5
        self.assertLessEqual(tokens, 10)  # Never exceed capacity

    def test_lazy_refill_calculated_on_access(self):
        """Refill only happens when bucket is accessed."""
        limiter = RateLimiter(capacity=10, refill_rate=100)
        limiter.allow_request(10)  # Empty the bucket
        
        # Don't access for a while
        time.sleep(0.05)
        
        # Access should trigger refill
        tokens_before = limiter._tokens  # Direct access before refill
        limiter.allow_request(1)  # This triggers refill
        
        # Some tokens should have been added
        self.assertGreater(limiter.tokens, 0)

    def test_no_background_threads(self):
        """Verify no background threads are created."""
        initial_thread_count = threading.active_count()
        limiters = [RateLimiter(capacity=10, refill_rate=1) for _ in range(10)]
        time.sleep(0.1)
        final_thread_count = threading.active_count()
        
        # Thread count should not increase significantly
        self.assertLessEqual(final_thread_count - initial_thread_count, 1)


class TestFloatingPointPrecision(unittest.TestCase):
    """Test Requirement 4: Floating-point arithmetic for precision."""

    def test_fractional_capacity(self):
        """Supports fractional capacity."""
        limiter = RateLimiter(capacity=10.5, refill_rate=1.0)
        self.assertEqual(limiter.capacity, 10.5)

    def test_fractional_refill_rate(self):
        """Supports fractional refill rate."""
        limiter = RateLimiter(capacity=10, refill_rate=0.5)
        self.assertEqual(limiter.refill_rate, 0.5)

    def test_sub_millisecond_precision(self):
        """Maintains sub-millisecond precision in refill calculations."""
        limiter = RateLimiter(capacity=1000, refill_rate=10000)  # 10 tokens/ms
        limiter.allow_request(1000)  # Empty bucket
        
        time.sleep(0.001)  # 1ms = ~10 tokens
        tokens = limiter.tokens
        
        # Should have some tokens added (within reasonable tolerance)
        self.assertGreater(tokens, 0)

    def test_floating_point_token_consumption(self):
        """Accurately consumes fractional tokens."""
        limiter = RateLimiter(capacity=10, refill_rate=0.001)
        self.assertTrue(limiter.allow_request(0.001))
        self.assertAlmostEqual(limiter.tokens, 9.999, places=3)

    def test_no_rate_drift_over_many_operations(self):
        """No significant drift over many small operations."""
        limiter = RateLimiter(capacity=1000, refill_rate=1000)
        
        # Perform many small operations
        for _ in range(100):
            limiter.allow_request(0.1)
            time.sleep(0.0001)
        
        # Should still be tracking correctly
        self.assertGreaterEqual(limiter.tokens, 0)
        self.assertLessEqual(limiter.tokens, 1000)


class TestMemoryComplexity(unittest.TestCase):
    """Test Requirement 5: O(1) memory complexity."""

    def test_constant_memory_after_many_requests(self):
        """Memory usage remains constant regardless of request count."""
        limiter = RateLimiter(capacity=10, refill_rate=1000)
        
        # Get initial state size
        initial_state = limiter.get_state()
        initial_attrs = len(vars(limiter))
        
        # Make many requests
        for _ in range(10000):
            limiter.allow_request(1)
        
        # State should still have same structure
        final_state = limiter.get_state()
        final_attrs = len(vars(limiter))
        
        self.assertEqual(initial_attrs, final_attrs)
        self.assertEqual(set(initial_state.keys()), set(final_state.keys()))

    def test_no_request_history_stored(self):
        """No history of individual requests is maintained."""
        limiter = RateLimiter(capacity=10, refill_rate=1000)
        
        for _ in range(1000):
            limiter.allow_request(1)
        
        # Check that limiter only stores essential state
        # Should only have: capacity, refill_rate, tokens, last_refill_time, lock
        attrs = [a for a in dir(limiter) if not a.startswith('__') and not callable(getattr(limiter, a))]
        self.assertLessEqual(len(attrs), 10)  # Reasonable number of attributes


class TestNonBlocking(unittest.TestCase):
    """Test Requirement 6: Non-blocking allow_request method."""

    def test_allow_request_returns_immediately(self):
        """allow_request returns without blocking."""
        limiter = RateLimiter(capacity=1, refill_rate=0.001)
        limiter.allow_request(1)  # Empty the bucket
        
        start = time.monotonic()
        result = limiter.allow_request(1)  # Should return False immediately
        elapsed = time.monotonic() - start
        
        self.assertFalse(result)
        self.assertLess(elapsed, 0.01)  # Less than 10ms

    def test_no_sleep_in_implementation(self):
        """Verify time.sleep is not used."""
        limiter = RateLimiter(capacity=1, refill_rate=1)
        
        # Measure time for many denied requests
        start = time.monotonic()
        for _ in range(1000):
            limiter.allow_request(1)
        elapsed = time.monotonic() - start
        
        # Should complete very quickly (no sleeping)
        self.assertLess(elapsed, 0.5)

    def test_immediate_boolean_return(self):
        """Returns boolean immediately, never blocks."""
        limiter = RateLimiter(capacity=5, refill_rate=0.001)
        
        results = []
        times = []
        
        for _ in range(10):
            start = time.monotonic()
            result = limiter.allow_request(1)
            elapsed = time.monotonic() - start
            results.append(result)
            times.append(elapsed)
        
        # All calls should be fast
        self.assertTrue(all(t < 0.01 for t in times))
        # First 5 should succeed, rest fail
        self.assertEqual(sum(results), 5)


class TestClockAdjustments(unittest.TestCase):
    """Test Requirement 7: Handle negative time deltas gracefully."""

    def test_negative_time_delta_no_crash(self):
        """System clock going backward doesn't cause crash."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        limiter.allow_request(5)
        
        # Simulate clock going backward by manipulating internal state
        limiter._last_refill_time = time.monotonic() + 100
        
        # Should not crash
        try:
            result = limiter.allow_request(1)
            # Should handle gracefully
            self.assertIsInstance(result, bool)
        except Exception as e:
            self.fail(f"Clock adjustment caused crash: {e}")

    def test_negative_time_delta_no_infinite_tokens(self):
        """Negative time delta doesn't add infinite tokens."""
        limiter = RateLimiter(capacity=10, refill_rate=1000000)
        limiter.allow_request(5)  # Now at 5 tokens
        
        # Simulate clock going backward
        limiter._last_refill_time = time.monotonic() + 1000
        
        # Make a request - should handle gracefully
        limiter.allow_request(1)
        
        # Tokens should never exceed capacity
        self.assertLessEqual(limiter.tokens, 10)

    def test_clock_adjustment_recovery(self):
        """System recovers after clock adjustment."""
        limiter = RateLimiter(capacity=10, refill_rate=10)
        limiter.allow_request(10)  # Empty bucket
        
        # Simulate clock adjustment (backward)
        limiter._last_refill_time = time.monotonic() + 10
        
        # Request should fail but not crash
        self.assertFalse(limiter.allow_request(1))
        
        # After time passes, should recover
        time.sleep(0.2)
        # Should now be able to get tokens
        self.assertGreater(limiter.tokens, 0)


class TestStandardLibraryOnly(unittest.TestCase):
    """Test Requirement 8: Python Standard Library only."""

    def test_no_external_imports(self):
        """Module uses only standard library."""
        import repository_after.rate_limiter as module
        
        # Get all imports
        import_names = []
        for name, obj in vars(module).items():
            if isinstance(obj, type(time)):  # It's a module
                import_names.append(name)
        
        standard_lib = {'threading', 'time', 'typing'}
        for name in import_names:
            self.assertIn(name, standard_lib, f"Non-standard import: {name}")


class TestEdgeCases(unittest.TestCase):
    """Additional edge case tests."""

    def test_zero_capacity_raises_error(self):
        """Zero capacity should raise ValueError."""
        with self.assertRaises(ValueError):
            RateLimiter(capacity=0, refill_rate=1)

    def test_negative_capacity_raises_error(self):
        """Negative capacity should raise ValueError."""
        with self.assertRaises(ValueError):
            RateLimiter(capacity=-1, refill_rate=1)

    def test_zero_refill_rate_raises_error(self):
        """Zero refill rate should raise ValueError."""
        with self.assertRaises(ValueError):
            RateLimiter(capacity=10, refill_rate=0)

    def test_negative_refill_rate_raises_error(self):
        """Negative refill rate should raise ValueError."""
        with self.assertRaises(ValueError):
            RateLimiter(capacity=10, refill_rate=-1)

    def test_zero_tokens_request_raises_error(self):
        """Requesting zero tokens should raise ValueError."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        with self.assertRaises(ValueError):
            limiter.allow_request(0)

    def test_negative_tokens_request_raises_error(self):
        """Requesting negative tokens should raise ValueError."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        with self.assertRaises(ValueError):
            limiter.allow_request(-1)

    def test_request_more_than_capacity(self):
        """Request for more tokens than capacity fails."""
        limiter = RateLimiter(capacity=5, refill_rate=1)
        self.assertFalse(limiter.allow_request(10))

    def test_very_small_capacity(self):
        """Works with very small capacity."""
        limiter = RateLimiter(capacity=0.001, refill_rate=1)
        self.assertTrue(limiter.allow_request(0.001))
        self.assertFalse(limiter.allow_request(0.001))

    def test_very_large_capacity(self):
        """Works with very large capacity."""
        limiter = RateLimiter(capacity=1e12, refill_rate=1)
        self.assertTrue(limiter.allow_request(1e6))

    def test_reset_method(self):
        """Reset restores bucket to full capacity."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        limiter.allow_request(10)
        self.assertAlmostEqual(limiter.tokens, 0, places=1)
        
        limiter.reset()
        self.assertEqual(limiter.tokens, 10)

    def test_try_acquire_alias(self):
        """try_acquire is alias for allow_request."""
        limiter = RateLimiter(capacity=10, refill_rate=1)
        self.assertTrue(limiter.try_acquire(1))
        self.assertAlmostEqual(limiter.tokens, 9, places=1)

    def test_get_state_returns_correct_values(self):
        """get_state returns correct current state."""
        limiter = RateLimiter(capacity=10, refill_rate=5)
        state = limiter.get_state()
        
        self.assertEqual(state["capacity"], 10)
        self.assertEqual(state["refill_rate"], 5)
        self.assertEqual(state["tokens"], 10)


class TestRapidBurstRequests(unittest.TestCase):
    """Test handling of rapid burst requests."""

    def test_burst_followed_by_steady(self):
        """Handles burst followed by steady rate."""
        limiter = RateLimiter(capacity=100, refill_rate=10)
        
        # Burst: consume 50 tokens quickly
        burst_allowed = sum(1 for _ in range(50) if limiter.allow_request(1))
        self.assertEqual(burst_allowed, 50)
        
        # Steady: wait and consume at refill rate
        time.sleep(0.5)  # Should refill ~5 tokens
        tokens = limiter.tokens
        self.assertGreater(tokens, 54)  # 50 + ~5

    def test_multiple_bursts(self):
        """Handles multiple burst periods."""
        limiter = RateLimiter(capacity=20, refill_rate=20)
        
        for burst in range(3):
            allowed = sum(1 for _ in range(20) if limiter.allow_request(1))
            if burst == 0:
                self.assertEqual(allowed, 20)
            time.sleep(0.5)  # Let it partially refill


if __name__ == "__main__":
    unittest.main()
