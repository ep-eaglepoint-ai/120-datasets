# tests/test_unit_power_transform.py
"""Unit tests: method-specific domain (Box-Cox vs Yeo-Johnson), finite outputs, lambda stability."""
from __future__ import annotations

import numpy as np
import pytest

from structural_scaling import fit_transform_power


# --- Requirement 5: Box-Cox raises ValueError when any value <= 0; message includes min value ---


def test_box_cox_rejects_zero_raises_value_error_with_min():
    # Requirements: 5
    x = np.array([1.0, 0.0, 3.0])
    with pytest.raises(ValueError) as exc_info:
        fit_transform_power(x, method="box-cox")
    assert "Box-Cox requires all values > 0" in str(exc_info.value)
    assert "min=" in str(exc_info.value) or "Found min" in str(exc_info.value)


def test_box_cox_rejects_negative_raises_value_error_with_min():
    # Requirements: 5
    x = np.array([1.0, -0.5, 3.0])
    with pytest.raises(ValueError) as exc_info:
        fit_transform_power(x, method="box-cox")
    assert "Box-Cox requires all values > 0" in str(exc_info.value)
    assert "-0.5" in str(exc_info.value) or "min=" in str(exc_info.value)


def test_box_cox_accepts_strictly_positive():
    # Requirements: 5, 7
    x = np.array([1e-6, 1.0, 1e3])
    res = fit_transform_power(x, method="box-cox")
    assert np.all(np.isfinite(res.transformed))


# --- Requirement 6: Yeo-Johnson accepts negative, zero, positive; returns finite outputs ---


def test_yeo_johnson_accepts_negative_zero_positive():
    # Requirements: 6
    x = np.array([-2.0, 0.0, 1.0, 3.0])
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))
    assert res.transformed.shape == (4,)


def test_yeo_johnson_accepts_all_negative():
    # Requirements: 6
    x = np.array([-5.0, -1.0, -0.1])
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))


# --- Requirement 7: For any valid input, transformed output contains only finite values ---


@pytest.mark.parametrize("method", ["yeo-johnson", "box-cox"])
def test_transformed_output_finite_positive_data(positive_1d, method):
    # Requirements: 7
    """Both methods produce finite output for strictly positive 1D input (parametrized)."""
    res = fit_transform_power(positive_1d, method=method)
    assert np.all(np.isfinite(res.transformed))


def test_transformed_output_finite_yeo_johnson_mixed_sign(mixed_sign_1d):
    # Requirements: 7
    res = fit_transform_power(mixed_sign_1d, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))


# --- Requirement 10: Two fits on same deterministic input yield identical lambdas_ (tight tolerance) ---


@pytest.mark.parametrize("method", ["yeo-johnson", "box-cox"])
def test_lambda_stable_under_repeated_fit(rng, method):
    # Requirements: 10
    """Stable lambda estimation across repeated fits (parametrized by method)."""
    if method == "yeo-johnson":
        x = rng.standard_normal(500)
    else:
        x = rng.uniform(0.1, 10.0, size=500)
    res1 = fit_transform_power(x, method=method)
    res2 = fit_transform_power(x, method=method)
    np.testing.assert_array_almost_equal(
        res1.transformer.lambdas_,
        res2.transformer.lambdas_,
        decimal=10,
        err_msg="lambdas_ must be identical for repeated fits on same input",
    )
