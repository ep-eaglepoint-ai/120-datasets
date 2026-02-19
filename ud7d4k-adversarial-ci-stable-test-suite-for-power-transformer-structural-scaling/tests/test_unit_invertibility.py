# tests/test_unit_invertibility.py
"""Unit tests: invertibility_check True/False and shape mismatch (Requirements 8–9)."""
from __future__ import annotations

import numpy as np
import pytest

from structural_scaling import fit_transform_power, invertibility_check


# --- Requirement 8: invertibility_check returns True for correct triple; False for corrupted ---


@pytest.mark.parametrize("method,data_kind", [
    ("box-cox", "positive"),
    ("yeo-johnson", "mixed"),
])
def test_invertibility_check_returns_true_for_correct_triple(rng, method, data_kind):
    # Requirements: 8
    """Correct (original, transformed, transformer) passes within tolerance (parametrized)."""
    if data_kind == "positive":
        x = rng.uniform(0.1, 10.0, size=100)
    else:
        x = rng.standard_normal(100)
    res = fit_transform_power(x, method=method)
    assert invertibility_check(x, res.transformed, res.transformer) is True


def test_invertibility_check_returns_false_for_corrupted_transformed():
    # Requirements: 8
    rng = np.random.default_rng(42)
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    corrupted = res.transformed.copy()
    corrupted[0] += 100.0
    assert invertibility_check(x, corrupted, res.transformer) is False


def test_invertibility_check_returns_false_when_original_tampered():
    # Requirements: 8
    rng = np.random.default_rng(42)
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    wrong_original = x + 1.0
    assert invertibility_check(wrong_original, res.transformed, res.transformer) is False


def test_invertibility_check_custom_atol():
    # Requirements: 8
    rng = np.random.default_rng(42)
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-10) is True


# --- Requirement 9: invertibility_check raises shape mismatch ValueError if lengths differ ---


def test_invertibility_check_shape_mismatch_raises_value_error(rng):
    # Requirements: 9
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    shorter = res.transformed[:25]
    with pytest.raises(ValueError, match="Shape mismatch"):
        invertibility_check(x, shorter, res.transformer)


def test_invertibility_check_shape_mismatch_longer_transformed(rng):
    # Requirements: 9
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    longer = np.concatenate([res.transformed, [0.0]])
    with pytest.raises(ValueError, match="Shape mismatch"):
        invertibility_check(x, longer, res.transformer)


def test_invertibility_check_rejects_nan_in_original(rng):
    # Requirements: 1, 8
    x = rng.uniform(0.1, 10.0, size=50)
    res = fit_transform_power(x, method="box-cox")
    bad_original = x.copy()
    bad_original[0] = np.nan
    with pytest.raises(ValueError, match="NaN or infinite"):
        invertibility_check(bad_original, res.transformed, res.transformer)


def test_invertibility_check_rejects_empty_original():
    # Requirements: 2, 9
    x = np.array([1.0])
    res = fit_transform_power(x, method="yeo-johnson")
    with pytest.raises(ValueError, match="empty"):
        invertibility_check(np.array([]), res.transformed, res.transformer)
