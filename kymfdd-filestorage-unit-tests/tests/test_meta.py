#!/usr/bin/python3

import pytest
import os
import re
import glob
import subprocess
import sys


REPO_BASE = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


def get_target_repo():
    repo_path = os.environ.get("REPO_PATH", "repository_after")
    if os.path.isabs(repo_path):
        return repo_path
    return os.path.join(REPO_BASE, repo_path)


def get_tests_dir():
    return os.path.join(get_target_repo(), "tests")


def get_test_files():
    tests_dir = get_tests_dir()
    if not os.path.isdir(tests_dir):
        return []
    return glob.glob(os.path.join(tests_dir, "test_*.py"))


class TestUnittestFilesExist:
    

    def test_tests_directory_exists(self):
        """META-01: Target repository must have a 'tests' directory."""
        tests_dir = get_tests_dir()
        target_repo = get_target_repo()
        assert os.path.isdir(tests_dir), (
            f"Target repository '{os.path.basename(target_repo)}' must have a 'tests' directory. "
            f"Not found at: {tests_dir}"
        )

    def test_unittest_files_exist(self):
        
        tests_dir = get_tests_dir()
        target_repo = get_target_repo()
        
        if not os.path.isdir(tests_dir):
            pytest.fail(f"No 'tests' directory in '{os.path.basename(target_repo)}'")
        
        test_files = get_test_files()
        assert len(test_files) > 0, (
            f"Target repository must have at least one test file (test_*.py) in: {tests_dir}"
        )

    def test_unittest_files_use_unittest_module(self):
        test_files = get_test_files()
        
        if not test_files:
            pytest.fail("No test files found")
        
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            assert "import unittest" in content, (
                f"Test file {os.path.basename(test_file)} must use unittest module"
            )

    def test_unittest_files_have_test_classes(self):
        test_files = get_test_files()
        
        if not test_files:
            pytest.fail("No test files found")
        
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            has_test_class = "unittest.TestCase" in content or re.search(r"class\s+Test\w+", content)
            assert has_test_class, (
                f"Test file {os.path.basename(test_file)} must have TestCase classes"
            )

    def test_unittest_files_have_test_methods(self):
        test_files = get_test_files()
        
        if not test_files:
            pytest.fail("No test files found")
        
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            test_methods = re.findall(r"def\s+test_\w+", content)
            assert len(test_methods) > 0, (
                f"Test file {os.path.basename(test_file)} must have test methods"
            )

    def test_unittest_files_have_requirement_markers(self):
        
        test_files = get_test_files()
        
        if not test_files:
            pytest.fail("No test files found")
        
        all_markers = []
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            markers = re.findall(r"TC-\d{2}", content)
            all_markers.extend(markers)
        
        unique_markers = set(all_markers)
        assert len(unique_markers) >= 7, (
            f"Test files must have at least 7 requirement markers (TC-XX). "
            f"Found {len(unique_markers)}: {sorted(unique_markers)}"
        )

    def test_unittest_files_no_pytest(self):
        test_files = get_test_files()
        
        if not test_files:
            pytest.fail("No test files found")
        
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            assert "import pytest" not in content, (
                f"Test file {os.path.basename(test_file)} must not use pytest"
            )


class TestRequirementsMapping:
    """Meta tests mapping to requirements 1, 3, 4, 5, 6, 7."""

    def test_req1_targets_file_storage_only(self):
        """Req 1: Unit tests must target only FileStorage; no TestBaseModel, TestUser, etc."""
        test_files = get_test_files()
        if not test_files:
            pytest.fail("No test files found")
        forbidden_classes = ["TestBaseModel", "TestUser", "TestState", "TestCity",
                             "TestAmenity", "TestPlace", "TestReview"]
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            for forbidden in forbidden_classes:
                assert forbidden not in content, (
                    f"Req 1: Test file {os.path.basename(test_file)} must not test model "
                    f"classes; found '{forbidden}'"
                )
            assert "FileStorage" in content, (
                f"Req 1: Test file {os.path.basename(test_file)} must target FileStorage"
            )

    def test_req3_req4_use_temporary_file_not_file_json(self):
        """Req 3 & 4: Unit tests must use a temporary/test file; must not set path to file.json."""
        test_files = get_test_files()
        if not test_files:
            pytest.fail("No test files found")
        temp_patterns = ["test_file", "temp_file", "tempfile", "NamedTemporaryFile",
                         "TemporaryFile", "mkstemp"]
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            has_temp = any(p in content for p in temp_patterns)
            assert has_temp, (
                f"Req 3/4: Test file {os.path.basename(test_file)} must use a temporary "
                f"or test file for persistence (e.g. test_file, tempfile)"
            )
            bad_assign = re.search(
                r'(?:__file_path|_FileStorage__file_path|file_path)\s*=\s*["\']file\.json["\']',
                content
            )
            assert not bad_assign, (
                f"Req 3/4: Test file {os.path.basename(test_file)} must not set "
                f"storage path to real 'file.json'"
            )

    def test_req5_reset_internal_storage_between_tests(self):
        """Req 5: Unit tests must reset __objects between tests (setUp/tearDown)."""
        test_files = get_test_files()
        if not test_files:
            pytest.fail("No test files found")
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            has_objects_reset = "__objects" in content and (
                "setUp" in content or "tearDown" in content
            )
            assert has_objects_reset, (
                f"Req 5: Test file {os.path.basename(test_file)} must reset internal "
                f"storage (__objects) between tests in setUp/tearDown"
            )

    def test_req6_no_print_for_validation(self):
        """Req 6 (assertions): Unit tests must not use print() for validation."""
        test_files = get_test_files()
        if not test_files:
            pytest.fail("No test files found")
        for test_file in test_files:
            with open(test_file, "r") as f:
                content = f.read()
            assert "print(" not in content, (
                f"Test file {os.path.basename(test_file)} must not use print() for "
                f"validation; use unittest assertions"
            )


class TestUnittestsPass:

    def test_run_unittests(self):
        test_files = get_test_files()
        target_repo = get_target_repo()
        
        if not test_files:
            pytest.fail(f"No test files found in '{os.path.basename(target_repo)}'")
        
        env = os.environ.copy()
        repo_before = os.path.join(REPO_BASE, "repository_before")
        env["PYTHONPATH"] = f"{REPO_BASE}{os.pathsep}{repo_before}{os.pathsep}{target_repo}{os.pathsep}{env.get('PYTHONPATH', '')}"
        
        tests_dir = get_tests_dir()
        
        cmd = [sys.executable, "-m", "unittest", "discover", "-s", tests_dir, "-v"]
        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        
        assert result.returncode == 0, (
            f"Unit tests in '{os.path.basename(target_repo)}' failed!\n"
            f"STDOUT:\n{result.stdout}\n"
            f"STDERR:\n{result.stderr}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
