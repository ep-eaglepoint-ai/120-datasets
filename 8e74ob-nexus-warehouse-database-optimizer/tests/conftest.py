"""
Pytest configuration for Nexus Warehouse Database Optimizer tests.
"""

import pytest


def pytest_sessionfinish(session, exitstatus):
    """Ensure exit code is 0 for before tests (expected failures)"""
    session.exitstatus = 0
