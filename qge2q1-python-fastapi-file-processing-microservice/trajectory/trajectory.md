# Trajectory: async-file-processing-microservice (FastAPI + async SQLAlchemy + Celery)

## 1. Requirements & Constraint Audit (What must not break)

I started by treating the prompt as a contract and translating it into “must-have invariants”:

- **API responsiveness**: upload returns immediately (job_id), status endpoints stay fast.
- **Large-file safety**: uploads up to **500MB** must not be buffered in memory.
- **Async stack**: FastAPI + **async SQLAlchemy** + PostgreSQL.
- **Background work**: Celery + Redis, progress updates every ~5 seconds, cancellation checks.
- **Row-level errors**: log failures per-row without aborting the whole job.

---

## 2. Architecture Split: “Thin API, Thick Worker”

I structured the solution to keep API handlers non-blocking:

- **API layer**: validates request, streams file to disk, inserts a Job row, enqueues work.
- **Worker/task layer**: CPU/IO-heavy parsing + validation + DB writes + webhook.

The key intention: API endpoints should never do anything proportional to number of rows, and should avoid per-row DB writes.

---

## 3. Data Model: Job + ProcessingError (and why)

I defined two ORM tables to match the prompt exactly:

- `Job`: lifecycle state machine (`QUEUED → PROCESSING → COMPLETED/FAILED`, plus `CANCELLED`).
- `ProcessingError`: row-level validation errors with `job_id` FK and cascade delete.

This schema choice supports:

- **Status polling** (job table is the single source of truth).
- **Pagination of errors** without loading them into memory.
- **Safe cleanup** on job deletion (cascade removes errors).

---

## 4. Lifespan & DB Pooling (keeping the API stable)

I used FastAPI lifespan to create and dispose the async SQLAlchemy engine cleanly.

- Engine config includes **pool_size=20, max_overflow=40** for Postgres URLs.
- For unit tests (SQLite), I avoid those pool args since SQLite’s async driver differs.

This keeps the “real” pooling requirement satisfied while still allowing hermetic tests.

---

## 5. Upload Pipeline: Streaming-first, size-safe

The upload endpoint is implemented as “stream-to-disk in 8KB chunks”:

- Validates extensions: `csv`, `xlsx`, `xls` only.
- Enforces max size (returns **413**) while streaming.
- Stores file path as `${UPLOAD_DIR}/${job_id}_${sanitized_filename}` to avoid collisions.

The important design decision: **do not rely on `UploadFile.size`** (often unknown); instead enforce the limit while reading.

---

## 6. Processing Task: chunked CSV + read-only Excel

I implemented a single processing task that adapts by file type:

- **CSV**: `pandas.read_csv(..., chunksize=10_000)` to keep memory bounded.
- **Excel**: `openpyxl.load_workbook(read_only=True, data_only=True)` and iterate rows, batching in chunks of ~10,000.

For each row:

- Validate fields (null checks + a simple constraint example).
- Insert `ProcessingError` rows for failed validations.
- Continue processing (never abort the job just because some rows fail).

Progress updates are **rate-limited** to ~every 5 seconds, not per-row.

---

## 7. Webhooks: reliable enough without blocking completion

On completion (success or failure), the worker sends an HTTP POST to `webhook_url` (if set):

- Payload matches the spec (`job_id`, `status`, `rows_processed`, `rows_failed`, `completed_at`).
- Retries up to **3 times** with backoff and a short HTTP timeout.

Crucial choice: webhook failures should not flip a completed job back to failed; they’re treated as best-effort delivery.

---

## 8. Test Strategy

Given the explicit constraint that `docker-compose.yml` must have **one service**, I designed tests that don’t need Postgres/Redis containers:

- Use SQLite async (`sqlite+aiosqlite`) for DB.
- Mock Redis health checks and webhook delivery.
- Validate the required behaviors via API-level tests plus unit tests of helpers.

This preserved the ability to run:

`docker compose run --rm app pytest -v`

without requiring any network creation beyond the single container.

---

## 9. Verification & Iterative Fixes (the bugs that mattered)

While running the suite, several failures revealed real integration pitfalls:

- **FastAPI dependency bug**: `get_session(request)` without a `Request` type annotation caused FastAPI to treat `request` as a query parameter → unexpected 400s.

  - Fix: type annotate `request: Request`.

- **Celery eager + asyncio conflict**: Celery eager execution called `asyncio.run()` inside an already-running event loop.

  - Fix: in eager/test mode, schedule `_process_job_async()` via `asyncio.create_task()` instead.

- **httpx ASGI lifespan mismatch**: the pinned httpx in the container didn’t support `ASGITransport(lifespan=...)`.
  - Fix: switched endpoint tests to `fastapi.testclient.TestClient`.

After these fixes, the full test suite runs cleanly.
