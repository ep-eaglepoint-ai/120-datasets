import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _test_env(tmp_path_factory):
    upload_dir = tmp_path_factory.mktemp("uploads")
    db_path = tmp_path_factory.mktemp("db") / "test.db"

    os.environ.setdefault("UPLOAD_DIR", str(upload_dir))
    os.environ.setdefault("AUTO_CREATE_DB", "true")

    # Make oversized upload testing feasible.
    os.environ.setdefault("MAX_UPLOAD_BYTES", str(64 * 1024))

    # Force eager Celery so unit tests don't need a worker process.
    os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "true")

    # Self-contained DB for unit tests.
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")
    # Redis is mocked in health tests.
    os.environ.setdefault("REDIS_URL", "redis://does-not-exist:6379/0")


@pytest.fixture(scope="session")
def app():
    # Import after env vars are set.
    from repository_after.api import app as fastapi_app

    return fastapi_app


@pytest.fixture()
def client(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
