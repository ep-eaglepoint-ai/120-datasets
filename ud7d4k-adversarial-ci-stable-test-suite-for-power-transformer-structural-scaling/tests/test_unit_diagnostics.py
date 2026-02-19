# tests/test_unit_diagnostics.py
"""Unit tests: normality_report fallback (n<20), unknown test. Requirement 11."""
from __future__ import annotations

import numpy as np
import pytest

from structural_scaling import normality_report


# --- Requirement 11: normality_report(test='normaltest') falls back to Shapiro-Wilk when n<20; test_name reflects it ---


def test_normaltest_falls_back_to_shapiro_when_n_less_than_20():
    # Requirements: 11
    rng = np.random.default_rng(42)
    x = rng.standard_normal(15)
    m = normality_report(x, test="normaltest")
    assert m.test_name == "shapiro(fallback)"
    assert m.n == 15


def test_normaltest_uses_normaltest_when_n_ge_20():
    # Requirements: 11
    rng = np.random.default_rng(42)
    x = rng.standard_normal(25)
    m = normality_report(x, test="normaltest")
    assert m.test_name == "normaltest"
    assert m.n == 25


def test_normaltest_boundary_n_19_fallback():
    # Requirements: 11
    rng = np.random.default_rng(42)
    x = rng.standard_normal(19)
    m = normality_report(x, test="normaltest")
    assert m.test_name == "shapiro(fallback)"


def test_normaltest_boundary_n_20_uses_normaltest():
    # Requirements: 11
    rng = np.random.default_rng(42)
    x = rng.standard_normal(20)
    m = normality_report(x, test="normaltest")
    assert m.test_name == "normaltest"


def test_shapiro_explicit_uses_shapiro():
    # Requirements: 11
    rng = np.random.default_rng(42)
    x = rng.standard_normal(30)
    m = normality_report(x, test="shapiro")
    assert m.test_name == "shapiro"


def test_unknown_test_raises_value_error():
    # Requirements: 11 (diagnostics API)
    x = np.array([1.0, 2.0, 3.0])
    with pytest.raises(ValueError, match="Unknown test"):
        normality_report(x, test="unknown")
