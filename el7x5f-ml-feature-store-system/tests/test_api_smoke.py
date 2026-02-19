from __future__ import annotations

from fastapi.testclient import TestClient

import fakeredis

from feature_store.api import AppSettings, create_app
from feature_store.dsl import FeatureSource, SQLTransform, feature
from feature_store.registry import FeatureRegistry, RegistrySettings


def test_api_health_and_feature_listing(monkeypatch, tmp_path):
    # Mock Redis
    import redis as redis_mod

    fake = fakeredis.FakeRedis(decode_responses=True)

    def _from_url(url, decode_responses=True):
        return fake

    monkeypatch.setattr(redis_mod.Redis, "from_url", staticmethod(_from_url))

    db_path = tmp_path / "registry.db"
    app = create_app(
        AppSettings(
            database_url=f"sqlite+pysqlite:///{db_path}",
            redis_url="redis://does-not-matter/0",
        )
    )

    client = TestClient(app)

    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    # Register a feature via registry directly and confirm discovery endpoint
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    src = FeatureSource(name="events", kind="sql", identifier="events")
    f = feature(
        name="f1",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1"),
        description="desc",
        owner="team",
        version="v1",
    )
    reg.register(f)

    r = client.get("/features")
    assert r.status_code == 200
    payload = r.json()
    assert any(item["name"] == "f1" for item in payload)

    r = client.get("/lineage")
    assert r.status_code == 200
    assert "nodes" in r.json()
