#!/usr/bin/env python3
"""
Run pytest with REPO_PATH set. When REPO_PATH=repository_before, exit 0 even if
tests fail (non-fatal), so Docker/CI does not fail. The evaluation report still
records the real pytest exit code for repository_before.
"""
import os
import sys
import subprocess


def main() -> int:
    repo_path = os.environ.get("REPO_PATH", "")
    # Project root is parent of tests/
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(tests_dir)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests", "-v"],
        cwd=project_root,
    )
    exit_code = result.returncode
    if repo_path == "repository_before":
        return 0
    return exit_code if exit_code is not None else 1


if __name__ == "__main__":
    sys.exit(main())
