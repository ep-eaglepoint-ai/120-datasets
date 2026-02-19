"""
Prime Counter with Multiprocessing

Counts all prime numbers up to 10^7 using parallel processing with Python's
multiprocessing module. Uses a segmented sieve approach to efficiently
distribute work across CPU cores while maintaining memory efficiency.

Requirements:
- Execution time < 0.09 seconds on modern 8-core CPU
- No materialization of full 10 million range in memory
- Cross-platform compatible (Windows, macOS, Linux)
"""

import multiprocessing as mp
import time
import math


# Constants
LIMIT = 10_000_000
CHUNK_SIZE = 10_000


def generate_base_primes(limit: int) -> list[int]:
    """
    Generate all prime numbers up to limit using optimized Sieve of Eratosthenes.
    
    Args:
        limit: Upper bound for prime generation (inclusive)
        
    Returns:
        Sorted list of all primes from 2 to limit
    """
    if limit < 2:
        return []
    
    is_prime = bytearray([1]) * (limit + 1)
    is_prime[0] = is_prime[1] = 0
    
    # Optimized: sieve only up to sqrt(limit)
    sqrt_limit = int(limit ** 0.5) + 1
    for i in range(2, sqrt_limit):
        if is_prime[i]:
            # Use slice assignment for speed
            is_prime[i*i::i] = bytearray((limit - i*i) // i + 1)
    
    # Fast extraction using filter
    return [i for i in range(2, limit + 1) if is_prime[i]]


def count_primes_in_segment(args: tuple[int, int, list[int]]) -> int:
    """
    Count prime numbers in a segment [start, end) using segmented sieve.
    
    Args:
        args: Tuple of (start, end, base_primes)
    
    Returns:
        Count of prime numbers in the segment
    """
    start, end, base_primes = args
    
    if start >= end:
        return 0
    
    segment_size = end - start
    is_prime = bytearray([1]) * segment_size
    
    # Handle 0 and 1
    if start == 0:
        is_prime[0] = 0
        if segment_size > 1:
            is_prime[1] = 0
    elif start == 1:
        is_prime[0] = 0
    
    # Sieve with base primes
    for prime in base_primes:
        # Early exit optimization
        if prime * prime >= end:
            break
        
        # Find first multiple in segment
        first_multiple = max(prime * prime, ((start + prime - 1) // prime) * prime)
        
        if first_multiple >= end:
            continue
        
        # Mark multiples using optimized slice assignment
        local_start = first_multiple - start
        is_prime[local_start::prime] = bytearray((segment_size - local_start - 1) // prime + 1)
    
    return sum(is_prime)


# Per-process read-only base primes (tuple) to avoid repeated pickling.
# This is set via the pool initializer `_init_worker`.
BASE_PRIMES: tuple[int, ...] | None = None


def _init_worker(base_primes: list[int]) -> None:
    """
    Pool initializer to set per-process immutable `BASE_PRIMES`.
    Using a tuple reduces mutability and pickling overhead.
    """
    global BASE_PRIMES
    BASE_PRIMES = tuple(base_primes)


def _worker_count(args: tuple[int, int]) -> int:
    """
    Worker wrapper used by the Pool. Accepts (start, end) and uses
    the per-process `BASE_PRIMES` set by `_init_worker`.
    """
    start, end = args
    return count_primes_in_segment((start, end, BASE_PRIMES if BASE_PRIMES is not None else []))


def create_chunks(start: int, end: int, chunk_size: int) -> list[tuple[int, int]]:
    """
    Divide the range [start, end) into chunks of fixed size.
    
    Args:
        start: Beginning of range (inclusive)
        end: End of range (exclusive)
        chunk_size: Size of each chunk
        
    Returns:
        List of (chunk_start, chunk_end) tuples
    """
    return [(i, min(i + chunk_size, end)) for i in range(start, end, chunk_size)]


def count_primes_parallel(limit: int, chunk_size: int) -> tuple[int, float]:
    """
    Count all primes up to limit using parallel multiprocessing.
    
    Args:
        limit: Upper bound for prime counting (exclusive)
        chunk_size: Size of each work unit
        
    Returns:
        Tuple of (total_prime_count, execution_time_seconds)
    """
    # Generate base primes
    sqrt_limit = int(limit ** 0.5) + 1
    base_primes = generate_base_primes(sqrt_limit)
    
    # Create work chunks
    chunks = create_chunks(2, limit, chunk_size)

    n_chunks = len(chunks)
    # Aim for ~32 tasks per worker to balance throughput vs overhead
    target_tasks = mp.cpu_count() * 32
    group_size = max(1, math.ceil(n_chunks / target_tasks))

    grouped = []
    for i in range(0, n_chunks, group_size):
        group = chunks[i:i+group_size]
        start = group[0][0]
        end = group[-1][1]
        grouped.append((start, end))

    worker_args = grouped

    # Execute parallel processing with timing
    start_time = time.perf_counter()

    # Prefer 'fork' context on Unix-like systems to allow fork-based
    # copy-on-write semantics where available; fall back to default
    # context (spawn) for Windows.
    try:
        ctx = mp.get_context("fork")
    except Exception:
        ctx = mp.get_context()

    # Convert base_primes to tuple for immutability and slightly smaller
    # pickled payload when passed to worker initializer.
    bp_tuple = tuple(base_primes)

    # Tune the pool map chunksize to reduce per-task overhead. Aim to give
    # each worker several chunks at once.
    n_tasks = len(worker_args)
    map_chunksize = max(1, n_tasks // (mp.cpu_count() * 4))

    # If the context uses 'fork', we can set the module-level BASE_PRIMES
    # before creating the pool so child processes inherit it via
    # copy-on-write instead of pickling it. For spawn (Windows), fall
    # back to using the initializer.
    start_method = None
    try:
        start_method = ctx.get_start_method()
    except Exception:
        try:
            start_method = mp.get_start_method()
        except Exception:
            start_method = None

    if start_method == "fork":
        # Set module-level BASE_PRIMES so children inherit via fork.
        global BASE_PRIMES
        BASE_PRIMES = bp_tuple
        with ctx.Pool(processes=mp.cpu_count()) as pool:
            segment_counts = list(pool.imap_unordered(_worker_count, worker_args, chunksize=map_chunksize))
    else:
        # Spawn-based platforms (Windows/macOS with spawn) need the
        # initializer to provide base primes to each worker.
        with ctx.Pool(processes=mp.cpu_count(), initializer=_init_worker, initargs=(bp_tuple,)) as pool:
            segment_counts = list(pool.imap_unordered(_worker_count, worker_args, chunksize=map_chunksize))
    
    total_primes = sum(segment_counts)
    end_time = time.perf_counter()
    execution_time = end_time - start_time
    
    return total_primes, execution_time
