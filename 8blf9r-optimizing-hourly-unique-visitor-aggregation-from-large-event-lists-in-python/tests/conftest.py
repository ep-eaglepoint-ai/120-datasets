"""
Pytest configuration: select implementation via REPO_PATH env.

- REPO_PATH=repository_before → tests run against baseline (repository_before.main).
- REPO_PATH=repository_after  → tests run against optimized (repository_after.main).

Default if unset: repository_after.
"""

import os
import importlib

import pytest


def _get_implementation_module():
    name = os.environ.get("REPO_PATH", "repository_after").strip()
    if name == "repository_before":
        return importlib.import_module("repository_before.main")
    if name == "repository_after":
        return importlib.import_module("repository_after.main")
    raise ValueError(f"REPO_PATH must be repository_before or repository_after, got: {name!r}")


@pytest.fixture(scope="session")
def implementation_name():
    """Current implementation name: 'repository_before' or 'repository_after'."""
    return os.environ.get("REPO_PATH", "repository_after").strip()


@pytest.fixture(scope="session")
def aggregate_hourly_unique_visitors(implementation_name):
    """The aggregate_hourly_unique_visitors function from the selected implementation."""
    mod = _get_implementation_module()
    return getattr(mod, "aggregate_hourly_unique_visitors")


@pytest.fixture(scope="session")
def implementation_module(implementation_name):
    """The module under test (repository_before.main or repository_after.main)."""
    return _get_implementation_module()


def pytest_configure(config):
    config.addinivalue_line("markers", "after_only: run for both repos; only repository_after satisfies optimization (bottleneck, no full-set-then-len).")
    config.addinivalue_line("markers", "after_only_skip_before: skip when REPO_PATH=repository_before (e.g. memory comparison only meaningful for optimized).")


def pytest_collection_modifyitems(config, items):
    impl = os.environ.get("REPO_PATH", "repository_after").strip()
    if impl != "repository_before":
        return
    # Only skip tests that don't apply to baseline (e.g. memory comparison: baseline vs baseline is meaningless).
    # Optimization checks (bottleneck explanation, no full-set-then-len) RUN against repository_before and FAIL.
    skip_for_before = pytest.mark.skip(reason="only meaningful when REPO_PATH=repository_after (e.g. memory comparison)")
    for item in items:
        if "after_only_skip_before" in item.keywords:
            item.add_marker(skip_for_before)


def pytest_sessionfinish(session, exitstatus):
    """When REPO_PATH=repository_before and tests failed, exit 0 (non-fatal) so CI/pipeline does not fail."""
    if exitstatus != 0 and os.environ.get("REPO_PATH", "").strip() == "repository_before":
        session.exitstatus = 0
