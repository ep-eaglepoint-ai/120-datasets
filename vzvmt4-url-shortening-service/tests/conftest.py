import pytest
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

# Add repository_after to sys.path so we can import from src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../repository_after")))

from src.database import Base, get_db
from src import main_api, frontend_app

# Use in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for a test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def mock_reachability(monkeypatch):
    monkeypatch.setattr(main_api, "is_url_reachable", AsyncMock(return_value=True))
    yield


@pytest.fixture(scope="function")
def api_client(db_session):
    """Create a FastAPI TestClient for the API app with overridden DB dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    main_api.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main_api.app) as c:
        yield c
    main_api.app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def frontend_client():
    """Create a FastAPI TestClient for the frontend app."""
    with TestClient(frontend_app.app) as c:
        yield c
