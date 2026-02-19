#!/usr/bin/env python3
"""
Hourly unique visitor aggregation – evaluation script.

Runs pytest against repository_before and repository_after, then writes
evaluation/<date>/<time>/report.json with results and comparison.

Usage:
  python evaluation/evaluation.py

Or from Docker:
  docker compose run app python evaluation/evaluation.py
"""

import json
import os
import platform
import random
import re
import socket
import string
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def generate_run_id():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def get_git_info():
    info = {"git_commit": "unknown", "git_branch": "unknown"}
    for cmd, key in [
        (["git", "rev-parse", "HEAD"], "git_commit"),
        (["git", "rev-parse", "--abbrev-ref", "HEAD"], "git_branch"),
    ]:
        try:
            out = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5,
                cwd=Path(__file__).resolve().parent.parent,
            )
            if out.returncode == 0 and out.stdout:
                val = out.stdout.strip()
                if key == "git_commit":
                    val = val[:8]
                info[key] = val
        except Exception:
            pass
    return info


def get_environment_info():
    git = get_git_info()
    return {
        "python_version": sys.version.split()[0],
        "platform": sys.platform,
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": socket.gethostname(),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }


def parse_pytest_summary(stdout: str):
    """Parse pytest output for 'X passed' and 'N failed'."""
    total = passed = failed = errors = skipped = 0
    # e.g. "10 passed in 1.23s" or "2 failed, 8 passed in 1.23s" or "1 failed, 9 passed, 1 skipped"
    m = re.search(r"(\d+)\s+passed", stdout)
    if m:
        passed = int(m.group(1))
    m = re.search(r"(\d+)\s+failed", stdout)
    if m:
        failed = int(m.group(1))
    m = re.search(r"(\d+)\s+skipped", stdout)
    if m:
        skipped = int(m.group(1))
    m = re.search(r"(\d+)\s+error", stdout)
    if m:
        errors = int(m.group(1))
    total = passed + failed + errors
    if total == 0 and (passed or failed):
        total = passed + failed
    return {
        "total": total or (passed + failed),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
    }


def run_tests(repository_name: str, env: dict):
    """Run pytest with given REPO_PATH env; return dict compatible with TypeScript report."""
    print("\n" + "=" * 60)
    print(f"RUNNING TESTS: {repository_name}")
    print("=" * 60)

    run_env = os.environ.copy()
    run_env["REPO_PATH"] = repository_name

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests", "-v", "--tb=short"],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=Path(__file__).resolve().parent.parent,
        env=run_env,
    )

    stdout = result.stdout or ""
    stderr = result.stderr or ""

    summary = parse_pytest_summary(stdout + "\n" + stderr)
    if summary["total"] == 0 and result.returncode != 0:
        summary["total"] = 1
        summary["errors"] = 1

    # Build minimal test results list (nodeid, name, outcome) from stdout lines
    tests = []
    for line in stdout.splitlines():
        if " PASSED" in line or " FAILED" in line:
            # e.g. "tests/test_aggregate_hourly_unique_visitors.py::test_foo PASSED"
            parts = line.strip().split()
            if len(parts) >= 2:
                nodeid = parts[0]
                outcome = "passed" if "PASSED" in line else "failed"
                name = nodeid.split("::")[-1] if "::" in nodeid else nodeid
                tests.append({
                    "nodeid": f"{repository_name}::{nodeid}",
                    "name": name,
                    "outcome": outcome,
                })

    # Report uses logical exit_code/success from parsed summary so report shows 1 when tests failed
    # even if process exited 0 (e.g. repository_before is non-fatal at runtime).
    logical_failed = summary.get("failed", 0) or summary.get("errors", 0)
    logical_exit_code = 0 if logical_failed == 0 else 1
    logical_success = logical_exit_code == 0

    return {
        "success": logical_success,
        "exit_code": logical_exit_code,
        "tests": tests,
        "summary": summary,
        "stdout": stdout,
        "stderr": stderr,
    }


def generate_output_path():
    now = datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    out_dir = Path(__file__).resolve().parent / "reports" /date_str / time_str
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / "report.json"


def main():
    run_id = generate_run_id()
    started_at = datetime.utcnow()

    print("\n" + "=" * 60)
    print("HOURLY UNIQUE VISITOR AGGREGATION – EVALUATION")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Started at: {started_at.isoformat()}Z")

    before_results = run_tests("repository_before", os.environ)
    after_results = run_tests("repository_after", os.environ)

    finished_at = datetime.utcnow()
    duration = (finished_at - started_at).total_seconds()

    comparison = {
        "before_tests_passed": before_results["success"],
        "after_tests_passed": after_results["success"],
        "before_total": before_results["summary"]["total"],
        "before_passed": before_results["summary"]["passed"],
        "before_failed": before_results["summary"]["failed"],
        "after_total": after_results["summary"]["total"],
        "after_passed": after_results["summary"]["passed"],
        "after_failed": after_results["summary"]["failed"],
    }

    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print("\nBefore Implementation (repository_before):")
    print(f"  Overall: {'PASSED' if before_results['success'] else 'FAILED/SKIPPED'}")
    print(f"  Tests: {comparison['before_passed']}/{comparison['before_total']} passed")
    print("\nAfter Implementation (repository_after):")
    print(f"  Overall: {'PASSED' if after_results['success'] else 'FAILED'}")
    print(f"  Tests: {comparison['after_passed']}/{comparison['after_total']} passed")

    success = after_results["success"]
    error_message = None if success else "After implementation tests failed"

    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat() + "Z",
        "finished_at": finished_at.isoformat() + "Z",
        "duration_seconds": round(duration, 6),
        "success": success,
        "error": error_message,
        "environment": get_environment_info(),
        "results": {
            "before": before_results,
            "after": after_results,
            "comparison": comparison,
        },
    }

    output_path = generate_output_path()
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: {output_path}")
    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if success else 'NO'}")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
