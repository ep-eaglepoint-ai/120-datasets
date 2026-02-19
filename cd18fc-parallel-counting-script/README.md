## Problem statement
I've encountered a performance challenge when dealing with heavy optimization requirements under strict time constraints, which introduced notable complexity into the development process. This situation required careful balancing between achieving optimal system efficiency and adhering to tight project deadlines. The constraint of limited development time made it particularly difficult to implement the comprehensive performance improvements the project truly needed.

## Prompt used
Write a parallel Python prime-counting script to use multiprocessing for parallel execution across multiple CPU cores, achieving significant performance improvement while preserving correctness.

**Functional Requirements:**

- Use Python’s built in

- Must find all primes up until 10^7.

- Auto-detect CPU cores.

- Efficiently distribute work using the existing chunk-based approach (chunk size = 10,000).

- Aggregate results from all worker processes.

- Output format: Time: X.XX seconds   Primes found: xxxx

**Hard constraints:**

- Execution time < 0.09 seconds on modern 8-core CPU.

- No external dependencies (Python standard library only).

- Memory-efficient: do not materialize full 10 million range in memory.

**Technical constraints:**

- Cross-platform: Windows, macOS, Linux.

- Chunk size fixed at 10,000.

- No global mutable state or shared memory.

- Clean execution: no warnings, errors, or orphaned processes.

## Requirements
1. Execution time < 0.09 seconds on modern 8-core CPU.
2. do not materialize full 10 million range in memory.

## Commands
```bash
# Build and run AFTER test
docker compose run --rm -e PYTHONPATH=/app/repository_after app python tests/test_after.py
```
```bash
# Run evaluation
docker compose run --rm -e PYTHONPATH=/app/repository_after app python evaluation/evaluation.py
```
**`repository_before`**: No tests executed (directory empty)
