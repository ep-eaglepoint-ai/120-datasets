# Database-Level Error Handling Refactor

This dataset task contains a PostgreSQL trigger function that performs critical side-effect updates. The objective is to add robust, standards-compliant error handling while preserving all existing business logic and no-op semantics.

## Folder layout

```
repository_before/    # Original SQL implementation (silent failures)
repository_after/     # Refactored SQL implementation (explicit error handling)
tests/                # Behavior validation + error handling tests
patches/              # Diff between before/after
evaluation/           # Evaluation runner and generated reports
instances/            # Task metadata
trajectory/           # AI reasoning documentation
```

## Run with Docker

### Build image

```bash
docker compose build
```

### Run tests (before – expected failures)

```bash
docker compose run --rm app pytest tests/test_before.py -v
```

**Expected behavior:**

- ❌ `test_orphan_user_integrity_before`: FAIL (old code doesn't catch orphan users)
- ❌ `test_invalid_trigger_event_before`: FAIL (old code allows invalid trigger usage)

### Run tests (after – expected all pass)

```bash
docker compose run --rm app pytest tests/test_after.py -v
```

**Expected behavior:**

- ✅ `test_standard_sqlstates`: PASS (proper SQLSTATE error codes)
- ✅ `test_preserve_logic_and_behavior`: PASS (business logic preserved)
- ✅ `test_applied_to_function_and_trigger`: PASS (function and trigger exist)

### Run all tests

```bash
docker compose run --rm app pytest tests/ -v
```

### Run evaluation (compares both implementations)

```bash
docker compose run --rm app python evaluation/evaluation.py
```

This will:

1. Run `test_before.py` (expected to FAIL - proves vulnerabilities exist)
2. Run `test_after.py` (expected to PASS - proves fixes work)
3. Generate a report at `evaluation/YYYY-MM-DD/HH-MM-SS/report.json`

### Run evaluation with custom output file

```bash
docker compose run --rm app python evaluation/evaluation.py --output /app/evaluation/custom_report.json
```

## Run locally

### Prerequisites

- PostgreSQL 15+ running on `localhost:5432`
- Database `testdb` with user `postgres` / password `password`

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run tests

```bash
# Run all tests
pytest tests/ -v

# Run only before tests
pytest tests/test_before.py -v

# Run only after tests
pytest tests/test_after.py -v
```

## Regenerate patch

From repo root:

```bash
diff -u repository_before/db-level-error-handling.sql repository_after/db-level-error-handling.sql > patches/patch.diff
```

## What changed (Before → After)

| Aspect             | Before                | After                                  |
| ------------------ | --------------------- | -------------------------------------- |
| Trigger validation | None                  | Checks `TG_OP = 'UPDATE'`              |
| Input validation   | None                  | Checks `NEW.id IS NOT NULL`            |
| Integrity check    | Silent (empty UPDATE) | Explicit error on orphan user          |
| Error codes        | None                  | Standard PostgreSQL SQLSTATEs          |
| Security           | Basic                 | `SET search_path` to prevent hijacking |
| Exception handling | None                  | `EXCEPTION WHEN OTHERS` block          |

## SQLSTATEs Used

| Code    | Name                           | When Raised                             |
| ------- | ------------------------------ | --------------------------------------- |
| `09000` | triggered_action_exception     | Function called from non-UPDATE trigger |
| `23502` | not_null_violation             | User ID is NULL                         |
| `23000` | integrity_constraint_violation | No parent record for user               |

## Success Criteria

- ✅ `test_before.py` fails (proves vulnerabilities in old code)
- ✅ `test_after.py` passes (proves new error handling works)
- ✅ Business logic preserved (task cancellation still works)
- ✅ No-op semantics preserved (NULL→NULL, Value→Value don't trigger)
