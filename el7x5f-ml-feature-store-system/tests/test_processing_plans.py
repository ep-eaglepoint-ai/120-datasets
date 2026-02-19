from __future__ import annotations

import pytest

from repository_after.feature_store.dsl import FeatureSource, SQLTransform, feature
from repository_after.feature_store.processing_batch import SparkBatchProcessor, SparkBatchSettings
from repository_after.feature_store.processing_stream import (
    AggregationSpec,
    FaustStreamProcessor,
    StreamFeatureSpec,
    StreamSettings,
    WindowSpec,
)


def test_batch_plan_execution_order_toposort():
    src = FeatureSource(name="events", kind="sql", identifier="events")
    a = feature(
        name="a",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1 as a"),
        description="a",
        owner="team",
    )
    b = feature(
        name="b",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select * from {{a}}"),
        description="b",
        owner="team",
    )

    p = SparkBatchProcessor(SparkBatchSettings())
    order = [f.name for f in p.plan_execution_order([b, a])]
    assert order == ["a", "b"]


def test_stream_spec_validation_does_not_require_faust():
    proc = FaustStreamProcessor(StreamSettings())
    specs = [
        StreamFeatureSpec(
            feature_set="fs",
            source_topic="events",
            entity_key_field="user_id",
            event_time_field="event_time",
            aggregations=[
                AggregationSpec(
                    name="cnt_5m",
                    func="count",
                    window=WindowSpec(kind="tumbling", size="5 minutes"),
                )
            ],
        )
    ]
    proc.validate_specs(specs)


def test_stream_build_app_requires_faust(monkeypatch):
    # If faust isn't installed, building should fail fast with a clear error.
    proc = FaustStreamProcessor(StreamSettings())
    specs = [
        StreamFeatureSpec(
            feature_set="fs",
            source_topic="events",
            entity_key_field="user_id",
            event_time_field="event_time",
            aggregations=[
                AggregationSpec(
                    name="cnt_5m",
                    func="count",
                    window=WindowSpec(kind="tumbling", size="5 minutes"),
                )
            ],
        )
    ]

    class _DummyOnline:
        def write_features(self, **kwargs):
            raise AssertionError("not called")

        def get_features(self, **kwargs):
            raise AssertionError("not called")

        def get_features_batch(self, **kwargs):
            raise AssertionError("not called")

    with pytest.raises(RuntimeError, match="Faust is required"):
        proc.build_app(broker="kafka://localhost:9092", specs=specs, online_store=_DummyOnline())
