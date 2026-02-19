# Mechanical Refactor: Bookstore Service

This dataset task contains a production-style Rust backend with intentional quirks. The objective is to refactor the backend into a complete CRUD service using proper validation, error handling, and concurrency safety.

## Folder layout

*   `repository_before/`: original implementation
*   `repository_after/`: mechanically refactored implementation
*   `tests/`: equivalence + invariants tests
*   `patches/`: diff between before/after
*   `evaluation/`: evaluation script

## Run with Docker

### Build image

```bash
docker compose build
```

### Run tests (tester)

```bash
docker compose up --build --exit-code-from tester tester
```

Expected behavior:

*   Functional tests: ✅ PASS
*   Structural tests (helper functions, duplication reduction): ✅ PASS (improvements present)

### Run evaluation (compares both implementations)

```bash
docker compose up --build --exit-code-from evaluator evaluator
```

This will:

*   Run tests for both before (simulated) and after implementations
*   Run structure and equivalence tests
*   Generate a report at `evaluation/reports/latest.json`

## Run locally

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run all tests

```bash
# Run all tests (quiet mode)
pytest -q
```

## Regenerate patch

From repo root:

```bash
git diff --no-index repository_before repository_after > patches/diff.patch
```