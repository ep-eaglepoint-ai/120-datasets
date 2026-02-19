Stackable Promo Codes Feature


## Folder layout
- `repository_before/` - original implementation with single-code support only
- `repository_after/` - fixed implementation with stackable codes feature
- `tests/` - comprehensive test suite
- `patches/` - diff between before/after
- `evaluation/` - evaluation script and reports

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
- Tests: ❌ FAIL (method `validateAndApplyMultiplePromoCodes` doesn't exist)

### Run tests (after – expected all pass)
```bash
docker compose run --rm test-after
```

**Expected behavior:**
- All tests: ✅ PASS (stackable codes feature fully implemented)

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
git diff --no-index repository_before repository_after > patches/diff.patch
```
