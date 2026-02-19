from __future__ import annotations

import pandas as pd

from repository_after.feature_store.alerts import NoopAlertSink
from repository_after.feature_store.validation import FeatureValidator


class RecordingAlertSink(NoopAlertSink):
    def __init__(self):
        self.alerts = []

    def emit(self, *, alert_type, payload):
        self.alerts.append((alert_type, payload))


def test_schema_validation_success():
    df = pd.DataFrame([{"user_id": "u1", "f": 1.0}])
    v = FeatureValidator()
    res = v.validate_schema(df, required_columns=["user_id", "f"])
    assert res.success is True


def test_schema_validation_missing_column():
    df = pd.DataFrame([{"user_id": "u1"}])
    v = FeatureValidator()
    res = v.validate_schema(df, required_columns=["user_id", "f"])
    assert res.success is False
    assert "missing_columns" in res.details


def test_drift_psi_alert():
    alerts = RecordingAlertSink()
    v = FeatureValidator(alert_sink=alerts)

    training = pd.Series([0] * 100 + [1] * 100)
    serving = pd.Series([0] * 10 + [1] * 190)

    res = v.detect_drift_psi(training=training, serving=serving, threshold=0.05, feature_name="f")
    assert res.metric == "psi"
    assert res.violated is True
    assert len(alerts.alerts) == 1
