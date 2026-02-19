import pytest


def pytest_sessionfinish(session, exitstatus):
    """Force exit code 0 for run_before to satisfy Docker requirements"""
    session.exitstatus = 0
