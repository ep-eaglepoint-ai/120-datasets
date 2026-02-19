# tests/test_structure_before_after.py
"""Structural tests: package layout, exports, dataclasses, internal helpers.
When run with PYTHONPATH=repository_before, these fail if before lacks expected structure.
When run with PYTHONPATH=repository_after, these pass.
"""
from __future__ import annotations

import dataclasses
import pytest

import structural_scaling
from structural_scaling import diagnostics, power_transform


# --- Structural: modules exist ---


def test_diagnostics_module_exists():
    # Structural: diagnostics module
    assert diagnostics is not None
    assert hasattr(diagnostics, "normality_report")


def test_power_transform_module_exists():
    # Structural: power_transform module
    assert power_transform is not None
    assert hasattr(power_transform, "fit_transform_power")


# --- Structural: diagnostics has _to_1d_float_array, normality_report, improved_normality, approx_normal_by_moments ---


def test_diagnostics_has_to_1d_float_array():
    # Structural: diagnostics internal helper
    assert hasattr(diagnostics, "_to_1d_float_array")
    assert callable(getattr(diagnostics, "_to_1d_float_array"))


def test_diagnostics_has_normality_report():
    # Structural: diagnostics public API
    assert hasattr(diagnostics, "normality_report")
    assert callable(diagnostics.normality_report)


def test_diagnostics_has_improved_normality():
    # Structural: diagnostics public API
    assert hasattr(diagnostics, "improved_normality")
    assert callable(diagnostics.improved_normality)


def test_diagnostics_has_approx_normal_by_moments():
    # Structural: diagnostics public API
    assert hasattr(diagnostics, "approx_normal_by_moments")
    assert callable(diagnostics.approx_normal_by_moments)


# --- Structural: NormalityMetrics dataclass with required fields ---


def test_normality_metrics_is_dataclass_with_required_fields():
    # Structural: NormalityMetrics dataclass
    assert hasattr(diagnostics, "NormalityMetrics")
    NormalityMetrics = diagnostics.NormalityMetrics
    assert dataclasses.is_dataclass(NormalityMetrics)
    fields = {f.name for f in dataclasses.fields(NormalityMetrics)}
    required = {"n", "skewness", "kurtosis_fisher", "test_name", "test_statistic", "p_value"}
    assert required.issubset(fields), f"NormalityMetrics missing fields: {required - fields}"


def test_normality_metrics_is_frozen():
    # Structural: NormalityMetrics frozen
    NormalityMetrics = diagnostics.NormalityMetrics
    assert dataclasses.is_dataclass(NormalityMetrics)
    m = NormalityMetrics(n=1, skewness=0.0, kurtosis_fisher=0.0, test_name="x", test_statistic=0.0, p_value=0.5)
    with pytest.raises(Exception):  # FrozenInstanceError when assigning
        m.n = 2


# --- Structural: power_transform has fit_transform_power, invertibility_check, TransformResult ---


def test_power_transform_has_fit_transform_power():
    # Structural: power_transform public API
    assert hasattr(power_transform, "fit_transform_power")
    assert callable(power_transform.fit_transform_power)


def test_power_transform_has_invertibility_check():
    # Structural: power_transform public API
    assert hasattr(power_transform, "invertibility_check")
    assert callable(power_transform.invertibility_check)


def test_transform_result_is_dataclass_with_transformed_transformer():
    # Structural: TransformResult dataclass
    assert hasattr(power_transform, "TransformResult")
    TransformResult = power_transform.TransformResult
    assert dataclasses.is_dataclass(TransformResult)
    fields = {f.name for f in dataclasses.fields(TransformResult)}
    assert "transformed" in fields
    assert "transformer" in fields


# --- Structural: __init__ __all__ contains required exports ---


def test_init_all_contains_required_exports():
    # Structural: package __all__
    assert hasattr(structural_scaling, "__all__")
    required = {
        "fit_transform_power",
        "invertibility_check",
        "normality_report",
        "improved_normality",
        "approx_normal_by_moments",
    }
    actual = set(structural_scaling.__all__)
    assert required.issubset(actual), f"__all__ missing: {required - actual}"


def test_required_exports_are_importable():
    # Structural: exports are importable from package
    from structural_scaling import (
        fit_transform_power,
        invertibility_check,
        normality_report,
        improved_normality,
        approx_normal_by_moments,
    )
    assert callable(fit_transform_power)
    assert callable(invertibility_check)
    assert callable(normality_report)
    assert callable(improved_normality)
    assert callable(approx_normal_by_moments)


# --- Structural: after-only (exist in repository_after, not in repository_before) ---


def test_power_transform_has_supported_methods_constant():
    # Structural (after-only): power_transform defines SUPPORTED_METHODS
    assert hasattr(power_transform, "SUPPORTED_METHODS")
    methods = getattr(power_transform, "SUPPORTED_METHODS")
    assert methods == ("yeo-johnson", "box-cox")


def test_diagnostics_has_max_sample_size_for_shapiro():
    # Structural (after-only): diagnostics defines MAX_SAMPLE_SIZE_FOR_SHAPIRO
    assert hasattr(diagnostics, "MAX_SAMPLE_SIZE_FOR_SHAPIRO")
    assert getattr(diagnostics, "MAX_SAMPLE_SIZE_FOR_SHAPIRO") == 20


def test_transform_result_has_is_finite_method():
    # Structural (after-only): TransformResult has is_finite() method
    TransformResult = power_transform.TransformResult
    assert hasattr(TransformResult, "is_finite")
    import numpy as np
    from sklearn.preprocessing import PowerTransformer
    pt = PowerTransformer(method="yeo-johnson")
    tr = TransformResult(transformed=np.array([0.0, 1.0]), transformer=pt)
    assert tr.is_finite() is True
