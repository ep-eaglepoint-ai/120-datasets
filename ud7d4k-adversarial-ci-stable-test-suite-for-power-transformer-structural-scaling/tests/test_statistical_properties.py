# tests/test_statistical_properties.py
"""Statistical property tests: skew/kurtosis reduction on skewed families.
Uses moment-based checks; avoids fragile normality p-value thresholds. Prompt: statistical sanity.
"""
from __future__ import annotations

import numpy as np
import pytest
from scipy import stats

from structural_scaling import (
    fit_transform_power,
    improved_normality,
    approx_normal_by_moments,
)


def _abs_skew(x):
    return float(np.abs(stats.skew(x, bias=False)))


def _abs_kurtosis_fisher(x):
    return float(np.abs(stats.kurtosis(x, fisher=True, bias=False)))


# --- Log-normal: both methods should reduce skew/kurtosis (moment-based) ---


def test_lognormal_skewness_reduced_yeo_johnson(rng):
    # Prompt: statistical sanity (log-normal)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Yeo-Johnson should reduce |skew| on log-normal"


def test_lognormal_skewness_reduced_box_cox(rng):
    # Prompt: statistical sanity (log-normal)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=2000)
    res = fit_transform_power(x, method="box-cox")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Box-Cox should reduce |skew| on log-normal"


def test_lognormal_kurtosis_reduced_yeo_johnson(rng):
    # Prompt: statistical sanity (log-normal)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    kurt_before = _abs_kurtosis_fisher(x)
    kurt_after = _abs_kurtosis_fisher(res.transformed)
    assert kurt_after < kurt_before, "Yeo-Johnson should reduce |kurtosis| on log-normal"


# --- Exponential: strongly skewed; moment improvement ---


def test_exponential_skewness_reduced_yeo_johnson(rng):
    # Prompt: statistical sanity (exponential)
    x = rng.exponential(scale=1.0, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Yeo-Johnson should reduce |skew| on exponential"


def test_exponential_skewness_reduced_box_cox(rng):
    # Prompt: statistical sanity (exponential)
    x = rng.exponential(scale=1.0, size=2000)
    res = fit_transform_power(x, method="box-cox")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Box-Cox should reduce |skew| on exponential"


# --- Chi-square: skewed; moment-based improvement ---


def test_chi2_skewness_reduced_yeo_johnson(rng):
    # Prompt: statistical sanity (chi-square)
    x = rng.chisquare(df=3, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Yeo-Johnson should reduce |skew| on chi-square"


def test_chi2_skewness_reduced_box_cox(rng):
    # Prompt: statistical sanity (chi-square)
    x = rng.chisquare(df=3, size=2000)
    res = fit_transform_power(x, method="box-cox")
    skew_before = _abs_skew(x)
    skew_after = _abs_skew(res.transformed)
    assert skew_after < skew_before, "Box-Cox should reduce |skew| on chi-square"


# --- improved_normality: moment-based criteria (skew/kurtosis better) ---


def test_improved_normality_moment_improvement_lognormal(rng):
    # Prompt: statistical sanity (improved_normality)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=1500)
    res = fit_transform_power(x, method="yeo-johnson")
    ok, _ = improved_normality(
        x, res.transformed,
        test="normaltest",
        require_skew_improvement=True,
        require_kurtosis_improvement=True,
    )
    assert ok, "improved_normality (moment-based) should pass for log-normal after YJ"


# --- approx_normal_by_moments: relaxed thresholds for large n ---


def test_approx_normal_by_moments_after_transform_lognormal(rng):
    # Prompt: statistical sanity (approx_normal_by_moments)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    ok, m = approx_normal_by_moments(
        res.transformed,
        max_abs_skew=0.5,
        max_abs_kurtosis_fisher=1.0,
    )
    assert abs(m.skewness) < abs(stats.skew(x, bias=False))
    assert abs(m.kurtosis_fisher) < abs(stats.kurtosis(x, fisher=True, bias=False))
