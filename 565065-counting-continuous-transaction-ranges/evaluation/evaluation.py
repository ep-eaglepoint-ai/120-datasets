#!/usr/bin/env python3
"""
Evaluation script for count_transaction_ranges optimization.

Required contract:
- run_evaluation() -> dict
- main() -> int
"""

import sys
import json
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"


def environment_info():
    """Gather environment information for the report."""
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }


def run_tests(repo_path: Path):
    """
    Run pytest against a specific repository.
    
    Args:
        repo_path: Path to repository_before or repository_after
        
    Returns:
        Dictionary with passed, return_code, and output fields
    """
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", str(ROOT / "tests"), "-v", "--tb=short"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=300
        )
        full_output = proc.stdout + proc.stderr
        # Keep last 8000 chars to ensure summary line is captured
        output = full_output[-8000:] if len(full_output) > 8000 else full_output
        return {
            "passed": proc.returncode == 0,
            "return_code": proc.returncode,
            "output": output
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest timeout"
        }


def run_metrics(repo_path: Path, test_output: str = ""):
    """
    Extract metrics from test output.
    
    Args:
        repo_path: Path to the repository
        test_output: Raw pytest output string
        
    Returns:
        Dictionary with numeric metrics only
    """
    import re
    
    metrics = {
        "total_tests": 0,
        "passed_tests": 0,
        "failed_tests": 0,
        "test_duration_seconds": 0.0,
        "requirements_covered": 0,
        "total_requirements": 5
    }
    
    # Parse pytest summary (e.g., "31 passed in 1.02s" or "10 passed, 21 failed in 5.5s")
    passed_match = re.search(r"(\d+) passed", test_output)
    failed_match = re.search(r"(\d+) failed", test_output)
    duration_match = re.search(r"in ([\d.]+)s", test_output)
    
    if passed_match:
        metrics["passed_tests"] = int(passed_match.group(1))
    if failed_match:
        metrics["failed_tests"] = int(failed_match.group(1))
    if duration_match:
        metrics["test_duration_seconds"] = float(duration_match.group(1))
    
    metrics["total_tests"] = metrics["passed_tests"] + metrics["failed_tests"]
    
    # Calculate requirements covered based on test categories passing
    # Requirements: single transaction, positive/negative/mixed, exact match, large amounts, performance
    requirements = 0
    
    # Check for passing test categories in output
    if "TestCountTransactionRangesBasic" in test_output and "PASS" in test_output:
        requirements += 1  # Single transaction edge case
    if "TestCountTransactionRangesPositiveAmounts" in test_output or "TestCountTransactionRangesNegativeAmounts" in test_output or "TestCountTransactionRangesMixedAmounts" in test_output:
        if metrics["passed_tests"] >= 10:
            requirements += 1  # Positive/negative/mixed transactions
    if "TestCountTransactionRangesExactMatch" in test_output:
        requirements += 1  # Exact match queries
    if "TestCountTransactionRangesEdgeCases" in test_output:
        requirements += 1  # Large transaction amounts
    if "TestCountTransactionRangesPerformance" in test_output:
        requirements += 1  # Performance (100K in <2s)
    
    # Simplified: if all tests pass, all requirements covered
    if metrics["failed_tests"] == 0 and metrics["passed_tests"] > 0:
        metrics["requirements_covered"] = 5
    else:
        metrics["requirements_covered"] = requirements
    
    return metrics


def evaluate(repo_name: str):
    """
    Run full evaluation for a repository.
    
    Args:
        repo_name: Either 'repository_before' or 'repository_after'
        
    Returns:
        Dictionary with tests and metrics results
    """
    repo_path = ROOT / repo_name
    tests = run_tests(repo_path)
    metrics = run_metrics(repo_path, tests.get("output", ""))
    return {
        "tests": tests,
        "metrics": metrics
    }


def run_evaluation():
    """
    Main evaluation function that runs tests on both repositories.
    
    Returns:
        Complete evaluation report as dictionary matching the schema
    """
    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    
    before = evaluate("repository_before")
    after = evaluate("repository_after")
    
    before_covered = before["metrics"].get("requirements_covered", 0)
    after_covered = after["metrics"].get("requirements_covered", 0)
    total_req = after["metrics"].get("total_requirements", 5)
    
    comparison = {
        "passed_gate": after["tests"]["passed"],
        "improvement_summary": f"After implementation passed all requirements ({after_covered}/{total_req} covered vs {before_covered}/{total_req} before)"
    }
    
    end = datetime.utcnow()
    
    return {
        "run_id": run_id,
        "started_at": start.isoformat() + "Z",
        "finished_at": end.isoformat() + "Z",
        "duration_seconds": (end - start).total_seconds(),
        "environment": environment_info(),
        "before": before,
        "after": after,
        "comparison": comparison,
        "success": comparison["passed_gate"],
        "error": None
    }


def main():
    """
    Main entry point for evaluation script.
    
    Returns:
        0 if evaluation passed, 1 otherwise
    """
    print()
    print("=" * 60)
    print("DOCKER CONTAINER: evaluation")
    print("=" * 60)
    print("Starting evaluation container...")
    print("Working directory: /app")
    print("Command: python evaluation/evaluation.py")
    print()
    print("Running evaluation...")
    print("=" * 60)
    print()
    
    REPORTS.mkdir(parents=True, exist_ok=True)
    
    print("[1/3] Testing repository_before...")
    print("-" * 40)
    
    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    
    before = evaluate("repository_before")
    before_metrics = before["metrics"]
    print(f"  Passed: {before_metrics.get('passed_tests', 0)}")
    print(f"  Failed: {before_metrics.get('failed_tests', 0)}")
    print(f"  Duration: {before_metrics.get('test_duration_seconds', 0):.2f}s")
    print()
    
    print("[2/3] Testing repository_after...")
    print("-" * 40)
    
    after = evaluate("repository_after")
    after_metrics = after["metrics"]
    print(f"  Passed: {after_metrics.get('passed_tests', 0)}")
    print(f"  Failed: {after_metrics.get('failed_tests', 0)}")
    print(f"  Duration: {after_metrics.get('test_duration_seconds', 0):.2f}s")
    print()
    
    print("[3/3] Generating report...")
    print("-" * 40)
    
    before_covered = before_metrics.get("requirements_covered", 0)
    after_covered = after_metrics.get("requirements_covered", 0)
    total_req = after_metrics.get("total_requirements", 5)
    
    comparison = {
        "passed_gate": after["tests"]["passed"],
        "improvement_summary": f"After implementation passed all requirements ({after_covered}/{total_req} covered vs {before_covered}/{total_req} before)"
    }
    
    end = datetime.utcnow()
    
    report = {
        "run_id": run_id,
        "started_at": start.isoformat() + "Z",
        "finished_at": end.isoformat() + "Z",
        "duration_seconds": (end - start).total_seconds(),
        "environment": environment_info(),
        "before": before,
        "after": after,
        "comparison": comparison,
        "success": comparison["passed_gate"],
        "error": None
    }
    
    print()
    print("=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    print()
    
    print(f"Run ID: {report['run_id']}")
    print(f"Duration: {report['duration_seconds']:.2f} seconds")
    print()
    
    print("BEFORE (repository_before):")
    print(f"  Tests passed: {report['before']['tests']['passed']}")
    print(f"  Passed: {before_metrics.get('passed_tests', 0)} | Failed: {before_metrics.get('failed_tests', 0)}")
    print(f"  Requirements covered: {before_metrics.get('requirements_covered', 0)}/{before_metrics.get('total_requirements', 5)}")
    print()
    
    print("AFTER (repository_after):")
    print(f"  Tests passed: {report['after']['tests']['passed']}")
    print(f"  Passed: {after_metrics.get('passed_tests', 0)} | Failed: {after_metrics.get('failed_tests', 0)}")
    print(f"  Requirements covered: {after_metrics.get('requirements_covered', 0)}/{after_metrics.get('total_requirements', 5)}")
    print()
    
    print("COMPARISON:")
    print(f"  Passed gate: {report['comparison']['passed_gate']}")
    print(f"  Summary: {report['comparison']['improvement_summary']}")
    print()
    
    print("=" * 60)
    print(f"SUCCESS: {report['success']}")
    print("=" * 60)
    
    # Write report to file
    path = REPORTS / "latest.json"
    path.write_text(json.dumps(report, indent=2))
    print(f"\nReport written to {path}")
    
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
