# API Fetch Optimization

## Folder Layout

- `repository_before/` - Original implementation with performance issues
- `repository_after/` - Optimized implementation with fixes
- `tests/` - Comprehensive test suite
- `patches/` - Diff between before/after
- `evaluation/` - Evaluation script and reports

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before – expected some failures)
```bash
docker compose run --rm test-before
```

**Expected behavior:**
- Some tests: ❌ FAIL (expected - performance issues present in original implementation)

### Run tests (after – expected all pass)
```bash
docker compose run --rm test-after
```

**Expected behavior:**
- All tests: ✅ PASS (optimizations implemented, requirements met)

### Run evaluation (compares both implementations)
```bash
docker compose run --rm evaluation
```

This will:
- Run tests for both before and after implementations
- Compare results and verify improvements
- Generate a report at `evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json`

## Regenerate patch

From repo root:

```bash
git diff --no-index repository_before repository_after > patches/api_fetch_optimization.patch
```
