from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

import pandas as pd

from .alerts import AlertSink, NoopAlertSink
from .drift import DriftResult, population_stability_index


@dataclass(frozen=True)
class ValidationResult:
    success: bool
    details: Dict[str, Any]


class FeatureValidator:
    """Lightweight validation & monitoring.

    This is a production-friendly baseline that avoids heavy optional
    dependencies. It provides:
    - automatic profiling (simple stats)
    - schema enforcement (required columns + non-null)
    - drift detection via PSI + alert sink

    If you want full Great Expectations, integrate it as an optional layer on
    top of this interface.
    """

    def __init__(self, *, alert_sink: Optional[AlertSink] = None):
        self._alert_sink = alert_sink or NoopAlertSink()

    def profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        profile: Dict[str, Any] = {"columns": {}}
        for c in df.columns:
            s = df[c]
            col = {"dtype": str(s.dtype), "null_fraction": float(s.isna().mean())}
            if pd.api.types.is_numeric_dtype(s):
                col.update(
                    {
                        "min": float(s.min()),
                        "max": float(s.max()),
                        "mean": float(s.mean()),
                        "std": float(s.std(ddof=0)),
                    }
                )
            profile["columns"][c] = col
        return profile

    def validate_schema(self, df: pd.DataFrame, *, required_columns: Sequence[str]) -> ValidationResult:
        missing = [c for c in required_columns if c not in df.columns]
        if missing:
            return ValidationResult(success=False, details={"missing_columns": missing})

        nulls = [c for c in required_columns if df[c].isna().any()]
        if nulls:
            return ValidationResult(success=False, details={"nulls_in_required_columns": nulls})

        return ValidationResult(success=True, details={"required_columns": list(required_columns)})

    def detect_drift_psi(
        self,
        *,
        training: pd.Series,
        serving: pd.Series,
        threshold: float,
        bins: int = 10,
        feature_name: str = "<feature>",
    ) -> DriftResult:
        value = population_stability_index(expected=training.dropna(), actual=serving.dropna(), bins=bins)
        violated = (not pd.isna(value)) and value > threshold
        result = DriftResult(metric="psi", value=value, threshold=threshold, violated=violated)
        if violated:
            self._alert_sink.emit(
                alert_type="feature_drift",
                payload={"feature": feature_name, "metric": "psi", "value": value, "threshold": threshold},
            )
        return result
