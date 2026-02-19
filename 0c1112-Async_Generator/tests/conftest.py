#!/usr/bin/env python3

"""
Pytest configuration for async_generator tests.
"""

import pytest
import sys
import os

# Configure pytest-asyncio
pytest_plugins = ('pytest_asyncio',)

def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "asyncio: mark test as an asyncio coroutine"
    )
