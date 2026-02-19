#!/usr/bin/python3
"""
Pytest configuration for meta-tests.
"""

import pytest
import os


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "meta: mark test as a meta-test"
    )
