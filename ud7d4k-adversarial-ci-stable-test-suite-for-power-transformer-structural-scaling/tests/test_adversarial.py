# tests/test_adversarial.py
"""Negative and adversarial tests: nearly-constant, extremely skewed, large dynamic range, edge cases. Prompt: adversarial."""
from __future__ import annotations

import numpy as np
import pytest

from structural_scaling import fit_transform_power, invertibility_check, normality_report


def test_nearly_constant_array_yeo_johnson():
    # Prompt: adversarial (nearly constant)
    x = np.full(100, 5.0) + np.random.default_rng(42).uniform(-1e-10, 1e-10, 100)
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-6) is True


def test_nearly_constant_array_box_cox():
    # Prompt: adversarial (nearly constant)
    x = np.full(100, 5.0) + np.random.default_rng(42).uniform(1e-10, 2e-10, 100)
    res = fit_transform_power(x, method="box-cox")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-6) is True


def test_extremely_skewed_positive_yeo_johnson(rng):
    # Prompt: adversarial (extremely skewed)
    x = rng.lognormal(mean=2.0, sigma=2.0, size=500)
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-6) is True


def test_extremely_skewed_positive_box_cox(rng):
    # Prompt: adversarial (extremely skewed)
    x = rng.lognormal(mean=2.0, sigma=2.0, size=500)
    res = fit_transform_power(x, method="box-cox")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-6) is True


def test_large_dynamic_range_yeo_johnson():
    # Prompt: adversarial (large dynamic range 1e-9 to 1e9)
    x = np.array([1e-9, 1e0, 1e3, 1e6, 1e9])
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-5) is True


def test_large_dynamic_range_box_cox():
    # Prompt: adversarial (large dynamic range)
    x = np.array([1e-9, 1e0, 1e3, 1e6, 1e9])
    res = fit_transform_power(x, method="box-cox")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-4) is True


def test_single_element_yeo_johnson():
    # Prompt: adversarial (edge case)
    x = np.array([1.0])
    res = fit_transform_power(x, method="yeo-johnson")
    assert res.transformed.shape == (1,)
    assert np.isfinite(res.transformed[0])


def test_single_element_box_cox():
    # Prompt: adversarial (edge case). Box-Cox with one value is constant; sklearn raises. Use two distinct positives.
    x = np.array([1.0, 2.0])
    res = fit_transform_power(x, method="box-cox")
    assert res.transformed.shape == (2,)
    assert np.all(np.isfinite(res.transformed))


def test_single_element_box_cox_constant_raises():
    # Prompt: adversarial. Single constant value is invalid for Box-Cox (sklearn: "Data must not be constant").
    x = np.array([1.0])
    with pytest.raises(ValueError, match="constant|Constant"):
        fit_transform_power(x, method="box-cox")


def test_box_cox_rejects_single_zero():
    # Requirements: 5; Prompt: adversarial
    x = np.array([0.0])
    with pytest.raises(ValueError, match="Box-Cox requires all values > 0"):
        fit_transform_power(x, method="box-cox")


def test_2d_matrix_rejected_not_column_vector():
    # Requirements: 3; Prompt: adversarial
    x2 = np.array([[1.0, 2.0]])
    with pytest.raises(ValueError, match="Expected 1D array"):
        fit_transform_power(x2, method="yeo-johnson")


def test_normality_report_nearly_constant_does_not_raise():
    # Requirements: 11; Prompt: adversarial
    x = np.full(25, 3.0)
    m = normality_report(x, test="normaltest")
    assert m.n == 25
    assert m.test_name == "normaltest"
