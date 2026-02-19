#!/usr/bin/env python3
"""
Evaluation script for comparing repository_before and repository_after.

This script runs tests on both repositories and generates a comprehensive
JSON report with detailed test results, metrics, and comparison analysis.
"""

import json
import os
import platform
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Tuple


def run_pytest_with_json(
    test_path: str,
    pythonpath: str, 
    verbose: bool = False
) -> Tuple[int, str, Dict[str, Any]]:
    """
    Run pytest with JSON reporting enabled.
    
    Args:
        test_path: Path to the test file or directory to run
        pythonpath: Path to set as PYTHONPATH environment variable
        verbose: Whether to use verbose output (-v flag)
        
    Returns:
        Tuple of (return_code, stdout, json_data)
    """
    # Create a temporary file for JSON report
    json_report_path = f"/tmp/pytest_report_{uuid.uuid4().hex}.json"
    
    # Build pytest command
    cmd = ["pytest"]
    if verbose:
        cmd.append("-v")
    else:
        cmd.append("-q")
    cmd.extend([
        f"--json-report",
        f"--json-report-file={json_report_path}",
        "--json-report-indent=2",
        test_path
    ])
    
    # Set environment with PYTHONPATH
    env = os.environ.copy()
    env["PYTHONPATH"] = pythonpath
    
    # Run pytest
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env
    )
    
    # Read JSON report
    json_data = {}
    if os.path.exists(json_report_path):
        with open(json_report_path, 'r') as f:
            json_data = json.load(f)
        # Clean up temporary file
        os.remove(json_report_path)
    
    return result.returncode, result.stdout, json_data


def parse_test_results(json_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse pytest JSON report into the required format.
    
    Args:
        json_data: Raw pytest-json-report data
        
    Returns:
        Parsed test results in the required format
    """
    summary = json_data.get("summary", {})
    tests_data = json_data.get("tests", [])
    
    # Build summary
    num_passed = summary.get("passed", 0)
    num_failed = summary.get("failed", 0)
    num_total = summary.get("total", 0)
    
    # Determine test suite status
    num_test_suites = 1  # We have one test file
    num_passed_suites = 1 if num_failed == 0 else 0
    num_failed_suites = 1 if num_failed > 0 else 0
    
    result = {
        "totalTests": num_total,
        "passedTests": num_passed,
        "failedTests": num_failed,
        "totalTestSuites": num_test_suites,
        "passedTestSuites": num_passed_suites,
        "failedTestSuites": num_failed_suites
    }
    
    # Build summary matrix [passed, failed]
    summary_matrix = [[num_passed, num_failed]]
    
    # Build individual test results
    tests = []
    for test in tests_data:
        test_item = {
            "fullName": test.get("nodeid", ""),
            "status": test.get("outcome", "unknown"),
            "title": test.get("nodeid", "").split("::")[-1],
            "failureMessages": [],
            "location": {
                "column": 0,
                "line": test.get("lineno", 0)
            }
        }
        
        # Add failure messages if test failed
        if test.get("outcome") == "failed":
            call_info = test.get("call", {})
            longrepr = call_info.get("longrepr", "")
            if longrepr:
                test_item["failureMessages"].append(longrepr)
        
        tests.append(test_item)
    
    return {
        "summary": result,
        "summary_matrix": summary_matrix,
        "tests": tests,
        "raw_output": json.dumps(json_data)
    }


def calculate_metrics(duration: float) -> Dict[str, Any]:
    """
    Calculate performance metrics.
    
    Args:
        duration: Execution duration in seconds
        
    Returns:
        Metrics dictionary
    """
    return {
        "execution_time_seconds": duration,
        "items_processed": None,  # Not applicable for this test suite
        "error": None
    }


def create_comparison(
    before_duration: float,
    after_duration: float,
    before_passed: bool,
    after_passed: bool
) -> Dict[str, Any]:
    """
    Create comparison metrics between before and after.
    
    Args:
        before_duration: Duration of before tests
        after_duration: Duration of after tests
        before_passed: Whether before tests passed
        after_passed: Whether after tests passed
        
    Returns:
        Comparison dictionary
    """
    passed_gate = after_passed
    
    # Calculate speedup if applicable
    speedup_factor = None
    improvement_summary = None
    
    if before_duration > 0 and after_duration > 0:
        speedup_factor = before_duration / after_duration
        if speedup_factor > 1:
            improvement_summary = f"Speedup: {speedup_factor:.2f}x"
        elif speedup_factor < 1:
            improvement_summary = f"Slowdown: {1/speedup_factor:.2f}x"
        else:
            improvement_summary = "No performance change"
    elif after_passed and not before_passed:
        improvement_summary = "Tests now passing"
    
    return {
        "passed_gate": passed_gate,
        "improvement_summary": improvement_summary,
        "speedup_factor": speedup_factor
    }


def main():
    """Main evaluation function."""
    print("Starting evaluation...")
    
    # Generate run metadata
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    
    # Get environment information
    environment = {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }
    
    print(f"Run ID: {run_id}")
    print(f"Python: {environment['python_version']}")
    print(f"Platform: {environment['platform']}")
    
    # Run tests for repository_before
    print("\nRunning tests for repository_before...")
    before_return_code, before_output, before_json = run_pytest_with_json(
        test_path="repository_before/test_client.py",
        pythonpath="/app/tests",
        verbose=False
    )
    before_passed = before_return_code == 0
    before_duration = before_json.get("duration", 0)
    before_results = parse_test_results(before_json)
    
    print(f"Before: {'PASSED' if before_passed else 'FAILED'} "
          f"({before_results['summary']['passedTests']}/"
          f"{before_results['summary']['totalTests']} tests passed)")
    
    # Run tests for repository_after
    print("\nRunning tests for repository_after...")
    after_return_code, after_output, after_json = run_pytest_with_json(
        test_path="repository_after/test_client.py",
        pythonpath="/app/tests",
        verbose=False
    )
    after_passed = after_return_code == 0
    after_duration = after_json.get("duration", 0)
    after_results = parse_test_results(after_json)
    
    print(f"After: {'PASSED' if after_passed else 'FAILED'} "
          f"({after_results['summary']['passedTests']}/"
          f"{after_results['summary']['totalTests']} tests passed)")

    # Run validation (coverage contract) for repository_before
    print("\nVerifying coverage contract for repository_before (Expected: FAIL)...")
    val_before_code, val_before_out, val_before_json = run_pytest_with_json(
        test_path="tests/test_coverage_contract.py",
        pythonpath="/app/repository_before:/app/tests",
        verbose=False
    )
    val_before_passed = val_before_code == 0
    val_before_results = parse_test_results(val_before_json)
    print(f"Validation Before: {'PASSED' if val_before_passed else 'FAILED'}")

    # Run validation (coverage contract) for repository_after
    print("\nVerifying coverage contract for repository_after (Expected: PASS)...")
    val_after_code, val_after_out, val_after_json = run_pytest_with_json(
        test_path="tests/test_coverage_contract.py",
        pythonpath="/app/repository_after:/app/tests",
        verbose=False
    )
    val_after_passed = val_after_code == 0
    val_after_results = parse_test_results(val_after_json)
    print(f"Validation After: {'PASSED' if val_after_passed else 'FAILED'}")
    
    # Calculate metrics
    before_metrics = calculate_metrics(before_duration)
    after_metrics = calculate_metrics(after_duration)
    
    # Create comparison
    comparison = create_comparison(
        before_duration,
        after_duration,
        before_passed,
        after_passed
    )
    
    # Finalize timing
    finished_at = datetime.now(timezone.utc)
    duration_seconds = (finished_at - started_at).total_seconds()
    
    # Build final report
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": duration_seconds,
        "environment": environment,
        "before": {
            "tests": {
                "passed": before_passed,
                "return_code": before_return_code,
                "output": before_output,
                **before_results
            },
            "metrics": before_metrics,
            "validation": {
                "passed": val_before_passed,
                "return_code": val_before_code,
                **val_before_results
            }
        },
        "after": {
            "tests": {
                "passed": after_passed,
                "return_code": after_return_code,
                "output": after_output,
                **after_results
            },
            "metrics": after_metrics,
            "validation": {
                "passed": val_after_passed,
                "return_code": val_after_code,
                **val_after_results
            }
        },
        "comparison": comparison,
        "success": after_passed and val_after_passed,
        "error": None
    }
    
    # Create output directory with timestamp
    now = datetime.now()
    date_dir = now.strftime("%Y-%m-%d")
    time_dir = now.strftime("%H-%M-%S")
    output_dir = Path(f"/app/evaluation/reports/{date_dir}/{time_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write report to file
    report_path = output_dir / "report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n✓ Report generated: {report_path}")
    print(f"✓ Evaluation complete in {duration_seconds:.2f}s")
    
    if comparison["improvement_summary"]:
        print(f"✓ {comparison['improvement_summary']}")
    
    # Return appropriate exit code
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
