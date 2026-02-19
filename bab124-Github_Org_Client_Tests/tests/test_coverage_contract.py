#!/usr/bin/env python3
"""
Meta-tests that enforce coverage requirements for GithubOrgClient tests.

These tests ensure that critical behaviors are explicitly tested.
"""

import inspect
import test_client


def get_test_methods():
    """Return all test method names in TestGithubOrgClient."""
    cls = test_client.TestGithubOrgClient
    return {
        name
        for name, member in inspect.getmembers(cls, inspect.isfunction)
        if name.startswith("test_")
    }


def test_public_repos_is_tested():
    tests = get_test_methods()
    assert any("public_repos" in t for t in tests), (
        "public_repos behavior is not tested"
    )


def test_license_filtering_is_tested():
    tests = get_test_methods()
    assert any("license" in t for t in tests), (
        "Repository license filtering is not tested"
    )


def test_has_license_true_cases_are_tested():
    tests = get_test_methods()
    assert any("has_license_true" in t for t in tests), (
        "has_license true cases are not tested"
    )


def test_has_license_false_cases_are_tested():
    tests = get_test_methods()
    assert any("has_license_false" in t for t in tests), (
        "has_license false cases are not tested"
    )


def test_edge_cases_are_tested():
    tests = get_test_methods()
    keywords = ("empty", "missing", "none")
    assert any(any(k in t for k in keywords) for t in tests), (
        "Edge cases (empty / missing / None) are not tested"
    )
