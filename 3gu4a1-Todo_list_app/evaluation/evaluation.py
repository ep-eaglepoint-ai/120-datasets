#!/usr/bin/env python3
"""
Evaluation script for comparing repository_before and repository_after.
"""

import os
import sys
import json
import uuid
import re
import platform
import subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
REPORTS_BASE = ROOT / "evaluation" / "reports"


def environment_info():
    """Collect environment metadata."""
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
    }


def run_tests(repo_name: str):
    """Run pytest tests for a specific repository. Returns test results dictionary."""
    # Check for implementation - repository_after has app/main.py, repository_before may have main.py
    repo_path = ROOT / repo_name
    has_implementation = False
    
    if repo_name == "repository_after":
        # repository_after has app/main.py
        has_implementation = (repo_path / "app" / "main.py").exists()
    else:
        # repository_before may have main.py at root or app/main.py
        has_implementation = (repo_path / "main.py").exists() or (repo_path / "app" / "main.py").exists()
    
    if not has_implementation:
        return {
            "passed": False,
            "return_code": -1,
            "output": f"Repository {repo_name} has no implementation (main.py or app/main.py not found)",
        }

    try:
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{ROOT}:{env.get('PYTHONPATH', '')}".rstrip(":")
        # Set environment variable to filter which repository to test
        env["TEST_REPOSITORY"] = repo_name

        proc = subprocess.run(
            ["pytest", "tests", "-q", "--tb=short"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )

        output = (proc.stdout + proc.stderr)[:8000]
        # Check for passed tests - must have at least one passed test
        has_passed = "passed" in output.lower() and "0 passed" not in output.lower()
        # For repository_after, ensure no tests were skipped due to import errors
        # Check that we have actual test results, not just skips
        if repo_name == "repository_after":
            # Count passed tests - should have significant number of passed tests
            passed_match = re.search(r"(\d+)\s+passed", output)
            skipped_match = re.search(r"(\d+)\s+skipped", output)
            passed_count = int(passed_match.group(1)) if passed_match else 0
            skipped_count = int(skipped_match.group(1)) if skipped_match else 0
            # For repository_after, we expect many passed tests and minimal skips (only for repository_before)
            # If all tests are skipped, that's a failure
            if passed_count == 0 and skipped_count > 0:
                has_passed = False
            # Also check for import errors that would cause skips
            if "Skipping repository_after" in output or "module not found" in output.lower():
                has_passed = False

        return {
            "passed": proc.returncode == 0 and has_passed,
            "return_code": proc.returncode,
            "output": output,
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest timeout after 120 seconds",
        }
    except Exception as e:
        return {
            "passed": False,
            "return_code": -1,
            "output": f"Error running tests: {str(e)}",
        }


def run_metrics():
    """
    Optional metrics collection.
    Implement task-specific metrics here if needed.
    """
    # Placeholder for future metrics
    # Example metrics could include:
    # - Performance metrics (response times, throughput)
    # - Stability metrics (failure rates)
    # - Resource usage (memory, CPU)
    return {}


def evaluate(repo_name: str):
    """
    Evaluate a repository by running tests and collecting metrics.
    Returns evaluation results dictionary.
    """
    # Run tests
    tests = run_tests(repo_name)

    # Collect metrics (optional)
    metrics = run_metrics()

    return {"tests": tests, "metrics": metrics}


def run_evaluation():
    """
    Main evaluation function.
    Runs evaluation on both repositories and generates comparison report.
    Returns complete report dictionary.
    """
    run_id = str(uuid.uuid4())
    start = datetime.now(timezone.utc)

    try:
        # Evaluate repository_before
        before = evaluate("repository_before")

        # Evaluate repository_after
        after = evaluate("repository_after")

        # Compare results
        before_passed = before["tests"]["passed"]
        after_passed = after["tests"]["passed"]

        summaries = {
            (True, True): "Both implementations passed tests",
            (False, True): "After implementation fixed failing tests",
            (True, False): "After implementation introduced regressions",
            (False, False): "Both implementations failed tests",
        }

        comparison = {
            "passed_gate": after_passed,
            "improvement_summary": summaries[(before_passed, after_passed)],
        }

        end = datetime.now(timezone.utc)
        duration = (end - start).total_seconds()

        report = {
            "run_id": run_id,
            "started_at": start.isoformat().replace("+00:00", "Z"),
            "finished_at": end.isoformat().replace("+00:00", "Z"),
            "duration_seconds": duration,
            "environment": environment_info(),
            "before": before,
            "after": after,
            "comparison": comparison,
            "success": comparison["passed_gate"],
            "error": None,
        }

        return report

    except Exception as e:
        # Error handling: evaluation crashed
        end = datetime.now(timezone.utc)
        duration = (end - start).total_seconds()

        return {
            "run_id": run_id,
            "started_at": start.isoformat().replace("+00:00", "Z"),
            "finished_at": end.isoformat().replace("+00:00", "Z"),
            "duration_seconds": duration,
            "environment": environment_info(),
            "before": {
                "tests": {"passed": False, "return_code": -1, "output": ""},
                "metrics": {},
            },
            "after": {
                "tests": {"passed": False, "return_code": -1, "output": ""},
                "metrics": {},
            },
            "comparison": {
                "passed_gate": False,
                "improvement_summary": "Evaluation crashed",
            },
            "success": False,
            "error": str(e),
        }


def main():
    """
    Main entry point.
    Creates reports directory, runs evaluation, writes report, and returns exit code.
    """
    # Run evaluation
    report = run_evaluation()

    # Create nested directory structure: YYYY-MM-DD/HH-MM-SS/
    now = datetime.now(timezone.utc)
    date_dir = now.strftime("%Y-%m-%d")
    time_dir = now.strftime("%H-%M-%S")
    report_dir = REPORTS_BASE / date_dir / time_dir
    report_dir.mkdir(parents=True, exist_ok=True)

    # Write report to report.json
    report_path = report_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2))

    print(f"Evaluation report written to {report_path}")
    print(f"Success: {report['success']}")
    print(f"Before tests passed: {report['before']['tests']['passed']}")
    print(f"After tests passed: {report['after']['tests']['passed']}")

    # Return exit code: 0 for success, 1 for failure
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
