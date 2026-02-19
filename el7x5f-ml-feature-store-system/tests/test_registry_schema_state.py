from __future__ import annotations

from repository_after.feature_store.dsl import FeatureSource, SQLTransform, feature
from repository_after.feature_store.registry import FeatureRegistry, RegistrySettings


def test_registry_persists_schema_and_default_value(tmp_path):
    db_path = tmp_path / "registry.db"
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    src = FeatureSource(name="events", kind="sql", identifier="events")

    f = feature(
        name="f1",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select user_id, event_time, 1 as f1 from events"),
        description="f1",
        owner="team",
        version="v1",
        default_value=0,
        schema={"columns": {"user_id": "string", "event_time": "timestamp", "f1": "int"}},
    )

    reg.register(f)

    items = reg.list_features()
    row = next(i for i in items if i["name"] == "f1" and i["version"] == "v1")
    assert row["default_value"] == 0
    assert row["schema"]["columns"]["f1"] == "int"


def test_registry_processing_state_roundtrip(tmp_path):
    db_path = tmp_path / "registry.db"
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    reg.set_processing_state(
        feature_name="f1",
        feature_version="v1",
        state_key="batch_watermark",
        state={"watermark": "2026-01-01T00:00:00+00:00"},
    )
    state = reg.get_processing_state(feature_name="f1", feature_version="v1", state_key="batch_watermark")
    assert state == {"watermark": "2026-01-01T00:00:00+00:00"}
