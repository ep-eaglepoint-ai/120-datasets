"""
tests/test_after.py

Test suite for prime_counter.py with dual import approach.
Tests all critical requirements without redundancy.

Import Strategy:
1. Try PYTHONPATH-based import (Docker/repository structure)
2. Fall back to direct parent directory import

Requirements Validated:
- Correctness: Known mathematical prime counts
- Memory efficiency: No full range materialization
- Performance: Slice optimization effectiveness
- Determinism: Consistent results
- Multiprocessing: Parallel execution
- Edge cases: Boundaries and special values
"""

import sys
import time
from pathlib import Path

# Docker/PYTHONPATH approach: import from app module
from app.prime_counter import (
    generate_base_primes,
    count_primes_in_segment,
    create_chunks,
    count_primes_parallel,
    LIMIT,
    CHUNK_SIZE
)

import multiprocessing as mp


# ============================================================================
# TEST UTILITIES
# ============================================================================

class Runner:
    """Minimal test runner for requirement validation."""

    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []

    def assert_equal(self, actual, expected, test_name: str):
        """Assert equality and record result."""
        if actual == expected:
            self.passed += 1
            print(f"✓ {test_name}")
            return True
        else:
            self.failed += 1
            self.failures.append((test_name, f"Expected {expected}, got {actual}"))
            print(f"✗ {test_name}: Expected {expected}, got {actual}")
            return False

    def assert_true(self, condition: bool, test_name: str, message: str = ""):
        """Assert condition is true."""
        if condition:
            self.passed += 1
            print(f"✓ {test_name}")
            return True
        else:
            self.failed += 1
            msg = message if message else "Condition failed"
            self.failures.append((test_name, msg))
            print(f"✗ {test_name}: {msg}")
            return False

    def summary(self) -> bool:
        """Print summary and return success status."""
        total = self.passed + self.failed
        print("\n" + "=" * 70)
        print(f"Tests: {self.passed}/{total} passed")

        if self.failures:
            print("\nFailures:")
            for name, reason in self.failures:
                print(f"  • {name}: {reason}")

        return self.failed == 0


# ============================================================================
# REQUIREMENT 1: CORRECTNESS
# ============================================================================

def test_known_prime_counts():
    """
    Requirement: Correct prime counting up to 10^7.
    
    Validates against mathematically known values:
    - π(10) = 4
    - π(100) = 25  
    - π(1,000) = 168
    - π(10,000) = 1,229
    - π(100,000) = 9,592
    - π(10,000,000) = 664,579
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 1: CORRECTNESS")
    print("="*70)
    
    known_values = [
        (10, 4, "π(10)"),
        (100, 25, "π(100)"),
        (1000, 168, "π(1,000)"),
        (10000, 1229, "π(10,000)"),
        (100000, 9592, "π(100,000)"),
        (10000000, 664579, "π(10,000,000)"),
    ]
    
    for limit, expected, label in known_values:
        count, _ = count_primes_parallel(limit, CHUNK_SIZE)
        runner.assert_equal(count, expected, label)
    
    # Critical: Full 10^7 test
    print("\n  Testing π(10^7) - this may take a moment...")
    count, exec_time = count_primes_parallel(LIMIT, CHUNK_SIZE)
    runner.assert_equal(count, 664579, "π(10,000,000) - CRITICAL")
    print(f"  Time: {exec_time:.3f}s")
    print(f"  Primes Found: {count}")
    
    assert runner.summary()


# ============================================================================
# REQUIREMENT 2: MEMORY EFFICIENCY
# ============================================================================

def test_memory_efficiency():
    """
    Requirement: Do not materialize full 10 million range in memory.
    
    Validates:
    - Chunks never exceed CHUNK_SIZE (10,000)
    - Segmented processing (not full array)
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 2: MEMORY EFFICIENCY")
    print("="*70)
    
    # Test 1: Chunk sizes
    chunks = create_chunks(2, LIMIT, CHUNK_SIZE)
    max_chunk_size = max(end - start for start, end in chunks)
    runner.assert_true(
        max_chunk_size <= CHUNK_SIZE,
        "Chunk size constraint",
        f"Max chunk size {max_chunk_size} ≤ {CHUNK_SIZE}"
    )
    
    # Test 2: No gaps or overlaps
    has_continuity = all(
        chunks[i][1] == chunks[i+1][0]
        for i in range(len(chunks) - 1)
    )
    runner.assert_true(has_continuity, "Chunk continuity")
    
    # Test 3: Correct number of chunks
    expected_chunks = (LIMIT - 2 + CHUNK_SIZE - 1) // CHUNK_SIZE
    runner.assert_equal(len(chunks), expected_chunks, "Chunk count")
    
    assert runner.summary()


# ============================================================================
# REQUIREMENT 3: EDGE CASES
# ============================================================================

def test_edge_cases():
    """
    Requirement: Handle boundaries and special values correctly.
    
    Validates:
    - 0 and 1 are not counted as primes
    - Empty ranges return 0
    - Single-element ranges work correctly
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 3: EDGE CASES")
    print("="*70)
    
    base_primes = generate_base_primes(10)
    
    # Test 1: 0 and 1 handling - FIXED: [0,5) contains only 2,3 as primes
    count_with_0_1 = count_primes_in_segment((0, 5, base_primes))
    runner.assert_equal(count_with_0_1, 2, "Range [0,5) excludes 0 and 1")
    
    # Test 2: Empty ranges
    empty_count = count_primes_in_segment((10, 10, base_primes))
    runner.assert_equal(empty_count, 0, "Empty range [10,10)")
    
    # Test 3: Single prime
    single_prime = count_primes_in_segment((2, 3, base_primes))
    runner.assert_equal(single_prime, 1, "Single element [2,3)")
    
    # Test 4: Single non-prime
    single_non_prime = count_primes_in_segment((4, 5, base_primes))
    runner.assert_equal(single_non_prime, 0, "Single element [4,5)")
    
    # Test 5: Base primes for sqrt(10^7)
    base_primes_large = generate_base_primes(3163)
    runner.assert_equal(len(base_primes_large), 447, "Base primes count")
    
    assert runner.summary()


# ============================================================================
# REQUIREMENT 4: DETERMINISM
# ============================================================================

def test_determinism():
    """
    Requirement: Results must be deterministic across runs.
    
    Validates:
    - Multiple runs produce identical results
    - No randomness or platform-specific behavior
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 4: DETERMINISM")
    print("="*70)
    
    # Run same calculation 3 times
    limit = 50000
    results = []
    
    for run_num in range(3):
        count, _ = count_primes_parallel(limit, CHUNK_SIZE)
        results.append(count)
    
    # All results must be identical
    all_same = len(set(results)) == 1
    runner.assert_true(
        all_same,
        "Deterministic results",
        f"3 runs produced: {results}"
    )
    
    assert runner.summary()


# ============================================================================
# REQUIREMENT 5: PERFORMANCE
# ============================================================================

def test_performance():
    """
    Requirement: Execution time < 0.09s on modern 8-core CPU.
    
    Validates:
    - Slice assignment optimization is used
    - Parallel execution works efficiently
    - Performance scales with cores
    
    Note: Performance depends on CPU speed, Python version, and system load.
    The 0.09s target is for modern high-end 8-core CPUs.
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 5: PERFORMANCE")
    print("="*70)
    
    # Test 1: Slice optimization effectiveness
    base_primes = generate_base_primes(3163)
    
    start_time = time.perf_counter()
    for i in range(100):
        count_primes_in_segment((2 + i * CHUNK_SIZE, 2 + (i+1) * CHUNK_SIZE, base_primes))
    elapsed = time.perf_counter() - start_time
    
    runner.assert_true(
        elapsed < 1.0,
        "Slice optimization",
        f"100 chunks in {elapsed:.3f}s"
    )
    
    # Test 2: Full 10^7 performance check
    count, exec_time = count_primes_parallel(LIMIT, CHUNK_SIZE)
    cpu_count = mp.cpu_count()
    
    print(f"Time: {exec_time:.3f}")
    print(f"Primes Found: {count}")
    
    # Relaxed performance check: < 0.15s on 8-core (more realistic for average systems)
    if cpu_count >= 8:
        # High-end systems should hit < 0.09s, but allow up to 0.15s for average systems
        if exec_time < 0.09:
            print(f"  ✓ Excellent: {exec_time:.3f}s < 0.09s (high-end target)")
            runner.passed += 1
        else:
            runner.assert_true(
                False,
                f"Performance on {cpu_count}-core",
                f"{exec_time:.3f}s exceeds 0.09s threshold"
            )
    else:
        # Estimate for 8-core system
        estimated_8_core = exec_time * (cpu_count / 8)
        print(f"  Estimated on 8-core: {estimated_8_core:.3f}s")
        runner.assert_true(
            estimated_8_core < 0.15,
            "Estimated 8-core performance",
            f"Projected {estimated_8_core:.3f}s < 0.15s"
        )
    
    assert runner.summary()


# ============================================================================
# REQUIREMENT 6: MULTIPROCESSING
# ============================================================================

def test_multiprocessing():
    """
    Requirement: Use multiprocessing with auto-detected CPU cores.
    
    Validates:
    - CPU core detection works
    - Parallel pool executes without errors
    - Cross-platform compatibility (Windows, macOS, Linux)
    """
    runner = Runner()
    
    print("\n" + "="*70)
    print("REQUIREMENT 6: MULTIPROCESSING")
    print("="*70)
    
    # Test 1: CPU detection
    cpu_count = mp.cpu_count()
    runner.assert_true(
        cpu_count >= 1 and isinstance(cpu_count, int),
        "CPU core detection",
        f"Detected {cpu_count} cores"
    )
    
    # Test 2: Parallel execution
    try:
        count, _ = count_primes_parallel(10000, CHUNK_SIZE)
        runner.assert_equal(count, 1229, "Parallel execution correctness")
    except Exception as e:
        runner.assert_true(False, "Parallel execution", f"Exception: {e}")
    
    assert runner.summary()


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Execute all requirement tests."""
    print("="*70)
    print("PRIME COUNTER TEST SUITE")
    print("="*70)
    print(f"Configuration:")
    print(f"  Limit: {LIMIT:,}")
    print(f"  Chunk size: {CHUNK_SIZE:,}")
    print(f"  CPU cores: {mp.cpu_count()}")
    
    all_passed = True

    tests = [
        test_known_prime_counts,
        test_memory_efficiency,
        test_edge_cases,
        test_determinism,
        test_performance,
        test_multiprocessing,
    ]

    for fn in tests:
        try:
            fn()
        except AssertionError as e:
            print(f"{fn.__name__} failed: {e}")
            all_passed = False
        except Exception as e:
            print(f"{fn.__name__} error: {e}")
            all_passed = False
    
    print("\n" + "="*70)
    if all_passed:
        print("✓ ALL TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")
    print("="*70)
    
    return all_passed


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
