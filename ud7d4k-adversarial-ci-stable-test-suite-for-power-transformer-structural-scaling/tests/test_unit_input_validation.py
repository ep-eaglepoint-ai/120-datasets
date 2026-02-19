# tests/test_unit_input_validation.py
"""Pure unit tests: strict input validation invariants.
Requirements 1–4: NaN/inf rejection, empty arrays, non-1D/ragged, dtype coercion.
"""
from __future__ import annotations

import numpy as np
import pytest

from structural_scaling import fit_transform_power, normality_report


# --- Requirement 1: Reject inputs containing NaN or ±inf with clear ValueError ---


def test_reject_nan_raises_value_error_fit_transform():
    # Requirements: 1
    x = np.array([1.0, np.nan, 3.0])
    with pytest.raises(ValueError, match="NaN or infinite"):
        fit_transform_power(x, method="yeo-johnson")


def test_reject_nan_raises_value_error_normality_report():
    # Requirements: 1
    x = np.array([1.0, np.nan, 3.0])
    with pytest.raises(ValueError, match="NaN or infinite"):
        normality_report(x)


def test_reject_positive_inf_raises_value_error():
    # Requirements: 1
    x = np.array([1.0, np.inf, 3.0])
    with pytest.raises(ValueError, match="NaN or infinite"):
        fit_transform_power(x, method="yeo-johnson")


def test_reject_negative_inf_raises_value_error():
    # Requirements: 1
    x = np.array([1.0, -np.inf, 3.0])
    with pytest.raises(ValueError, match="NaN or infinite"):
        fit_transform_power(x, method="yeo-johnson")


# --- Requirement 2: Reject empty arrays with clear ValueError ---


def test_reject_empty_array_raises_value_error_fit_transform():
    # Requirements: 2
    x = np.array([])
    with pytest.raises(ValueError, match="empty"):
        fit_transform_power(x, method="yeo-johnson")


def test_reject_empty_array_raises_value_error_normality_report():
    # Requirements: 2
    x = np.array([])
    with pytest.raises(ValueError, match="empty"):
        normality_report(x)


# --- Requirement 3: Reject non-1D except (n,1) column vector; accept (n,1) and flatten ---


def test_reject_2d_matrix_raises_value_error():
    # Requirements: 3
    x = np.array([[1.0, 2.0], [3.0, 4.0]])
    with pytest.raises(ValueError, match="Expected 1D array.*Got shape"):
        fit_transform_power(x, method="yeo-johnson")


def test_accept_2d_column_vector_and_flatten():
    # Requirements: 3
    x = np.array([[1.0], [2.0], [3.0]])
    res = fit_transform_power(x, method="yeo-johnson")
    assert res.transformed.ndim == 1
    assert res.transformed.shape == (3,)


def test_reject_3d_raises_value_error():
    # Requirements: 3
    x = np.ones((2, 2, 2))
    with pytest.raises(ValueError, match="Expected 1D array"):
        fit_transform_power(x, method="yeo-johnson")


# --- Requirement 4: Coerce valid numeric inputs to float dtype, preserve shape (n,) in outputs ---


def test_coerce_int_to_float_and_output_shape():
    # Requirements: 4
    x = np.array([1, 2, 3, 4, 5], dtype=np.int32)
    res = fit_transform_power(x, method="yeo-johnson")
    assert res.transformed.dtype == np.float64
    assert res.transformed.shape == (5,)


def test_coerce_float32_to_float_output():
    # Requirements: 4
    x = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    res = fit_transform_power(x, method="yeo-johnson")
    assert res.transformed.dtype == np.float64
    assert res.transformed.shape == (3,)


def test_list_input_coerced_to_float_1d():
    # Requirements: 4
    x = [1.0, 2.0, 3.0]
    res = fit_transform_power(x, method="yeo-johnson")
    assert res.transformed.ndim == 1
    assert res.transformed.shape == (3,)


# --- Ragged / non-coercible: must not be silently accepted (prompt: ragged arrays, dtype edge cases) ---


def test_object_array_with_non_numeric_raises():
    # Requirements: 3, 4 (dtype edge cases)
    """Object dtype that cannot be coerced to float must raise (reject ragged/non-numeric)."""
    x = np.array([1.0, "not_a_number", 3.0], dtype=object)
    with pytest.raises((ValueError, TypeError)):
        fit_transform_power(x, method="yeo-johnson")


def test_normality_report_rejects_object_non_numeric():
    # Requirements: 3, 4
    x = np.array([1.0, "x", 2.0], dtype=object)
    with pytest.raises((ValueError, TypeError)):
        normality_report(x)
