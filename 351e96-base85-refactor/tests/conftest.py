"""
Test configuration for ASCII85 refactor tests.
"""

import sys
import os

# Add repository paths to Python path for imports
repo_before = os.path.join(os.path.dirname(__file__), '..', 'repository_before')
repo_after = os.path.join(os.path.dirname(__file__), '..', 'repository_after')

sys.path.insert(0, repo_before)
sys.path.insert(0, repo_after)

def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests (may be slow)"
    )