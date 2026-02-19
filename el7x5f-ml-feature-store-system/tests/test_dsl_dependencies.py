from __future__ import annotations

import pytest

from repository_after.feature_store.dsl import FeatureSource, SQLTransform, PythonTransform, depends_on, feature


def test_sql_dependency_inference_from_placeholders():
    src = FeatureSource(name="events", kind="sql", identifier="events")
    f = feature(
        name="derived",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select * from {{base_feature}}"),
        description="d",
        owner="team",
    )
    assert f.depends_on == ("base_feature",)


def test_python_dependency_inference_from_decorator():
    src = FeatureSource(name="events", kind="custom", identifier="")

    @depends_on("a", "b")
    def _tx(_sources):
        return None

    f = feature(
        name="c",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=PythonTransform(func=_tx),
        description="c",
        owner="team",
    )
    assert set(f.depends_on) == {"a", "b"}
