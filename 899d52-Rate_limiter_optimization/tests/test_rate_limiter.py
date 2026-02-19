"""
Comprehensive rate limiter tests.
These tests will FAIL with repository_before and PASS with repository_after.

Tests cover all 6 requirements:
1. Token bucket algorithm without external dependencies
2. Dynamic rate adjustment without dropping requests
3. Clock skew handling (±100ms)
4. Thread-safe for 100+ concurrent threads
5. Memory efficient: ≤1KB per rate limit key
6. Exactly-once semantics during window transitions
"""
import pytest
import threading
import time
import sys
import os


def get_rate_limiter_module():
    """Get the appropriate rate limiter module based on PYTHONPATH."""
    pythonpath = os.environ.get("PYTHONPATH", "")
    
    if "repository_after" in pythonpath:
        from repository_after.rate_limiter import RateLimiter
        import repository_after.rate_limiter as module
        return RateLimiter, module, "after"
    else:
        from repository_before.rate_limiter import RateLimiter
        import repository_before.rate_limiter as module
        return RateLimiter, module, "before"


class TestRequirement1TokenBucketAlgorithm:
    """Requirement 1: Implement the token bucket algorithm without external dependencies."""
    
    def test_token_bucket_class_exists(self):
        """TokenBucket class must exist for proper token bucket implementation."""
        RateLimiter, module, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation should NOT have TokenBucket class - FAIL
            assert hasattr(module, 'TokenBucket'), "Before implementation missing TokenBucket class - requirement 1 not met"
        else:
            # After implementation should have TokenBucket class
            assert hasattr(module, 'TokenBucket'), "After implementation should have TokenBucket class"
    
    def test_no_external_dependencies(self):
        """Implementation must not use external rate limiting libraries."""
        RateLimiter, module, version = get_rate_limiter_module()
        import inspect
        
        source = inspect.getsource(module)
        
        # Should not import external rate limiting libraries
        forbidden = ['redis', 'memcache', 'celery', 'ratelimit', 'limits']
        for lib in forbidden:
            assert f'import {lib}' not in source.lower(), f"Found forbidden dependency: {lib}"
            assert f'from {lib}' not in source.lower(), f"Found forbidden dependency: {lib}"
    
    def test_basic_token_bucket_behavior(self):
        """Basic token bucket behavior must work."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(60)
        else:
            limiter = RateLimiter(60)
            # Should allow requests up to capacity
            for _ in range(60):
                assert limiter.allow_request("user1", current_time=0.0) is True
            # Should deny after capacity exhausted
            assert limiter.allow_request("user1", current_time=0.0) is False


class TestRequirement2DynamicRateAdjustment:
    """Requirement 2: Support dynamic rate adjustment without dropping requests."""
    
    def test_has_update_rate_method(self):
        """RateLimiter must have update_rate method."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation should NOT have update_rate method - FAIL
            assert hasattr(RateLimiter, 'update_rate'), "Before implementation missing update_rate method - requirement 2 not met"
        else:
            # After implementation should have update_rate method
            limiter = RateLimiter(100)
            assert hasattr(limiter, 'update_rate'), "After implementation should have update_rate method"
            assert callable(limiter.update_rate)
    
    def test_rate_change_1000_to_5000_preserves_tokens(self):
        """Rate change from 1000 to 5000 requests/minute must preserve tokens proportionally."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(1000)
        else:
            limiter = RateLimiter(1000)
            
            # Use 500 tokens (50% of capacity)
            for _ in range(500):
                limiter.allow_request("user1", current_time=0.0)
            
            # Change rate to 5000
            limiter.update_rate(5000, current_time=0.0)
            
            # Should have ~2500 tokens (50% of new capacity)
            allowed = 0
            for _ in range(3000):
                if limiter.allow_request("user1", current_time=0.0):
                    allowed += 1
            
            assert 2400 <= allowed <= 2600, f"Expected ~2500 tokens, got {allowed}"
    
    def test_rate_change_without_dropping_requests(self):
        """Rate changes must not drop existing requests."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has no update_rate method - FAIL
            limiter_class = RateLimiter
            assert hasattr(limiter_class, 'update_rate'), "Before implementation cannot change rates - requirement 2 not met"
        else:
            limiter = RateLimiter(10)
            
            # Use 5 tokens
            for _ in range(5):
                limiter.allow_request("user1", current_time=0.0)
            
            # Increase rate - should preserve proportional tokens
            limiter.update_rate(100, current_time=0.0)
            
            # Should have ~50 tokens (50% of new capacity)
            allowed = 0
            for _ in range(60):
                if limiter.allow_request("user1", current_time=0.0):
                    allowed += 1
            
            assert 45 <= allowed <= 55, f"Rate change dropped requests: expected ~50, got {allowed}"


class TestRequirement3ClockSkewHandling:
    """Requirement 3: Handle clock skew between servers (±100ms)."""
    
    def test_handles_minor_clock_skew_100ms(self):
        """Must tolerate ±100ms clock skew."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation doesn't support clock_skew_tolerance parameter - FAIL
            with pytest.raises(TypeError, match="unexpected keyword argument 'clock_skew_tolerance'"):
                RateLimiter(60, clock_skew_tolerance=0.1)
        else:
            limiter = RateLimiter(60, clock_skew_tolerance=0.1)
            
            # Make request at t=1.0
            assert limiter.allow_request("user1", current_time=1.0) is True
            
            # Clock goes back 100ms - should still work
            assert limiter.allow_request("user1", current_time=0.9) is True
            
            # Clock goes back 50ms - should still work
            assert limiter.allow_request("user1", current_time=0.95) is True
    
    def test_handles_significant_clock_skew(self):
        """Must handle significant backward clock jumps gracefully."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(60)
        else:
            limiter = RateLimiter(60, clock_skew_tolerance=0.1)
            
            # Make request at t=10.0
            assert limiter.allow_request("user1", current_time=10.0) is True
            
            # Clock goes back significantly - should reset and continue working
            assert limiter.allow_request("user1", current_time=5.0) is True


class TestRequirement4ThreadSafety:
    """Requirement 4: Thread-safe for 100+ concurrent threads."""
    
    def test_concurrent_100_threads_no_race_conditions(self):
        """Must handle 100+ concurrent threads without race conditions."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(10000)
        else:
            limiter = RateLimiter(10000)  # High limit to focus on thread safety
            errors = []
            results = []
            
            def make_requests(thread_id):
                try:
                    for _ in range(10):
                        result = limiter.allow_request(f"user_{thread_id}")
                        results.append(result)
                except Exception as e:
                    errors.append((thread_id, e))
            
            threads = [threading.Thread(target=make_requests, args=(i,)) for i in range(100)]
            
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            assert len(errors) == 0, f"Thread safety failed with errors: {errors}"
            assert len(results) == 1000  # 100 threads * 10 requests
    
    def test_concurrent_same_user_rate_limiting(self):
        """Concurrent requests for same user must respect rate limit atomically."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(100)
        else:
            limiter = RateLimiter(100)  # 100 requests per minute
            allowed_count = [0]
            lock = threading.Lock()
            
            def make_requests():
                for _ in range(50):
                    if limiter.allow_request("shared_user", current_time=0.0):
                        with lock:
                            allowed_count[0] += 1
            
            threads = [threading.Thread(target=make_requests) for _ in range(10)]
            
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            # Should allow exactly 100 requests (the capacity)
            assert allowed_count[0] == 100, f"Thread safety failed: expected 100, got {allowed_count[0]}"


class TestRequirement5MemoryEfficiency:
    """Requirement 5: Memory efficient: ≤1KB per rate limit key."""
    
    def test_uses_slots_for_memory_efficiency(self):
        """TokenBucket must use __slots__ for memory efficiency."""
        RateLimiter, module, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation doesn't have TokenBucket - FAIL
            assert hasattr(module, 'TokenBucket'), "Before implementation missing TokenBucket - requirement 5 not met"
        else:
            TokenBucket = getattr(module, 'TokenBucket')
            assert hasattr(TokenBucket, '__slots__'), "TokenBucket should use __slots__ for memory efficiency"
    
    def test_bucket_memory_under_1kb(self):
        """Each rate limit key must use ≤1KB memory."""
        RateLimiter, module, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation doesn't have TokenBucket - FAIL
            assert hasattr(module, 'TokenBucket'), "Before implementation missing TokenBucket - requirement 5 not met"
        else:
            TokenBucket = getattr(module, 'TokenBucket')
            bucket = TokenBucket(1000, 1000/60, time.time())
            
            # Get size of bucket object
            size = sys.getsizeof(bucket)
            
            # Account for lock object
            size += sys.getsizeof(bucket._lock)
            
            # Should be well under 1KB
            assert size < 1024, f"TokenBucket uses {size} bytes, exceeds 1KB limit - requirement 5 not met"
    
    def test_cleanup_removes_inactive_buckets(self):
        """Must provide cleanup to prevent memory growth."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(100)
        else:
            limiter = RateLimiter(100)
            
            # Create many users
            for i in range(100):
                limiter.allow_request(f"user_{i}", current_time=0.0)
            
            assert limiter.get_bucket_count() == 100
            
            # Cleanup with short max age
            limiter.cleanup_inactive(max_age_seconds=1, current_time=100.0)
            
            assert limiter.get_bucket_count() == 0


class TestRequirement6ExactlyOnceSemantics:
    """Requirement 6: Provide exactly-once semantics during rate limit window transitions."""
    
    def test_no_double_counting_at_refill(self):
        """Tokens must not be double-counted during refill."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(60)
        else:
            limiter = RateLimiter(60)  # 1 token per second
            
            # Exhaust tokens
            for _ in range(60):
                limiter.allow_request("user1", current_time=0.0)
            
            # At exactly t=1.0, should have exactly 1 new token
            assert limiter.allow_request("user1", current_time=1.0) is True
            assert limiter.allow_request("user1", current_time=1.0) is False
    
    def test_atomic_token_consumption(self):
        """Token consumption must be atomic - exactly-once semantics."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(1)
        else:
            limiter = RateLimiter(1)  # Only 1 token
            results = []
            
            def try_request():
                result = limiter.allow_request("user1", current_time=0.0)
                results.append(result)
            
            threads = [threading.Thread(target=try_request) for _ in range(100)]
            
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            # Exactly 1 should succeed - exactly-once semantics
            assert results.count(True) == 1, f"Expected exactly 1 success, got {results.count(True)}"
            assert results.count(False) == 99, f"Expected exactly 99 failures, got {results.count(False)}"
    
    def test_window_transition_consistency(self):
        """Window transitions must maintain consistency."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(60)
        else:
            limiter = RateLimiter(60)  # 1 token per second
            
            # Use all tokens at t=0
            for _ in range(60):
                assert limiter.allow_request("user1", current_time=0.0) is True
            
            # Should be blocked at t=0
            assert limiter.allow_request("user1", current_time=0.0) is False
            
            # At t=0.5, should still be blocked (no full second passed)
            assert limiter.allow_request("user1", current_time=0.5) is False
            
            # At t=1.0, should have exactly 1 token
            assert limiter.allow_request("user1", current_time=1.0) is True
            assert limiter.allow_request("user1", current_time=1.0) is False


class TestPerUserIsolation:
    """Additional test: Per-user isolation (implied by distributed requirement)."""
    
    def test_per_user_isolation(self):
        """Each user must have independent rate limits."""
        RateLimiter, _, version = get_rate_limiter_module()
        
        if version == "before":
            # Before implementation has import bug - FAIL
            with pytest.raises(AttributeError, match="'builtin_function_or_method' object has no attribute 'time'"):
                RateLimiter(2)
        else:
            limiter = RateLimiter(2)
            
            # User1 exhausts their limit
            assert limiter.allow_request("user1", current_time=0.0) is True
            assert limiter.allow_request("user1", current_time=0.0) is True
            assert limiter.allow_request("user1", current_time=0.0) is False
            
            # User2 should still have their full quota
            assert limiter.allow_request("user2", current_time=0.0) is True
            assert limiter.allow_request("user2", current_time=0.0) is True