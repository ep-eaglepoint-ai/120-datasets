#!/usr/bin/env python3
"""
Evaluation script for Minimal Coffee Shop Service Stack.
Compares repository_before/ vs repository_after/ implementations.

This script evaluates a Go-based service stack with PostgreSQL and Redis.
"""
import sys
import json
import re
import uuid
import platform
import subprocess
import shutil
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"


def environment_info():
    """Collect environment metadata."""
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }


def check_go_installed():
    """Check if Go is installed."""
    return shutil.which("go") is not None


def parse_test_output(output: str):
    """
    Parse Go test output to extract test counts.
    
    Returns:
        dict with total, passed, failed counts
    """
    total = 0
    passed = 0
    failed = 0
    
    # Count RUN lines for total tests
    run_matches = re.findall(r'=== RUN\s+\S+', output)
    total = len(run_matches)
    
    # Count PASS lines
    pass_matches = re.findall(r'--- PASS:', output)
    passed = len(pass_matches)
    
    # Count FAIL lines
    fail_matches = re.findall(r'--- FAIL:', output)
    failed = len(fail_matches)
    
    # Also check for summary line like "1 passed" or "ok" with count
    summary_match = re.search(r'(\d+)\s+passed', output)
    if summary_match and total == 0:
        passed = int(summary_match.group(1))
        total = passed
    
    # Check for "X tests" pattern
    tests_match = re.search(r'(\d+)\s+tests?', output, re.IGNORECASE)
    if tests_match and total == 0:
        total = int(tests_match.group(1))
    
    return {
        "total": total,
        "passed": passed,
        "failed": failed
    }


def run_go_tests(repo_name: str):
    """
    Run Go tests on the specified repository's tests.
    
    Args:
        repo_name: Either 'repository_before' or 'repository_after'
    
    Returns:
        dict with passed, return_code, output, and test_counts
    """
    repo_path = ROOT / repo_name
    test_path = ROOT / "tests"
    
    # Check if repository directory exists
    if not repo_path.exists():
        return {
            "passed": False,
            "return_code": 1,
            "output": f"Repository directory not found: {repo_path}",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
    
    # Check if repository has any Go files
    go_files = list(repo_path.glob("**/*.go"))
    if not go_files:
        return {
            "passed": False,
            "return_code": 1,
            "output": f"No Go files found in {repo_path}",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
    
    # Check if tests directory exists
    if not test_path.exists():
        return {
            "passed": False,
            "return_code": 1,
            "output": f"Tests directory not found: {test_path}",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
    
    if not check_go_installed():
        return {
            "passed": False,
            "return_code": 1,
            "output": "Go is not installed",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
    
    try:
        # Run go test on the tests directory
        proc = subprocess.run(
            ["go", "test", "-v", "./tests/..."],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120
        )
        output = (proc.stdout + proc.stderr)[:8000]
        test_counts = parse_test_output(output)
        
        return {
            "passed": proc.returncode == 0,
            "return_code": proc.returncode,
            "output": output,
            "test_counts": test_counts
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": 1,
            "output": "Go test timeout (>120s)",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
    except Exception as e:
        return {
            "passed": False,
            "return_code": 1,
            "output": f"Error running tests: {str(e)}",
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }


def evaluate(repo_name: str):
    """
    Evaluate a single repository (before or after).
    
    Args:
        repo_name: Either 'repository_before' or 'repository_after'
    
    Returns:
        dict with tests and metrics results (matching template format)
    """
    tests_result = run_go_tests(repo_name)
    
    return {
        "tests": {
            "passed": tests_result["passed"],
            "return_code": tests_result["return_code"],
            "output": tests_result["output"]
        },
        "metrics": {},
        "test_counts": tests_result["test_counts"]
    }


def run_evaluation():
    """
    Main evaluation logic.
    
    Returns:
        dict: Complete evaluation report matching the standard schema
    """
    run_id = str(uuid.uuid4())
    start = datetime.now(timezone.utc)
    error = None
    
    try:
        before = evaluate("repository_before")
        after = evaluate("repository_after")
        
        # Success rule: after tests must pass
        passed_gate = after["tests"]["passed"]
        
        # Generate improvement summary
        if passed_gate and not before["tests"]["passed"]:
            improvement_summary = "Implementation completed: tests now pass"
        elif passed_gate and before["tests"]["passed"]:
            improvement_summary = "Both before and after pass tests"
        elif not passed_gate and not before["tests"]["passed"]:
            improvement_summary = "Neither before nor after pass tests"
        else:
            improvement_summary = "Regression: before passed but after fails"
        
        comparison = {
            "passed_gate": passed_gate,
            "improvement_summary": improvement_summary
        }
        
        # Store test counts for terminal output
        test_counts = {
            "before": before["test_counts"],
            "after": after["test_counts"]
        }
        
    except Exception as e:
        before = {
            "tests": {"passed": False, "return_code": 1, "output": ""},
            "metrics": {},
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
        after = {
            "tests": {"passed": False, "return_code": 1, "output": ""},
            "metrics": {},
            "test_counts": {"total": 0, "passed": 0, "failed": 0}
        }
        comparison = {
            "passed_gate": False,
            "improvement_summary": "Evaluation error"
        }
        test_counts = {
            "before": {"total": 0, "passed": 0, "failed": 0},
            "after": {"total": 0, "passed": 0, "failed": 0}
        }
        error = str(e)
    
    end = datetime.now(timezone.utc)
    
    # Build report matching exact template format
    report = {
        "run_id": run_id,
        "started_at": start.isoformat().replace("+00:00", "Z"),
        "finished_at": end.isoformat().replace("+00:00", "Z"),
        "duration_seconds": round((end - start).total_seconds(), 2),
        "environment": environment_info(),
        "before": {
            "tests": before["tests"],
            "metrics": before["metrics"]
        },
        "after": {
            "tests": after["tests"],
            "metrics": after["metrics"]
        },
        "comparison": comparison,
        "success": comparison["passed_gate"],
        "error": error
    }

    # Return report and test_counts separately for terminal output
    return report, test_counts


def main():
    """
    Entry point for evaluation.

    Returns:
        int: 0 if success, 1 if failure
    """
    REPORTS.mkdir(parents=True, exist_ok=True)

    report, test_counts = run_evaluation()

    # Write report to latest.json only
    latest_path = REPORTS / "latest.json"
    latest_path.write_text(json.dumps(report, indent=2))
    print(f"Report written to {latest_path}")

    # Print summary with test counts
    print(f"\n{'='*60}")
    print("Evaluation Summary")
    print('='*60)

    # Before tests
    before_total = test_counts["before"]["total"]
    before_passed = test_counts["before"]["passed"]
    before_failed = test_counts["before"]["failed"]
    print(f"Before tests: {before_total} total, {before_passed} passed, {before_failed} failed")
    print(f"Before tests passed: {report['before']['tests']['passed']}")

    print('-'*60)

    # After tests
    after_total = test_counts["after"]["total"]
    after_passed = test_counts["after"]["passed"]
    after_failed = test_counts["after"]["failed"]
    print(f"After tests:  {after_total} total, {after_passed} passed, {after_failed} failed")
    print(f"After tests passed:  {report['after']['tests']['passed']}")

    print('='*60)
    print(f"Success: {report['success']}")
    print(f"Summary: {report['comparison']['improvement_summary']}")
    print('='*60 + '\n')

    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
