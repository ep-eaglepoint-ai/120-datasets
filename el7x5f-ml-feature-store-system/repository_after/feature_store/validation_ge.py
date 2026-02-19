from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

import pandas as pd

from .alerts import AlertSink, NoopAlertSink
from .drift import DriftResult, population_stability_index


def _require_ge():
    try:
        import great_expectations as ge  # type: ignore

        return ge
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "Great Expectations is required for this validator (dependency missing)."
        ) from e


@dataclass(frozen=True)
class GEValidationResult:
    success: bool
    details: Dict[str, Any]


class GreatExpectationsValidator:
    """Great Expectations-based validation (optional dependency).

    This adapter focuses on the core requirements:
    - schema enforcement (required columns, non-null)
    - automatic profiling (basic numeric bounds) into an expectation suite
    - validation execution

    For production, users can replace the suite generation with their own GE
    DataContext + store-backed suites.
    """

    def __init__(self, *, alert_sink: Optional[AlertSink] = None):
        self._alert_sink = alert_sink or NoopAlertSink()

    def build_suite_from_profile(
        self,
        *,
        df: pd.DataFrame,
        suite_name: str,
        required_columns: Optional[Sequence[str]] = None,
    ):
        ge = _require_ge()

        required_columns = list(required_columns or [])

        # Use a lightweight, in-memory GE dataset facade.
        try:
            ge_df = ge.from_pandas(df)
        except Exception:
            # Older GE versions
            ge_df = ge.dataset.PandasDataset(df)

        suite = ge_df.get_expectation_suite(discard_failed_expectations=True)
        suite.expectation_suite_name = suite_name

        for c in required_columns:
            ge_df.expect_column_to_exist(c)
            ge_df.expect_column_values_to_not_be_null(c)

        # Minimal profiling: numeric columns -> min/max bounds.
        for c in df.columns:
            s = df[c]
            if pd.api.types.is_numeric_dtype(s) and s.dropna().size:
                lo = float(s.min())
                hi = float(s.max())
                ge_df.expect_column_values_to_be_between(c, min_value=lo, max_value=hi)

        return ge_df.get_expectation_suite(discard_failed_expectations=False)

    def validate(
        self,
        *,
        df: pd.DataFrame,
        suite,
        feature_name: str = "<feature>",
    ) -> GEValidationResult:
        ge = _require_ge()

        try:
            ge_df = ge.from_pandas(df)
        except Exception:
            ge_df = ge.dataset.PandasDataset(df)

        res = ge_df.validate(expectation_suite=suite)
        success = bool(res.get("success"))
        if not success:
            self._alert_sink.emit(
                alert_type="feature_validation_failed",
                payload={"feature": feature_name, "result": res},
            )
        return GEValidationResult(success=success, details=res)


class GreatExpectationsFeatureMonitor:
    """GE-based feature validation + drift monitoring.

    Implements the core lifecycle monitoring requirements:
    - automatic profile generation -> expectation suite
    - schema enforcement via expectations
    - drift detection (PSI) comparing training vs serving distributions
    - alerting via an AlertSink

    GE remains optional: drift detection does not require GE, but suite creation
    and validation do.
    """

    def __init__(self, *, alert_sink: Optional[AlertSink] = None):
        self._alert_sink = alert_sink or NoopAlertSink()
        self._validator = GreatExpectationsValidator(alert_sink=self._alert_sink)

    def build_suite_from_training_profile(
        self,
        *,
        training_df: pd.DataFrame,
        suite_name: str,
        required_columns: Optional[Sequence[str]] = None,
    ):
        return self._validator.build_suite_from_profile(
            df=training_df,
            suite_name=suite_name,
            required_columns=required_columns,
        )

    def validate_serving(
        self,
        *,
        serving_df: pd.DataFrame,
        suite,
        feature_name: str = "<feature>",
    ) -> GEValidationResult:
        return self._validator.validate(df=serving_df, suite=suite, feature_name=feature_name)

    def detect_drift_psi(
        self,
        *,
        training_df: pd.DataFrame,
        serving_df: pd.DataFrame,
        feature_columns: Sequence[str],
        threshold: float,
        bins: int = 10,
        feature_set: str = "<feature_set>",
    ) -> Dict[str, DriftResult]:
        """Compute PSI drift for numeric feature columns and emit alerts if violated."""

        out: Dict[str, DriftResult] = {}
        for col in feature_columns:
            if col not in training_df.columns or col not in serving_df.columns:
                continue
            tr = training_df[col]
            sv = serving_df[col]
            if not (pd.api.types.is_numeric_dtype(tr) and pd.api.types.is_numeric_dtype(sv)):
                continue

            value = population_stability_index(
                expected=tr.dropna().tolist(),
                actual=sv.dropna().tolist(),
                bins=bins,
            )
            violated = (not pd.isna(value)) and value > threshold
            res = DriftResult(metric="psi", value=value, threshold=threshold, violated=violated)
            out[col] = res
            if violated:
                self._alert_sink.emit(
                    alert_type="feature_drift",
                    payload={
                        "feature_set": feature_set,
                        "feature": col,
                        "metric": "psi",
                        "value": value,
                        "threshold": threshold,
                    },
                )
        return out
