from __future__ import annotations

from repository_after.feature_store.catalog_hooks import NoopCatalogHook
from repository_after.feature_store.dsl import FeatureSource, SQLTransform, feature
from repository_after.feature_store.registry import FeatureRegistry, RegistrySettings


class RecordingCatalogHook(NoopCatalogHook):
    def __init__(self):
        self.published = []

    def publish_feature(self, feature_definition):
        self.published.append(feature_definition)


def test_catalog_hook_called(tmp_path):
    db_path = tmp_path / "registry.db"
    reg = FeatureRegistry(RegistrySettings(database_url=f"sqlite+pysqlite:///{db_path}"))
    reg.create_schema()

    hook = RecordingCatalogHook()

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

    reg.register(f, catalog_hook=hook)

    assert len(hook.published) == 1
    assert hook.published[0]["name"] == "f1"
    assert hook.published[0]["version"] == "v1"
