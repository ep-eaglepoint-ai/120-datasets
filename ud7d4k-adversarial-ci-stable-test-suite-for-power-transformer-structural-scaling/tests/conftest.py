# tests/conftest.py
"""Shared fixtures: RNG seeding, deterministic data. CI-safe and cross-platform."""
from __future__ import annotations

import os
import sys

# When REPO_PATH is set (e.g. by Docker), prepend that repo's src so structural_scaling resolves
_repo = os.environ.get("REPO_PATH")
if _repo:
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    _src = os.path.join(_root, _repo, "power_transformer_project", "src")
    if os.path.isdir(_src) and _src not in sys.path:
        sys.path.insert(0, _src)

import numpy as np
import pytest


# Fixed seed for deterministic tests (CI-safe, cross-platform)
RNG_SEED = 42


@pytest.fixture
def rng():
    """Deterministic RNG for reproducible tests."""
    return np.random.default_rng(RNG_SEED)


@pytest.fixture
def positive_1d(rng):
    """Strictly positive 1D array (Box-Cox valid)."""
    return rng.uniform(0.1, 10.0, size=100)


@pytest.fixture
def mixed_sign_1d(rng):
    """Mixed-sign 1D array (Yeo-Johnson only)."""
    return rng.standard_normal(200) * 2 + 0.5
