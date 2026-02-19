import os
import re
import time
import uuid
from io import BytesIO

import pytest


@pytest.mark.asyncio
async def test_requirements_pinned_versions_present():
    req_path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
    with open(req_path, "r", encoding="utf-8") as f:
        content = f.read().lower()

    required = [
        "fastapi>=0.104.0",
        "uvicorn[standard]>=0.24.0",
        "sqlalchemy[asyncio]>=2.0.23",
        "asyncpg>=0.29.0",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "celery[redis]>=5.3.4",
        "redis>=5.0.1",
        "aiofiles>=23.2.1",
        "pandas>=2.1.3",
        "openpyxl>=3.1.2",
        "httpx>=0.25.2",
        "python-multipart>=0.0.6",
    ]
    for r in required:
        assert r in content


@pytest.mark.asyncio
async def test_docker_compose_services_and_commands_present():
    compose_path = os.path.join(os.path.dirname(__file__), "..", "docker-compose.yml")
    with open(compose_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "services:" in content

    # Must define required services (plus 'app' for test runner).
    for svc in ["app:", "api:", "worker:", "db:", "redis:"]:
        assert svc in content

    service_keys = re.findall(r"^\s{2}([a-zA-Z0-9_-]+):\s*$", content, flags=re.MULTILINE)
    assert set(service_keys) >= {"app", "api", "worker", "db", "redis"}

    # API command must use uvicorn and 4 workers
    assert "repository_after.api:app" in content
    assert "--workers" in content
    assert "\"4\"" in content or " 4" in content

    # Worker must run Celery with concurrency 4, max_tasks_per_child 10, prefetch multiplier 1
    assert "--concurrency=4" in content
    assert "--max-tasks-per-child=10" in content
    assert "--prefetch-multiplier=1" in content

    # Named volumes for persistence
    assert "db_data:" in content
    assert "redis_data:" in content
    assert "uploads_data:" in content


def test_engine_pool_configured(client):
    # The app tests run on SQLite; pooling is validated on Postgres URL separately.
    r = client.get("/api/jobs", params={"page": 1, "page_size": 1})
    assert r.status_code == 200


def test_engine_pool_configured_for_postgres_url(monkeypatch):
    from repository_after.db import create_engine

    engine = create_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
    pool = engine.sync_engine.pool
    assert pool._pool.maxsize == 20
    assert pool._max_overflow == 40


def test_upload_rejects_unsupported_extension(client):
    files = {"file": ("bad.txt", b"hello", "text/plain")}
    resp = client.post("/api/files/upload", files=files)
    assert resp.status_code == 400
    assert "unsupported" in resp.json()["detail"].lower()


def test_request_validation_errors_return_400(client):
    # Missing required multipart file should be treated as 400 (not 422).
    resp = client.post("/api/files/upload", data={"webhook_url": "http://example.com"})
    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_upload_enforces_size_limit_413(client, tmp_path, monkeypatch):
    # Limit is set low in tests via MAX_UPLOAD_BYTES.
    too_big = b"a" * (int(os.environ["MAX_UPLOAD_BYTES"]) + 1)
    files = {"file": ("big.csv", too_big, "text/csv")}
    resp = client.post("/api/files/upload", files=files)
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_stream_upload_reads_in_8kb_chunks(tmp_path):
    from fastapi import UploadFile

    from repository_after.storage import stream_upload_to_disk

    class FakeUpload:
        def __init__(self, payload: bytes):
            self.payload = payload
            self.idx = 0
            self.read_sizes = []

        async def read(self, size: int):
            self.read_sizes.append(size)
            if self.idx >= len(self.payload):
                return b""
            out = self.payload[self.idx : self.idx + size]
            self.idx += size
            return out

    fake = FakeUpload(b"x" * (20 * 1024))
    dest = tmp_path / "out.bin"
    total = await stream_upload_to_disk(fake, dest, max_bytes=10**9)
    assert total == 20 * 1024
    assert all(s == 8192 for s in fake.read_sizes if s != 0)


def test_upload_creates_job_and_processing_logs_errors_and_webhook(client, monkeypatch):
    # Patch webhook sender to capture payload.
    captured = {}

    async def fake_webhook(url, **payload):
        captured["url"] = url
        captured["payload"] = payload

    monkeypatch.setattr("repository_after.tasks.deliver_webhook", fake_webhook)

    csv_content = "a,b\n1,2\n,3\n4,\n"  # two invalid rows (nulls)

    files = {"file": ("data.csv", csv_content.encode("utf-8"), "text/csv")}
    data = {"webhook_url": "http://example.com/webhook"}
    up = client.post("/api/files/upload", files=files, data=data)
    assert up.status_code == 200
    job_id = up.json()["job_id"]

    job = client.get(f"/api/jobs/{job_id}")
    assert job.status_code == 200
    # Processing runs in background; poll briefly for completion.
    import time

    deadline = time.time() + 2.0
    job_json = job.json()
    while time.time() < deadline and job_json["status"] in ("QUEUED", "PROCESSING"):
        time.sleep(0.05)
        job_json = client.get(f"/api/jobs/{job_id}").json()

    assert job_json["status"] in ("COMPLETED", "FAILED")
    assert 0 <= job_json["progress"] <= 100
    assert job_json["rows_processed"] >= 1

    errs = client.get(f"/api/jobs/{job_id}/errors")
    assert errs.status_code == 200
    errs_json = errs.json()
    assert errs_json["total"] >= 1
    assert errs_json["errors"][0]["row_number"] >= 1

    assert captured["url"] == "http://example.com/webhook"
    assert captured["payload"]["job_id"] == str(job_id)
    assert captured["payload"]["status"] in ("COMPLETED", "FAILED")


@pytest.mark.asyncio
async def test_webhook_retries_three_times_and_succeeds(monkeypatch):
    from datetime import datetime, timezone

    from repository_after.webhook import deliver_webhook

    attempts = {"count": 0}

    class FakeResp:
        def raise_for_status(self):
            return None

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            attempts["count"] += 1
            if attempts["count"] < 3:
                raise RuntimeError("temp")
            return FakeResp()

    monkeypatch.setattr("httpx.AsyncClient", lambda *a, **k: FakeClient())

    await deliver_webhook(
        "http://example.com",
        job_id=str(uuid.uuid4()),
        status="COMPLETED",
        rows_processed=1,
        rows_failed=0,
        completed_at=datetime.now(timezone.utc),
    )
    assert attempts["count"] == 3


@pytest.mark.asyncio
async def test_webhook_uses_exponential_backoff(monkeypatch):
    from datetime import datetime, timezone

    from repository_after.webhook import deliver_webhook

    sleeps: list[float] = []

    async def fake_sleep(seconds: float):
        sleeps.append(float(seconds))

    class FakeClientAlwaysFails:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            raise RuntimeError("fail")

    monkeypatch.setattr("httpx.AsyncClient", lambda *a, **k: FakeClientAlwaysFails())
    monkeypatch.setattr("asyncio.sleep", fake_sleep)

    with pytest.raises(RuntimeError):
        await deliver_webhook(
            "http://example.com",
            job_id=str(uuid.uuid4()),
            status="FAILED",
            rows_processed=0,
            rows_failed=0,
            completed_at=datetime.now(timezone.utc),
            max_attempts=3,
            base_delay_seconds=0.5,
            max_total_seconds=10.0,
        )

    # Between attempts: 0.5s then 1.0s (exponential)
    assert sleeps[:2] == [0.5, 1.0]


@pytest.mark.asyncio
async def test_webhook_respects_total_time_budget(monkeypatch):
    from datetime import datetime, timezone

    from repository_after.webhook import deliver_webhook

    # Fake loop clock so we can deterministically check the budget enforcement.
    class FakeLoop:
        def __init__(self):
            self._t = 0.0

        def time(self):
            return self._t

    fake_loop = FakeLoop()

    async def fake_sleep(seconds: float):
        fake_loop._t += float(seconds)

    class FakeClientAlwaysFails:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json):
            raise RuntimeError("fail")

    monkeypatch.setattr("asyncio.get_running_loop", lambda: fake_loop)
    monkeypatch.setattr("asyncio.sleep", fake_sleep)
    monkeypatch.setattr("httpx.AsyncClient", lambda *a, **k: FakeClientAlwaysFails())

    # Budget too small to fit all exponential sleeps; should stop early.
    with pytest.raises(RuntimeError):
        await deliver_webhook(
            "http://example.com",
            job_id=str(uuid.uuid4()),
            status="FAILED",
            rows_processed=0,
            rows_failed=0,
            completed_at=datetime.now(timezone.utc),
            max_attempts=3,
            base_delay_seconds=0.5,
            max_total_seconds=0.6,
        )

    assert fake_loop.time() <= 0.6


def test_jobs_list_pagination_and_filters(client):
    # Create two jobs
    files1 = {"file": ("a.csv", b"x,y\n1,2\n", "text/csv")}
    files2 = {"file": ("b.csv", b"x,y\n3,4\n", "text/csv")}
    r1 = client.post("/api/files/upload", files=files1)
    r2 = client.post("/api/files/upload", files=files2)
    assert r1.status_code == 200 and r2.status_code == 200

    resp = client.get("/api/jobs", params={"page": 1, "page_size": 50})
    assert resp.status_code == 200
    body = resp.json()
    assert "total" in body and "jobs" in body
    assert body["page"] == 1
    assert body["page_size"] == 50
    assert isinstance(body["jobs"], list)

    # Filter by status
    resp2 = client.get("/api/jobs", params={"status": "COMPLETED"})
    assert resp2.status_code == 200


def test_worker_service_has_healthcheck():
    compose_path = os.path.join(os.path.dirname(__file__), "..", "docker-compose.yml")
    with open(compose_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Req 17: health checks for all services
    assert "worker:" in content
    # Ensure the worker service itself defines a healthcheck.
    assert "worker:" in content
    worker_block = content.split("worker:", 1)[1]
    assert "healthcheck:" in worker_block
    assert "inspect ping" in worker_block


@pytest.mark.asyncio
async def test_upload_handler_schedules_background_persist_fast(app):
    from fastapi import UploadFile
    from starlette.background import BackgroundTasks
    from starlette.requests import Request

    from repository_after.api import upload_file

    async with app.state.sessionmaker() as session:
        scope = {"type": "http", "method": "POST", "path": "/api/files/upload", "headers": [], "app": app}
        request = Request(scope)
        bg = BackgroundTasks()
        up = UploadFile(filename="data.csv", file=BytesIO(b"a,b\n1,2\n"))

        t0 = time.perf_counter()
        resp = await upload_file(request, bg, up, None, session)
        elapsed = time.perf_counter() - t0

        assert elapsed < 0.5
        assert resp.job_id
        # Background task should be scheduled (persist+enqueue).
        assert len(bg.tasks) == 1


@pytest.mark.asyncio
async def test_get_job_fast_path_under_100ms(app):
    from sqlalchemy import insert

    from repository_after.api import get_job
    from repository_after.models import Job, JobStatus

    job_id = uuid.uuid4()

    async with app.state.sessionmaker() as session:
        await session.execute(
            insert(Job).values(
                id=job_id,
                filename="x.csv",
                file_size=3,
                file_type="csv",
                status=JobStatus.QUEUED,
                progress=0,
                rows_processed=0,
                rows_failed=0,
                error_message=None,
                webhook_url=None,
            )
        )
        await session.commit()

        t0 = time.perf_counter()
        resp = await get_job(job_id, session=session)
        elapsed = time.perf_counter() - t0

        assert resp.id == job_id
        assert elapsed < 0.1


def test_celery_graceful_shutdown_config_present():
    from repository_after.celery_app import celery_app

    assert celery_app.conf.worker_shutdown_timeout is not None
    assert celery_app.conf.task_soft_time_limit is not None
    assert celery_app.conf.task_time_limit is not None


@pytest.mark.asyncio
async def test_progress_updates_respect_interval(monkeypatch, tmp_path):
    # Validates "update at least every 5 seconds" logic by controlling monotonic time.
    from repository_after import tasks

    monkeypatch.setattr(tasks.settings, "progress_update_interval_seconds", 5.0)

    # Create a simple CSV file with enough rows.
    p = tmp_path / "data.csv"
    rows = "a,b\n" + "\n".join(["1,2" for _ in range(25)]) + "\n"
    p.write_text(rows, encoding="utf-8")

    # Fake session + job lookups so we only exercise timing gates.
    class FakeJob:
        status = tasks.JobStatus.PROCESSING

    async def fake_get_job(session, job_id):
        return FakeJob()

    progress_updates: list[int] = []

    async def fake_update_job_progress(session, job_id, **kwargs):
        if "progress" in kwargs:
            progress_updates.append(int(kwargs["progress"]))

    async def fake_insert_loaded_rows(*_a, **_k):
        return None

    async def fake_log_errors(*_a, **_k):
        return None

    monkeypatch.setattr(tasks, "_get_job", fake_get_job)
    monkeypatch.setattr(tasks, "_update_job_progress", fake_update_job_progress)
    monkeypatch.setattr(tasks, "_insert_loaded_rows", fake_insert_loaded_rows)
    monkeypatch.setattr(tasks, "_log_errors", fake_log_errors)

    # Control monotonic time: first few calls below interval, then jump past 5s.
    times = iter([0.0, 0.1, 0.2, 0.3, 5.2, 5.3, 10.5, 10.6, 20.0])
    monkeypatch.setattr(tasks.time, "monotonic", lambda: next(times, 20.0))

    class FakeSession:
        async def execute(self, *_a, **_k):
            return None

        async def commit(self):
            return None

    await tasks._process_csv(p, uuid.uuid4(), FakeSession())
    # Should have updated progress multiple times, gated by interval.
    assert len(progress_updates) >= 2


def test_get_job_404_and_errors_404(client):
    missing = uuid.uuid4()
    r1 = client.get(f"/api/jobs/{missing}")
    assert r1.status_code == 404
    r2 = client.get(f"/api/jobs/{missing}/errors")
    assert r2.status_code == 404


def test_delete_job_deletes_when_not_processing(client):
    up = client.post("/api/files/upload", files={"file": ("x.csv", b"a\n1\n", "text/csv")})
    job_id = up.json()["job_id"]

    d = client.delete(f"/api/jobs/{job_id}")
    assert d.status_code == 204

    g = client.get(f"/api/jobs/{job_id}")
    assert g.status_code == 404


def test_delete_marks_cancelled_when_processing(client, app):
    from sqlalchemy import update

    from repository_after.models import Job, JobStatus

    up = client.post("/api/files/upload", files={"file": ("x.csv", b"a\n1\n", "text/csv")})
    job_id = up.json()["job_id"]

    # Force status to PROCESSING then cancel
    import anyio

    async def _set_processing():
        async with app.state.sessionmaker() as session:
            await session.execute(update(Job).where(Job.id == uuid.UUID(job_id)).values(status=JobStatus.PROCESSING))
            await session.commit()

    anyio.run(_set_processing)

    d = client.delete(f"/api/jobs/{job_id}")
    assert d.status_code == 204

    g = client.get(f"/api/jobs/{job_id}")
    assert g.status_code == 200
    assert g.json()["status"] == "CANCELLED"


def test_retry_endpoint_rules_and_clears_errors(client, app, monkeypatch):
    from sqlalchemy import insert, update

    from repository_after.models import Job, JobStatus, ProcessingError

    # Prevent background processing re-queue from racing the assertions.
    monkeypatch.setattr("repository_after.api.settings.celery_task_always_eager", False)
    monkeypatch.setattr("repository_after.api.process_job", type("X", (), {"delay": lambda *_a, **_k: None})())

    job_id = uuid.uuid4()

    import anyio

    async def _seed_failed():
        async with app.state.sessionmaker() as session:
            await session.execute(
                insert(Job).values(
                    id=job_id,
                    filename="x.csv",
                    file_size=3,
                    file_type="csv",
                    status=JobStatus.FAILED,
                    progress=50,
                    rows_processed=10,
                    rows_failed=1,
                    error_message="boom",
                    webhook_url=None,
                )
            )
            await session.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.FAILED, error_message="boom"))
            await session.execute(
                insert(ProcessingError).values(
                    id=uuid.uuid4(),
                    job_id=job_id,
                    row_number=1,
                    column_name="a",
                    error_type="NULL",
                    error_message="Value required",
                    raw_value=None,
                )
            )
            await session.commit()

    anyio.run(_seed_failed)

    r = client.post(f"/api/jobs/{job_id}/retry")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "QUEUED"
    assert body["progress"] == 0
    assert body["rows_processed"] == 0
    assert body["rows_failed"] == 0
    assert body["error_message"] is None

    e = client.get(f"/api/jobs/{job_id}/errors")
    assert e.status_code == 200
    assert e.json()["total"] == 0

    async def _set_completed():
        async with app.state.sessionmaker() as session:
            await session.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.COMPLETED))
            await session.commit()

    anyio.run(_set_completed)

    bad = client.post(f"/api/jobs/{job_id}/retry")
    assert bad.status_code == 400


def test_health_returns_200_or_503(client, monkeypatch):
    # Force unhealthy redis path by patching health check
    async def _false(*_args, **_kwargs):
        return False

    monkeypatch.setattr("repository_after.api.check_redis_health", _false)

    r = client.get("/api/health")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "unhealthy"
    assert body["redis"] is False


@pytest.mark.asyncio
async def test_progress_interval_helper():
    from repository_after.tasks import _should_persist

    assert _should_persist(0.0, 5.0, 5.0) is True
    assert _should_persist(0.0, 4.99, 5.0) is False


def test_celery_config_values():
    from repository_after.celery_app import celery_app

    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.worker_concurrency == 4
    assert celery_app.conf.worker_max_tasks_per_child == 10
    assert celery_app.conf.task_soft_time_limit is not None
    assert celery_app.conf.task_time_limit is not None


@pytest.mark.asyncio
async def test_processing_uses_chunk_size_10000_for_csv(monkeypatch, tmp_path):
    from repository_after import tasks

    called = {}

    def fake_read_csv(path, chunksize):
        called["chunksize"] = chunksize
        # Yield a single empty chunk via pandas
        import pandas as pd

        yield pd.DataFrame([{"a": 1}])

    monkeypatch.setattr(tasks.pd, "read_csv", fake_read_csv)

    # Prepare tiny csv
    p = tmp_path / "f.csv"
    p.write_text("a\n1\n", encoding="utf-8")

    # Minimal session stub that satisfies calls
    class Sess:
        async def execute(self, *a, **k):
            class R:
                def scalar_one_or_none(self):
                    return type("J", (), {"status": tasks.JobStatus.PROCESSING})()

            return R()

        async def commit(self):
            return None

        def add(self, _obj):
            return None

    await tasks._process_csv(p, uuid.uuid4(), Sess())
    assert called["chunksize"] == 10_000


@pytest.mark.asyncio
async def test_processing_uses_openpyxl_read_only(monkeypatch, tmp_path):
    from repository_after import tasks

    called = {}

    class FakeWS:
        max_row = 1

        def iter_rows(self, values_only=True):
            yield ("a",)

    class FakeWB:
        active = FakeWS()

        def close(self):
            return None

    def fake_load_workbook(filename, read_only, data_only):
        called["read_only"] = read_only
        called["data_only"] = data_only
        return FakeWB()

    monkeypatch.setattr(tasks, "load_workbook", fake_load_workbook)

    p = tmp_path / "f.xlsx"
    p.write_bytes(b"not-a-real-xlsx")

    class Sess:
        async def execute(self, *a, **k):
            class R:
                def scalar_one_or_none(self):
                    return type("J", (), {"status": tasks.JobStatus.PROCESSING})()

            return R()

        async def commit(self):
            return None

        def add(self, _obj):
            return None

    await tasks._process_excel(p, uuid.uuid4(), Sess())
    assert called["read_only"] is True
    assert called["data_only"] is True


def test_processing_loads_valid_rows_into_db(client, app):
    # 2 valid + 2 invalid rows -> LoadedRow should contain 2 rows.
    csv_content = "a,b\n1,2\n,3\n4,\n5,6\n"
    up = client.post(
        "/api/files/upload",
        files={"file": ("data.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert up.status_code == 200
    job_id = up.json()["job_id"]

    import time

    deadline = time.time() + 2.0
    job_json = client.get(f"/api/jobs/{job_id}").json()
    while time.time() < deadline and job_json["status"] in ("QUEUED", "PROCESSING"):
        time.sleep(0.05)
        job_json = client.get(f"/api/jobs/{job_id}").json()

    assert job_json["status"] in ("COMPLETED", "FAILED")
    assert job_json["rows_processed"] >= 1
    assert job_json["rows_failed"] >= 1

    from sqlalchemy import func, select

    from repository_after.models import LoadedRow

    import anyio

    async def _count_loaded() -> int:
        async with app.state.sessionmaker() as session:
            return (
                await session.execute(
                    select(func.count()).select_from(LoadedRow).where(LoadedRow.job_id == uuid.UUID(job_id))
                )
            ).scalar_one()

    loaded = anyio.run(_count_loaded)
    assert loaded == (job_json["rows_processed"] - job_json["rows_failed"])
