from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Sequence

import numpy as np


@dataclass(frozen=True)
class DriftResult:
    metric: str
    value: float
    threshold: Optional[float]
    violated: bool


def population_stability_index(
    *,
    expected: Sequence[float],
    actual: Sequence[float],
    bins: int = 10,
    eps: float = 1e-6,
) -> float:
    """Compute PSI between expected (training) and actual (serving) distributions."""

    expected = np.asarray(list(expected), dtype=float)
    actual = np.asarray(list(actual), dtype=float)

    if expected.size == 0 or actual.size == 0:
        return float("nan")

    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges = np.unique(edges)
    if edges.size < 3:
        # Degenerate distribution
        return 0.0

    exp_counts, _ = np.histogram(expected, bins=edges)
    act_counts, _ = np.histogram(actual, bins=edges)

    exp_pct = exp_counts / max(exp_counts.sum(), 1)
    act_pct = act_counts / max(act_counts.sum(), 1)

    exp_pct = np.clip(exp_pct, eps, 1)
    act_pct = np.clip(act_pct, eps, 1)

    psi = np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct))
    return float(psi)
