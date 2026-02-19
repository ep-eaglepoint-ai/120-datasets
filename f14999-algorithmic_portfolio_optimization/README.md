## Folder layout

- `repository_before/` original implementation
- `repository_after/` mechanically refactored implementation
- `tests/` equivalence + invariants tests
- `patches/` diff between before/after

## Run with Docker

### Run tests (before – expected some failures)

```bash
docker-compose run --rm test-before
```

**Expected behavior:**

- Functional tests: ✅ PASS
- Structural tests (helper functions, duplication reduction): ❌ FAIL (expected - no improvements yet)

### Run tests (after – expected all pass)

```bash
docker-compose run --rm test-after
```

**Expected behavior:**

- Functional tests: ✅ PASS
- Structural tests (helper functions, duplication reduction): ✅ PASS (improvements present)

#### Run evaluation (compares both implementations)

```bash
docker compose run --rm evaluate
```

This will:

- Run tests for both before and after implementations
- Run structure and equivalence tests
- Generate a report at `evaluation/YYYY-MM-DD/HH-MM-SS/report.json`
