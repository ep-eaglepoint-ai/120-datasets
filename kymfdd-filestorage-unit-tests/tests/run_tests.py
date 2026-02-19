#!/usr/bin/env python3
"""
Run meta-tests only (target repo via REPO_PATH).
For repository_before, meta tests are expected to fail; exit 0 anyway.
For repository_after, exit with pytest's code (0 = pass, non-zero = fail).
"""
import os
import sys
import subprocess

REPO_BASE = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
META_TESTS_FILE = os.path.join(REPO_BASE, "tests", "test_meta.py")
repo_path = os.environ.get("REPO_PATH", "repository_after")

env = os.environ.copy()
env["REPO_PATH"] = repo_path
env["PYTHONPATH"] = f"{REPO_BASE}{os.pathsep}{env.get('PYTHONPATH', '')}"

result = subprocess.run(
    [sys.executable, "-m", "pytest", META_TESTS_FILE, "-v", "--tb=short"],
    env=env,
)


if repo_path == "repository_before":
    print(f"\nNote: repository_before exited with code {result.returncode} (expected to fail)")
    sys.exit(0)
sys.exit(result.returncode)
