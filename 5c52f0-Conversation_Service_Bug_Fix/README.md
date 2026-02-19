# Bug Fix: Conversation Service

This dataset task contains a production-style TypeScript service with a known bug.
The objective is to **fix the bug** in the `repository_after` directory while ensuring all tests pass.

## Folder layout

- `repository_before/` original implementation (buggy)
- `repository_after/` fixed implementation
- `tests/` regression + integrity tests
- `patches/` diff between before/after

## Run with Docker

### Build image
```bash
docker compose build
```

### Run tests (before – expected failures)
```bash
docker compose run --rm app npx jest --runInBand
```
> **Note:** Tests default to `repository_before` (buggy version) which should fail.

### Run tests (after – expected all pass)
```bash
docker compose run --rm -e TARGET_REPO=repository_after app npx jest --runInBand
```
> **Note:** You must set `TARGET_REPO=repository_after` to test the fixed version. The `--runInBand` flag ensures tests run sequentially for database stability.

**Expected behavior:**
- Functional tests: ✅ PASS
- Integrity/Memory tests: ✅ PASS

#### Run evaluation (compares both implementations)
```bash
docker compose run --rm app npm run eval
```

This will:
- Run tests against the implementation
- Run evaluation scripts defined in `evaluation/evaluation.ts`
- Generate a report at `evaluation/report.json`

#### Run evaluation with custom output file
```bash
docker compose run --rm app npm run eval -- --output /path/to/custom/report.json
```

## Run locally

### Install dependencies
```bash
npm install
```

### Run all tests
```bash
# Run all tests
npm test
```

## Regenerate patch

From repo root:

```bash
git diff --no-index repository_before repository_after > patches/task_001.patch
```
