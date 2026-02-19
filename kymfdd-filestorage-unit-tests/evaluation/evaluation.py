#!/usr/bin/python3
"""
Evaluation script - runs meta-tests against both repositories and generates report.

Usage:
    docker compose run --rm app python evaluation/evaluation.py

Generates:
    - evaluation/YYYY-MM-DD/HH-MM-SS/report.json
"""

import os
import sys
import json
import platform
import socket
import subprocess
import uuid
import re
from datetime import datetime

REPO_BASE = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
META_TESTS_FILE = os.path.join(REPO_BASE, "tests", "test_meta.py")


def run_meta_tests(repo_path: str) -> dict:
    """Run meta-tests against the specified repository."""
    env = os.environ.copy()
    env["REPO_PATH"] = repo_path
    env["PYTHONPATH"] = f"{REPO_BASE}{os.pathsep}{env.get('PYTHONPATH', '')}"
    
    cmd = [sys.executable, "-m", "pytest", META_TESTS_FILE, "-v", "--tb=short"]
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    tests_data = parse_pytest_output(result.stdout + result.stderr)
    
    summary = {
        "total": len(tests_data),
        "passed": len([t for t in tests_data if t["outcome"] == "passed"]),
        "failed": len([t for t in tests_data if t["outcome"] == "failed"]),
        "errors": len([t for t in tests_data if t["outcome"] == "error"]),
        "skipped": len([t for t in tests_data if t["outcome"] == "skipped"]),
    }
    
    return {
        "success": result.returncode == 0,
        "exit_code": result.returncode,
        "tests": tests_data,
        "summary": summary,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def parse_pytest_output(output: str) -> list:
    """Parse pytest output to extract test results."""
    tests = []
    pattern = r"(tests/test_meta\.py::\S+)\s+(PASSED|FAILED|ERROR|SKIPPED)"
    for nodeid, outcome in re.findall(pattern, output):
        tests.append({
            "nodeid": nodeid,
            "name": nodeid.split("::")[-1],
            "outcome": outcome.lower(),
        })
    return tests


def get_git_info() -> tuple:
    """Get git commit and branch."""
    try:
        commit = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=REPO_BASE)
        commit_hash = commit.stdout.strip()[:8] if commit.returncode == 0 else "unknown"
    except:
        commit_hash = "unknown"
    try:
        branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, cwd=REPO_BASE)
        branch_name = branch.stdout.strip() if branch.returncode == 0 else "unknown"
    except:
        branch_name = "unknown"
    return commit_hash, branch_name


def main():
    run_id = str(uuid.uuid4())[:8]
    started_at = datetime.now()
    
    print("=" * 60)
    print("EVALUATION: FileStorage Meta-Testing")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Started: {started_at.isoformat()}")
    print()
    
    # Run meta-tests against repository_before (expected: FAIL)
    print("-" * 60)
    print("[1/2] Testing repository_before")
    print("      Expected: FAIL (no tests/ directory)")
    print("-" * 60)
    before = run_meta_tests("repository_before")
    print(f"Result: {'FAIL ❌' if not before['success'] else 'PASS ✅ (unexpected!)'}")
    print(f"Summary: {before['summary']['passed']}/{before['summary']['total']} passed")
    print()
    
    # Run meta-tests against repository_after (expected: PASS)
    print("-" * 60)
    print("[2/2] Testing repository_after")
    print("      Expected: PASS (has tests/ with valid unittests)")
    print("-" * 60)
    after = run_meta_tests("repository_after")
    print(f"Result: {'PASS ✅' if after['success'] else 'FAIL ❌ (unexpected!)'}")
    print(f"Summary: {after['summary']['passed']}/{after['summary']['total']} passed")
    print()
    
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()
    
    # Success = before fails AND after passes
    overall_success = (not before["success"]) and after["success"]
    git_commit, git_branch = get_git_info()
    
    error = None
    if before["success"]:
        error = "repository_before passed but should have failed (no tests folder)"
    elif not after["success"]:
        failed = [t["name"] for t in after["tests"] if t["outcome"] == "failed"]
        error = f"repository_after failed: {', '.join(failed)}"
    
    # Build report following EVALUATION_PROMPT_FRAMEWORK schema
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 6),
        "success": overall_success,
        "error": error,
        "environment": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "os": platform.system(),
            "os_release": platform.release(),
            "architecture": platform.machine(),
            "hostname": socket.gethostname(),
            "git_commit": git_commit,
            "git_branch": git_branch,
        },
        "results": {
            "before": before,
            "after": after,
            "comparison": {
                "before_tests_passed": before["success"],
                "after_tests_passed": after["success"],
                "before_total": before["summary"]["total"],
                "before_passed": before["summary"]["passed"],
                "before_failed": before["summary"]["failed"],
                "after_total": after["summary"]["total"],
                "after_passed": after["summary"]["passed"],
                "after_failed": after["summary"]["failed"],
            },
        },
    }
    
    # Save report with timestamped folder structure: evaluation/YYYY-MM-DD/HH-MM-SS/report.json
    date_folder = started_at.strftime("%Y-%m-%d")
    time_folder = started_at.strftime("%H-%M-%S")
    output_dir = os.path.join(REPO_BASE, "evaluation", date_folder, time_folder)
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "report.json")
    with open(output_file, "w") as f:
        json.dump(report, f, indent=2)
    
    # Print final summary
    print("=" * 60)
    print(f"VERDICT: {'SUCCESS ✅' if overall_success else 'FAILURE ❌'}")
    print("=" * 60)
    print()
    print("REQUIREMENTS SUMMARY:")
    print(f"  Before repo should FAIL: {'✅ Yes' if not before['success'] else '❌ No'}")
    print(f"  After repo should PASS:  {'✅ Yes' if after['success'] else '❌ No'}")
    print()
    print("REPOSITORY RESULTS:")
    print(f"  Before: {before['summary']['passed']}/{before['summary']['total']} checks passed")
    print(f"  After:  {after['summary']['passed']}/{after['summary']['total']} checks passed")
    print()
    print(f"Report saved to: {output_file}")
    print("=" * 60)
    
    return 0 if overall_success else 1


if __name__ == "__main__":
    sys.exit(main())
