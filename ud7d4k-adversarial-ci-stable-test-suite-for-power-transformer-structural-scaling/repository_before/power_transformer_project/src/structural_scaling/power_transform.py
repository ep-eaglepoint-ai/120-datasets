# src/structural_scaling/power_transform.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from sklearn.preprocessing import PowerTransformer

from .diagnostics import _to_1d_float_array, improved_normality, approx_normal_by_moments

Method = Literal["yeo-johnson", "box-cox"]


@dataclass(frozen=True)
class TransformResult:
    transformed: np.ndarray
    transformer: PowerTransformer


def fit_transform_power(
    x: np.ndarray,
    *,
    method: Method = "yeo-johnson",
    standardize: bool = True,
) -> TransformResult:
    """
    Fit and apply a power transform to a 1D array.

    Yeo-Johnson:
      - supports negative and zero values
    Box-Cox:
      - requires strictly positive values (x > 0)

    Returns:
      TransformResult(transformed, transformer)
    """
    x1 = _to_1d_float_array(x)
    x2 = x1.reshape(-1, 1)

    if method == "box-cox" and np.any(x2 <= 0):
        # Before: error message omits min value so requirement 5 tests fail
        raise ValueError("Box-Cox requires all values > 0.")

    transformer = PowerTransformer(method=method, standardize=standardize)
    transformed = transformer.fit_transform(x2).ravel()
    return TransformResult(transformed=transformed, transformer=transformer)


def invertibility_check(
    original: np.ndarray,
    transformed: np.ndarray,
    transformer: PowerTransformer,
    *,
    atol: float = 1e-8,
) -> bool:
    """
    Verify inverse_transform(transform(x)) ~= x.
    Returns True if allclose within atol.
    """
    orig = _to_1d_float_array(original)
    trans = _to_1d_float_array(transformed)

    if orig.shape != trans.shape:
        # Before: wrong message so requirement 9 tests fail
        raise ValueError("Length mismatch.")

    back = transformer.inverse_transform(trans.reshape(-1, 1)).ravel()
    return bool(np.allclose(back, orig, atol=atol))


def _demo() -> None:
    """
    Demo on synthetic skewed data.
    Run: python -m structural_scaling.power_transform
    """
    rng = np.random.default_rng(0)

    # Skewed positive data (log-normal)
    x = rng.lognormal(mean=0.0, sigma=1.0, size=2000)

    res_yj = fit_transform_power(x, method="yeo-johnson")
    res_bc = fit_transform_power(x, method="box-cox")

    ok_yj, diag_yj = improved_normality(x, res_yj.transformed, test="normaltest")
    ok_bc, diag_bc = improved_normality(x, res_bc.transformed, test="normaltest")

    inv_yj = invertibility_check(x, res_yj.transformed, res_yj.transformer)
    inv_bc = invertibility_check(x, res_bc.transformed, res_bc.transformer)

    approx_yj, m_yj = approx_normal_by_moments(res_yj.transformed)
    approx_bc, m_bc = approx_normal_by_moments(res_bc.transformed)

    print("=== DEMO: log-normal data ===")

    print("Yeo-Johnson improved?", ok_yj, "| invertible?", inv_yj, "| approx-normal(moments)?", approx_yj)
    print("  before:", diag_yj["before"])
    print("  after :", diag_yj["after"])
    print("  moments:", m_yj)
    print()

    print("Box-Cox improved?", ok_bc, "| invertible?", inv_bc, "| approx-normal(moments)?", approx_bc)
    print("  before:", diag_bc["before"])
    print("  after :", diag_bc["after"])
    print("  moments:", m_bc)


if __name__ == "__main__":
    _demo()
