from __future__ import annotations

from repository_after.feature_store.dsl import FeatureSource, SQLTransform, feature
from repository_after.feature_store.registry import FeatureRegistry, RegistrySettings


def test_registry_register_and_lineage_edges(tmp_path):
    db_path = tmp_path / "registry.db"
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    src = FeatureSource(name="events", kind="sql", identifier="events")

    base = feature(
        name="base_feature",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select user_id, event_time, 1 as base_feature from events"),
        description="base",
        owner="team",
        tags=["t1"],
        version="v1",
    )

    derived = feature(
        name="derived_feature",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select user_id, event_time, 2 as derived_feature from events"),
        description="derived",
        owner="team",
        tags=["t2"],
        version="v1",
        depends_on=["base_feature"],
    )

    reg.register(base)
    reg.register(derived)

    items = reg.list_features()
    names = {(i["name"], i["version"]) for i in items}
    assert ("base_feature", "v1") in names
    assert ("derived_feature", "v1") in names

    g = reg.lineage_graph()
    assert g.has_edge("base_feature", "derived_feature")


def test_registry_upsert_replaces_lineage(tmp_path):
    db_path = tmp_path / "registry.db"
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    src = FeatureSource(name="events", kind="sql", identifier="events")

    a = feature(
        name="a",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1"),
        description="a",
        owner="team",
        version="v1",
    )
    b = feature(
        name="b",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1"),
        description="b",
        owner="team",
        version="v1",
        depends_on=["a"],
    )

    reg.register(a)
    reg.register(b)
    assert reg.lineage_graph().has_edge("a", "b")

    # Update b so it no longer depends on a
    b2 = feature(
        name="b",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1"),
        description="b2",
        owner="team",
        version="v1",
        depends_on=[],
    )
    reg.register(b2)

    g = reg.lineage_graph()
    assert not g.has_edge("a", "b")
