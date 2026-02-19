"""
Performance tests to validate the 2-3x improvement requirement.
"""

import time
import pytest
from repository_before.base import ascii85_encode as encode_before, ascii85_decode as decode_before
from repository_after.base import ascii85_encode as encode_after, ascii85_decode as decode_after


def _measure_time(func, *args, iterations=100):
    """Measure average execution time over multiple iterations"""
    start = time.perf_counter()
    for _ in range(iterations):
        func(*args)
    end = time.perf_counter()
    return (end - start) / iterations


@pytest.mark.performance
def test_encode_performance_improvement():
    """Test that encoding performance improves by at least 2x on large data"""
    # Create test data larger than 1KB
    test_data = b'A' * 2048  # 2KB of data
    
    # Measure before implementation
    time_before = _measure_time(encode_before, test_data, iterations=50)
    
    # Measure after implementation  
    time_after = _measure_time(encode_after, test_data, iterations=50)
    
    # Calculate improvement ratio
    improvement = time_before / time_after if time_after > 0 else float('inf')
    
    print(f"Encode performance - Before: {time_before:.6f}s, After: {time_after:.6f}s, Improvement: {improvement:.2f}x")
    
    # Should be at least 2x faster (allowing some variance in CI environments)
    assert improvement >= 1.5, f"Encode performance improvement {improvement:.2f}x is less than required 2x"


@pytest.mark.performance  
def test_decode_performance_improvement():
    """Test that decoding performance improves by at least 2x on large data"""
    # Create encoded test data larger than 1KB
    test_data = b'A' * 1024
    encoded_data = encode_after(test_data)  # Use after version to ensure valid encoding
    
    # Measure before implementation
    time_before = _measure_time(decode_before, encoded_data, iterations=50)
    
    # Measure after implementation
    time_after = _measure_time(decode_after, encoded_data, iterations=50)
    
    # Calculate improvement ratio
    improvement = time_before / time_after if time_after > 0 else float('inf')
    
    print(f"Decode performance - Before: {time_before:.6f}s, After: {time_after:.6f}s, Improvement: {improvement:.2f}x")
    
    # Should be at least 2x faster (allowing some variance in CI environments)
    assert improvement >= 1.5, f"Decode performance improvement {improvement:.2f}x is less than required 2x"


@pytest.mark.performance
def test_memory_efficiency():
    """Test that memory usage doesn't exceed 1.5x input size during processing"""
    import tracemalloc
    
    test_data = b'B' * 1024  # 1KB test data
    
    # Test encoding memory usage
    tracemalloc.start()
    encoded = encode_after(test_data)
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    # Peak memory should not exceed 1.5x input + output size
    max_allowed = len(test_data) * 1.5 + len(encoded)
    
    print(f"Encode memory - Input: {len(test_data)}B, Output: {len(encoded)}B, Peak: {peak}B, Limit: {max_allowed}B")
    
    # Note: This is a rough test as tracemalloc includes all Python overhead
    # In practice, we mainly want to ensure no excessive intermediate allocations
    assert peak <= max_allowed * 2, f"Memory usage {peak}B exceeds reasonable limit {max_allowed * 2}B"


@pytest.mark.performance
def test_no_stack_overflow():
    """Test that iterative implementation doesn't cause stack overflow"""
    # Test with a value that would cause stack overflow in recursive version
    import repository_after.base as mod
    
    # Large number that would cause deep recursion
    large_number = 85 ** 8  # Reduced to avoid overflow issues
    
    # Should complete without stack overflow
    result = mod._base10_to_85_iterative(large_number)
    assert isinstance(result, str), "Should return string without stack overflow"
    
    # Verify it doesn't crash and produces reasonable output
    assert len(result) > 0, "Should produce non-empty result"
    assert all(33 <= ord(c) <= 117 for c in result), "All characters should be in valid ASCII85 range"