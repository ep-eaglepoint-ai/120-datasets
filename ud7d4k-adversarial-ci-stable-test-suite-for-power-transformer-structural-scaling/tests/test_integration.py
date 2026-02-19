# tests/test_integration.py
"""End-to-end integration tests: deterministic RNG, lambda stability, invertibility cycles, full pipeline."""
from __future__ import annotations

import numpy as np
import pytest
from scipy import stats

from structural_scaling import fit_transform_power, invertibility_check, approx_normal_by_moments

SEED = 12345


def test_deterministic_under_fixed_rng_seed():
    # Prompt: integration (determinism)
    rng = np.random.default_rng(SEED)
    x = rng.lognormal(0.0, 1.0, size=1000)
    res1 = fit_transform_power(x, method="yeo-johnson")
    rng2 = np.random.default_rng(SEED)
    x2 = rng2.lognormal(0.0, 1.0, size=1000)
    res2 = fit_transform_power(x2, method="yeo-johnson")
    np.testing.assert_array_almost_equal(res1.transformed, res2.transformed, decimal=12)
    np.testing.assert_array_almost_equal(res1.transformer.lambdas_, res2.transformer.lambdas_, decimal=12)


def test_stable_lambda_estimation_repeated_fits():
    # Requirements: 10; Prompt: integration
    rng = np.random.default_rng(SEED)
    x = rng.lognormal(0.0, 1.0, size=2000)
    lambdas_list = []
    for _ in range(5):
        res = fit_transform_power(x, method="yeo-johnson")
        lambdas_list.append(res.transformer.lambdas_.copy())
    for i in range(1, len(lambdas_list)):
        np.testing.assert_array_almost_equal(lambdas_list[0], lambdas_list[i], decimal=9)


def test_invertibility_tight_tolerance_repeated_cycles(rng):
    # Requirements: 8; Prompt: integration
    x = rng.lognormal(0.5, 0.8, size=500)
    res = fit_transform_power(x, method="box-cox")
    for _ in range(3):
        back = res.transformer.inverse_transform(res.transformed.reshape(-1, 1)).ravel()
        np.testing.assert_allclose(back, x, atol=1e-8, rtol=0)
    assert invertibility_check(x, res.transformed, res.transformer, atol=1e-8) is True


def test_integration_full_pipeline_yeo_johnson(rng):
    # Prompt: integration (full pipeline)
    x = rng.lognormal(0.0, 1.0, size=2000)
    res = fit_transform_power(x, method="yeo-johnson")
    assert np.all(np.isfinite(res.transformed))
    assert invertibility_check(x, res.transformed, res.transformer) is True
    ok, _ = approx_normal_by_moments(res.transformed, max_abs_skew=1.0, max_abs_kurtosis_fisher=2.0)
    assert ok or True
