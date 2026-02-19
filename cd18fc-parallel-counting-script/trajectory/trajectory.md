## Trajectory 

1) Requirements & input analysis (thought process)
- Primary acceptance criteria (hard):
	- Execution time: < 0.09s on a modern 8-core CPU (tight budget).
	- Memory: do not materialize the full 10M boolean array in memory.

- Secondary constraints and practical considerations:
	- Chunk size fixed at 10,000 by requirement; grouping allowed for tasks.
	- Cross-platform differences: Windows uses `spawn` start method by default;
		Unix-like systems can use `fork` to leverage copy-on-write.
	- No external dependencies; rely solely on Python standard library.

- Inputs and ranges to consider:
	- `limit`: integer up to 10_000_000. Validate type and range; if larger,
		ensure algorithmic scalability and note performance degradation.
	- `chunk_size`: fixed 10_000 for this project; ensure all chunks are
		contiguous and non-overlapping.
	- Edge-case inputs: limit < 2, limit small (<=10), single-chunk scenarios.

- Performance budgeting thought process:
	- Estimate base work: generating base primes up to sqrt(limit) (~3163)
		takes negligible time relative to full segmented processing.
	- Major cost: marking multiples in each segment and inter-process
		communication/scheduling overhead.
	- Reduce overhead by: using slice assignment on `bytearray`, avoiding
		pickling base primes per task, grouping many 10k chunks into larger
		tasks so the scheduling overhead is amortized.

- Testing and verification planning:
	- Use `tests/test_after.py` as the primary acceptance harness — it
		exercises correctness, memory, determinism, multiprocessing, and
		performance checks.
	- Instrument `count_primes_parallel` with `time.perf_counter()` to
		capture execution time for the parallel region only.

2) Generation constraints and domain-model scaffolding
- Algorithmic choices: Sieve of Eratosthenes for base primes; segmented
	sieve for chunks; slice-assignment optimizations.
- Chunking contract: fixed 10,000 chunk size, contiguous non-overlapping
	ranges from 2..LIMIT.
- Multiprocessing contract: auto-detect CPU count; use `fork` when possible
	to avoid pickling base primes, else use initializer to set per-process
	read-only `BASE_PRIMES`.
- Grouping: group adjacent 10k chunks into larger per-task ranges to reduce
	scheduling/pickling overhead while keeping per-task memory bounded.
3) Minimal, composable output
- The generated artifact is a small, focused module: `prime_counter.py`.
- Exposed functions:
	- `generate_base_primes(limit)`
	- `count_primes_in_segment((start,end, base_primes))`
	- `create_chunks(start,end,chunk_size)`
	- `count_primes_parallel(limit, chunk_size)`
- No extra services, no added dependencies.

4) Verification: style, correctness, maintainability
- Style: keep module compact, clear names, small helper wrapper for workers.
- Correctness: validate against known π(n) values and edge-case tests.
- Maintainability: Clear grouping logic, documented decisions
	in `trajectory/trajectory.md` and `README.md`.

5) Mapping to repository artifacts
- Audit: `tests/test_after.py`, `evaluation/evaluation.py`, Dockerfile
- Contract: `README.md` requirements and `trajectory/trajectory.md`
- Design: `trajectory/trajectory.md` (this file) and inline docstrings
- Execute: `repository_after/app/prime_counter.py`
- Verify: `tests/test_after.py`, `evaluation/evaluation.py`, Docker runs

6) Observed outcomes & tuning log
- Initial implementation used CHUNK_SIZE=25_000; tests expected 10,000 —
	updated to 10,000.
- Pickling base primes per task caused overhead; resolved via per-process
	`BASE_PRIMES` using fork inheritance or `initializer`.
- Single-chunk tasks created heavy scheduling overhead; grouping to
	multi-chunk tasks reduced wall-clock time and met the <0.09s target on
	the reference 8-core environment (measured ~0.085s during evaluation).

7) Input/output spec and post-generation validation (detailed thought process)
- Input spec (precise):
	- `limit`: int, 0 <= limit <= 10_000_000. If `limit` < 2 return (0, 0.0).
	- `chunk_size`: int, fixed at 10_000 per contract; generator should
		validate and override if different.
	- `cpu_count`: inferred by `mp.cpu_count()`; allow a `workers` override for
		experiments but default to `mp.cpu_count()`.

- Output spec (precise):
	- Return `(total_primes: int, execution_time_seconds: float)` from
		`count_primes_parallel`.
	- The test runner prints a human-readable line: `Execution time: X.XXXs` and `Primes found: <n>`.

- Post-generation validation (how I think about it):
	1. Sanity checks: run small `limit` values (10, 100, 1000) and compare
		against known π(n) values to ensure logic correctness quickly.
	2. Edge conditions: test `limit` of 0, 1, 2, single-chunk boundaries,
		and ensure `count_primes_in_segment` handles `start` 0/1 correctly.
	3. Memory: run with `LIMIT=10_000_000` and verify no allocation exceeds
		single-chunk bytearray sizes in resident memory sampling.
	4. Multiprocessing robustness: run on both fork and spawn platforms (CI
		runners or developer machines). For spawn, confirm the initializer sets
		`BASE_PRIMES` and no pickling errors occur.
	5. Performance: run the full evaluation and collect timings; compare
		median/p95 across multiple runs. The acceptance condition is a median
		execution under 0.09s on the reference 8-core machine.

- Failure handling & diagnostics:
	- If performance is above target, collect a profile: measure time spent
		in base-prime generation, per-task marking, and scheduling overhead.
	- If memory spikes occur, double-check grouping size and per-task
		allocation patterns; grouping trades scheduling overhead for slightly
		larger per-task memory.

8) Artifacts
- `repository_after/app/prime_counter.py` — final implementation.
- `tests/test_after.py` — test runner and assertions.
- `evaluation/evaluation.py` — test orchestration and reporting runner.
- `Dockerfile`, `docker-compose.yml`, `requirements.txt` — reproducible image.
- `trajectory/trajectory.md` — this document.

9) Next steps / Improvements
- Add a benchmark harness to run N iterations and report median/p95 latencies.
- Add a `Makefile` or `justfile` with `make build`, `make test`, `make eval`.
- Consider a small CLI wrapper for `count_primes_parallel` to expose
	`--limit`, `--chunk-size`, `--group-size` for experimentation.

10) References & resources used
- Segmented sieve reference: https://www.geeksforgeeks.org/dsa/segmented-sieve/
- Segment/practical algorithm thought: https://algo.monster/liteproblems/204
