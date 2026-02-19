# Separate Squares Problem

This dataset task contains a geometric algorithm problem for finding the horizontal line that splits overlapping squares into equal areas. The objective is to optimize from a naive O(n²) implementation to an efficient O(n log n) sweep line algorithm while preserving functional correctness.

## Folder layout

- `repository_before/` - naive implementation using coordinate compression
- `repository_after/` - optimized implementation using sweep line algorithm
- `tests/` - correctness and equivalence tests
- `patches/` - diff between before/after
- `evaluation/` - evaluation scripts and reports

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before – expected all pass)
```bash
docker compose run --rm test-before

```

Expected behavior:
- Functional tests: ✅ PASS
- All 17 test cases: ✅ PASS

### Run tests (after – expected all pass)
```bash
docker compose run --rm test-after
```

Expected behavior:
- Functional tests: ✅ PASS
- All 17 test cases: ✅ PASS
- Optimized algorithm: ✅ O(n log n) complexity

### Run evaluation (compares both implementations)
```bash
docker compose run --rm evaluate

or

docker compose run --rm app python evaluation/evaluation.py
```

This will:
- Run tests for both before and after implementations
- Generate a report at `evaluation/reports/report.json`

### Run evaluation with custom output file
```bash
docker compose run --rm app python evaluation/evaluation.py --output /path/to/custom/report.json
```

## Run locally

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run tests (before – expected all pass)
```bash
# Windows PowerShell
$env:PYTHONPATH="repository_before"; pytest tests -q

# Linux/Mac
PYTHONPATH=repository_before pytest tests -q
```

Expected behavior:
- Functional tests: ✅ PASS
- All 17 test cases: ✅ PASS

### Run tests (after – expected all pass)
```bash
# Windows PowerShell
$env:PYTHONPATH="repository_after"; pytest tests -q

# Linux/Mac
PYTHONPATH=repository_after pytest tests -q
```

Expected behavior:
- Functional tests: ✅ PASS
- All 17 test cases: ✅ PASS
- Optimized algorithm: ✅ O(n log n) complexity

### Run evaluation (compares both implementations)
```bash
python evaluation/evaluation.py
```

This will:
- Run tests for both before and after implementations
- Generate a report at `evaluation/reports/report.json`

## Regenerate patch

From repo root:

```bash
git diff --no-index repository_before repository_after > patches/diff.patch
```
