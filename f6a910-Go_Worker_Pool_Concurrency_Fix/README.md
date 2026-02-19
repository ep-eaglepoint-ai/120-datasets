## 🐳 Quick Start (Docker)

# run before repository tests (quick validation)

```bash
docker-compose up --build run_repository_before_tests

```

# run after repository tests (quick validation)

```bash
docker-compose up --build run_repository_after_tests
```

# Run evaluation script

```bash
docker-compose run evaluation
```

## Folder layout

- `repository_before/` original implementation
- `repository_after/` mechanically refactored implementation
- `tests/` equivalence + invariants tests
- `patches/` diff between before/after

## Run with Docker

### Run tests (before – expected some failures)

```bash
docker-compose up --build run_repository_before_tests
```

**Expected behavior:**

- Most functional tests may fail due to known concurrency, shutdown, or resource issues in the original implementation.
- Structural tests (helper functions, duplication reduction): ❌ FAIL (expected, as no improvements are present yet)
- Race detector may report data races or panics.
