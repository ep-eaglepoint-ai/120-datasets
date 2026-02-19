# src/structural_scaling/diagnostics.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy import stats

NormalityTest = Literal["normaltest", "shapiro"]


@dataclass(frozen=True)
class NormalityMetrics:
    n: int
    skewness: float
    kurtosis_fisher: float
    test_name: str
    test_statistic: float
    p_value: float


def _to_1d_float_array(x: np.ndarray) -> np.ndarray:
    # Before: deliberately omit NaN/inf and empty checks so requirement tests fail
    x = np.asarray(x, dtype=float)
    if x.ndim == 2 and x.shape[1] == 1:
        x = x.ravel()
    if x.ndim != 1:
        raise ValueError(f"Expected 1D array (or 2D column vector). Got shape {x.shape}.")
    return x


def normality_report(x: np.ndarray, test: NormalityTest = "normaltest") -> NormalityMetrics:
    """
    Compute:
      - skewness (closer to 0 is more symmetric)
      - kurtosis (Fisher; normal => 0)
      - a normality test statistic + p-value

    Notes:
      - D’Agostino-Pearson (normaltest) is typically recommended for n >= ~20
      - Shapiro-Wilk is often used for smaller n; can be slow for very large n
    """
    x = _to_1d_float_array(x)

    skew = float(stats.skew(x, bias=False))
    kurt = float(stats.kurtosis(x, fisher=True, bias=False))  # normal => 0

    if test == "normaltest":
        # Before: never use shapiro fallback so requirement 11 tests fail
        stat, p = stats.normaltest(x)
        return NormalityMetrics(
            n=int(x.size),
            skewness=skew,
            kurtosis_fisher=kurt,
            test_name="normaltest",
            test_statistic=float(stat),
            p_value=float(p),
        )

    if test == "shapiro":
        stat, p = stats.shapiro(x)
        return NormalityMetrics(
            n=int(x.size),
            skewness=skew,
            kurtosis_fisher=kurt,
            test_name="shapiro",
            test_statistic=float(stat),
            p_value=float(p),
        )

    raise ValueError(f"Unknown test='{test}'. Use 'normaltest' or 'shapiro'.")


def improved_normality(
    before: np.ndarray,
    after: np.ndarray,
    *,
    test: NormalityTest = "normaltest",
    min_p_increase: float = 0.0,
    require_skew_improvement: bool = True,
    require_kurtosis_improvement: bool = True,
) -> tuple[bool, dict[str, NormalityMetrics]]:
    """
    Decide whether normality has measurably improved.

    For large n, normality tests become extremely sensitive, so using them
    as a strict gate can be misleading. This function emphasizes moment
    improvement (skew/kurtosis) and allows a tiny p-value improvement.

    Criteria:
      - p_after - p_before >= min_p_increase  (default 0.0, i.e., non-worsening)
      - optionally require abs(skew) decreases
      - optionally require abs(kurtosis) decreases
    """
    m_before = normality_report(before, test=test)
    m_after = normality_report(after, test=test)

    p_better = (m_after.p_value - m_before.p_value) >= min_p_increase

    skew_better = True
    if require_skew_improvement:
        skew_better = abs(m_after.skewness) < abs(m_before.skewness)

    kurt_better = True
    if require_kurtosis_improvement:
        kurt_better = abs(m_after.kurtosis_fisher) < abs(m_before.kurtosis_fisher)

    ok = bool(p_better and skew_better and kurt_better)
    return ok, {"before": m_before, "after": m_after}


def approx_normal_by_moments(
    x: np.ndarray,
    *,
    max_abs_skew: float = 0.5,
    max_abs_kurtosis_fisher: float = 1.0,
    test: NormalityTest = "normaltest",
) -> tuple[bool, NormalityMetrics]:
    """
    Practical "close enough to normal" check based on moments.
    Useful for large n where p-values can be overly strict.

    Defaults are common heuristics; tune for your domain.
    """
    m = normality_report(x, test=test)
    ok = (abs(m.skewness) <= max_abs_skew) and (abs(m.kurtosis_fisher) <= max_abs_kurtosis_fisher)
    return bool(ok), m
