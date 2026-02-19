from __future__ import annotations

import pandas as pd

from repository_after.feature_store.dsl import FeatureSource, SQLTransform, feature
from repository_after.feature_store.integrations.mlflow import log_feature_definition
from repository_after.feature_store.validation_ge import GreatExpectationsValidator


def test_mlflow_integration_logs_feature_tags(tmp_path):
    import mlflow

    mlflow.set_tracking_uri(f"file:{tmp_path}/mlruns")

    src = FeatureSource(name="events", kind="sql", identifier="events")
    f = feature(
        name="f1",
        entity_keys=["user_id"],
        event_timestamp="event_time",
        source=src,
        transform=SQLTransform(sql="select 1"),
        description="f1",
        owner="team",
    )

    with mlflow.start_run() as run:
        log_feature_definition(feature=f)
        run_id = run.info.run_id

    data = mlflow.get_run(run_id).data
    assert data.tags["feature.name"] == "f1"
    assert data.tags["feature.version"] == "v1"


def test_great_expectations_validator_builds_suite_and_validates():
    df = pd.DataFrame({"user_id": ["u1"], "event_time": ["2026-01-01"], "f1": [1]})
    v = GreatExpectationsValidator()

    suite = v.build_suite_from_profile(df=df, suite_name="s", required_columns=["user_id", "event_time", "f1"])
    res = v.validate(df=df, suite=suite, feature_name="f1")
    assert res.success is True
