# Trajectory (Thinking Process for Performance Optimization)

## 1. Audit the Original Code (Identify Scaling Problems)
I audited the original code in `repository_before/parallelizing.py`. The implementation creates a separate `multiprocessing.Process` for each item in a list of ~2000 items. This causes:
- Excessive process spawning (one per task)
- CPU and memory oversubscription
- High process creation/teardown overhead
- System crashes due to resource exhaustion

## 2. Define a Performance Contract First
I defined performance conditions:
- Limit concurrent processes to CPU count
- Use process pooling to minimize creation/teardown
- Efficiently distribute work across cores
- Ensure predictable scaling with input size

## 3. Rework the Implementation for Efficiency
I refactored the code in `repository_after/parallelizing.py` to use `multiprocessing.Pool`:
- Replaced individual `Process` creation with `Pool(processes=cpu_count())`
- Used `pool.map()` for efficient work distribution
- Used context manager (`with Pool`) for proper resource cleanup
- Returns results for predictable behavior

## 4. Write Tests Based on Requirements
Created tests in `tests/test_parallelizing.py` covering all 5 requirements:
1. **Requirement 1**: Tests that Pool is used instead of individual Process objects
2. **Requirement 2**: Tests for efficient CPU utilization via pool.map
3. **Requirement 3**: Tests for proper Pool management (context manager)
4. **Requirement 4**: Tests that cpu_count() is used for worker count
5. **Requirement 5**: Tests for predictable scaling (returns results, no unlimited spawning)

## 5. Implement Evaluation System
Created `evaluation/evaluation.py` that:
- Runs tests against both repository_before and repository_after
- Uses TEST_IMPLEMENTATION environment variable to switch implementations
- Parses pytest output to collect pass/fail results
- Generates JSON report with all required fields
- Validates expected behavior (before fails, after passes)

## 6. Result: Measurable Performance Gains
The solution:
- Before: All 6 tests fail (spawns Process per task)
- After: All 6 tests pass (uses Pool with cpu_count workers)
- Predictable scaling: O(n/workers) instead of O(n) process spawns
- No resource exhaustion: Limited to CPU count concurrent processes
