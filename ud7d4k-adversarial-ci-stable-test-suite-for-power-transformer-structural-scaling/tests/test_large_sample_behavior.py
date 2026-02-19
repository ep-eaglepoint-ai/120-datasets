# tests/test_large_sample_behavior.py
"""Large-sample behavior (n >= 10,000): moment convergence; avoid fragile normality p-value. Prompt: large-sample."""
from __future__ import annotations

import numpy as np
import pytest
from scipy import stats

from structural_scaling import fit_transform_power, invertibility_check, approx_normal_by_moments

SEED = 12345


def test_large_sample_moment_convergence_yeo_johnson():
    # Prompt: large-sample (n >= 10,000)
    """n >= 10,000: validate moment-based convergence; avoid fragile normality p-value."""
    rng = np.random.default_rng(SEED)
    n = 10_000
    x = rng.lognormal(mean=0.0, sigma=1.0, size=n)
    res = fit_transform_power(x, method="yeo-johnson")
    skew_after = float(stats.skew(res.transformed, bias=False))
    kurt_after = float(stats.kurtosis(res.transformed, fisher=True, bias=False))
    assert abs(skew_after) < 1.0, "Large sample: |skew| should be reduced"
    assert abs(kurt_after) < 2.0, "Large sample: |kurtosis| should be reduced"
    ok, m = approx_normal_by_moments(res.transformed, max_abs_skew=1.0, max_abs_kurtosis_fisher=2.0)
    assert ok or (abs(m.skewness) < 2.0 and abs(m.kurtosis_fisher) < 3.0)


def test_large_sample_moment_convergence_box_cox():
    # Prompt: large-sample (n >= 10,000)
    rng = np.random.default_rng(SEED)
    n = 10_000
    x = rng.exponential(scale=1.0, size=n)
    res = fit_transform_power(x, method="box-cox")
    skew_after = float(stats.skew(res.transformed, bias=False))
    assert abs(skew_after) < 1.5
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-7) is True


def test_large_sample_deterministic_yeo_johnson():
    # Prompt: large-sample, numerical stability
    rng = np.random.default_rng(SEED)
    n = 10_000
    x = rng.lognormal(mean=0.0, sigma=1.0, size=n)
    res1 = fit_transform_power(x, method="yeo-johnson")
    rng2 = np.random.default_rng(SEED)
    x2 = rng2.lognormal(mean=0.0, sigma=1.0, size=n)
    res2 = fit_transform_power(x2, method="yeo-johnson")
    np.testing.assert_array_almost_equal(res1.transformed, res2.transformed, decimal=10)
    np.testing.assert_array_almost_equal(res1.transformer.lambdas_, res2.transformer.lambdas_, decimal=10)
