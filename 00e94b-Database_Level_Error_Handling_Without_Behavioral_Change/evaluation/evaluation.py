#!/usr/bin/env python3
"""
Evaluation runner for SQL Error Handling Refactor.

This evaluation script:
- Runs pytest tests on the tests/ folder for both before and after SQL implementations
- Collects individual test results with pass/fail status
- Generates structured reports with environment metadata

Run with:
    docker compose run --rm app python evaluation/evaluation.py [options]
    
    OR locally (with PostgreSQL running):
    python evaluation/evaluation.py
"""
import os
import sys
import json
import uuid
import platform
import subprocess
from datetime import datetime
from pathlib import Path


def generate_run_id():
    """Generate a short unique run ID."""
    return uuid.uuid4().hex[:8]


def get_git_info():
    """Get git commit and branch information."""
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]
    except Exception:
        pass
    
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    
    return git_info


def get_environment_info():
    """Collect environment information for the report."""
    git_info = get_git_info()
    
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": git_info["git_commit"],
        "git_branch": git_info["git_branch"],
    }


def run_pytest_tests(tests_dir, test_file, label):
    """
    Run pytest on a specific test file.
    
    Args:
        tests_dir: Path to the tests directory
        test_file: Name of the test file (e.g., "test_before.py")
        label: Label for this test run (e.g., "before", "after")
    
    Returns:
        dict with test results
    """
    print(f"\n{'=' * 60}")
    print(f"RUNNING TESTS: {label.upper()}")
    print(f"{'=' * 60}")
    print(f"Test file: {test_file}")
    
    test_path = Path(tests_dir) / test_file
    
    # Build pytest command
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "-v",
        "--tb=short",
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(Path(tests_dir).parent),
            timeout=120
        )
        
        stdout = result.stdout
        stderr = result.stderr
        
        # Parse verbose output to get test results
        tests = parse_pytest_verbose_output(stdout)
        
        # Count results
        passed = sum(1 for t in tests if t.get("outcome") == "passed")
        failed = sum(1 for t in tests if t.get("outcome") == "failed")
        errors = sum(1 for t in tests if t.get("outcome") == "error")
        skipped = sum(1 for t in tests if t.get("outcome") == "skipped")
        total = len(tests)
        
        print(f"\nResults: {passed} passed, {failed} failed, {errors} errors, {skipped} skipped (total: {total})")
        
        # Print individual test results
        for test in tests:
            status_icon = {
                "passed": "✅",
                "failed": "❌",
                "error": "💥",
                "skipped": "⏭️"
            }.get(test.get("outcome"), "❓")
            print(f"  {status_icon} {test.get('nodeid', 'unknown')}: {test.get('outcome', 'unknown')}")
        
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "tests": tests,
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "skipped": skipped,
            },
            "stdout": stdout[-3000:] if len(stdout) > 3000 else stdout,
            "stderr": stderr[-1000:] if len(stderr) > 1000 else stderr,
        }
        
    except subprocess.TimeoutExpired:
        print("❌ Test execution timed out")
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"error": "Test execution timed out"},
            "stdout": "",
            "stderr": "",
        }
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"error": str(e)},
            "stdout": "",
            "stderr": "",
        }


def parse_pytest_verbose_output(output):
    """Parse pytest verbose output to extract test results."""
    tests = []
    lines = output.split('\n')
    
    for line in lines:
        line_stripped = line.strip()
        
        # Match lines like: tests/test_before.py::test_orphan_user_integrity_before PASSED
        if '::' in line_stripped:
            outcome = None
            if ' PASSED' in line_stripped:
                outcome = "passed"
            elif ' FAILED' in line_stripped:
                outcome = "failed"
            elif ' ERROR' in line_stripped:
                outcome = "error"
            elif ' SKIPPED' in line_stripped:
                outcome = "skipped"
            
            if outcome:
                # Extract nodeid (everything before the status)
                for status_word in [' PASSED', ' FAILED', ' ERROR', ' SKIPPED']:
                    if status_word in line_stripped:
                        nodeid = line_stripped.split(status_word)[0].strip()
                        break
                
                tests.append({
                    "nodeid": nodeid,
                    "name": nodeid.split("::")[-1] if "::" in nodeid else nodeid,
                    "outcome": outcome,
                })
    
    return tests


def run_evaluation():
    """
    Run complete evaluation for both SQL implementations.
    
    The evaluation tests:
    - test_before.py: Tests that SHOULD FAIL on repository_before (proves vulnerabilities exist)
    - test_after.py: Tests that SHOULD PASS on repository_after (proves fixes work)
    
    Returns dict with test results from both implementations.
    """
    print(f"\n{'=' * 60}")
    print("SQL ERROR HANDLING REFACTOR EVALUATION")
    print(f"{'=' * 60}")
    
    project_root = Path(__file__).parent.parent
    tests_dir = project_root / "tests"
    
    # Run tests for BEFORE implementation (test_before.py)
    # These tests are designed to FAIL - they assert that the old code catches errors it doesn't
    before_results = run_pytest_tests(
        tests_dir,
        "test_before.py",
        "before (repository_before) - Expected to FAIL"
    )
    
    # Run tests for AFTER implementation (test_after.py)
    # These tests should PASS - they verify the new robust error handling
    after_results = run_pytest_tests(
        tests_dir,
        "test_after.py",
        "after (repository_after) - Expected to PASS"
    )
    
    # Build comparison
    comparison = {
        "before_tests_passed": before_results.get("success", False),
        "after_tests_passed": after_results.get("success", False),
        "before_total": before_results.get("summary", {}).get("total", 0),
        "before_passed": before_results.get("summary", {}).get("passed", 0),
        "before_failed": before_results.get("summary", {}).get("failed", 0),
        "after_total": after_results.get("summary", {}).get("total", 0),
        "after_passed": after_results.get("summary", {}).get("passed", 0),
        "after_failed": after_results.get("summary", {}).get("failed", 0),
    }
    
    # Print summary
    print(f"\n{'=' * 60}")
    print("EVALUATION SUMMARY")
    print(f"{'=' * 60}")
    
    print(f"\nBefore Implementation (test_before.py on repository_before):")
    print(f"  Overall: {'✅ PASSED' if before_results.get('success') else '❌ FAILED'}")
    print(f"  Tests: {comparison['before_passed']}/{comparison['before_total']} passed")
    print(f"  Note: These tests are EXPECTED to fail (they prove vulnerabilities exist)")
    
    print(f"\nAfter Implementation (test_after.py on repository_after):")
    print(f"  Overall: {'✅ PASSED' if after_results.get('success') else '❌ FAILED'}")
    print(f"  Tests: {comparison['after_passed']}/{comparison['after_total']} passed")
    
    # Determine expected behavior
    print(f"\n{'=' * 60}")
    print("EXPECTED BEHAVIOR CHECK")
    print(f"{'=' * 60}")
    
    # Before: tests SHOULD fail (they assert error handling that doesn't exist)
    # After: tests SHOULD pass (they verify the new error handling works)
    
    before_expected = not before_results.get("success")  # We EXPECT failure
    after_expected = after_results.get("success")  # We EXPECT success
    
    if before_expected:
        print("✅ Before tests failed as expected (proves vulnerabilities in old code)")
    else:
        print("⚠️  Before tests unexpectedly passed (old code might already have error handling?)")
    
    if after_expected:
        print("✅ After tests passed (new error handling works correctly)")
    else:
        print("❌ After tests failed (new error handling has issues)")
    
    return {
        "before": before_results,
        "after": after_results,
        "comparison": comparison,
        "evaluation_passed": before_expected and after_expected,
    }


def generate_output_path():
    """Generate output path in format: evaluation/YYYY-MM-DD/HH-MM-SS/report.json"""
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    
    project_root = Path(__file__).parent.parent
    output_dir = project_root / "evaluation" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)
    
    return output_dir / "report.json"


def main():
    """Main entry point for evaluation."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run SQL error handling refactor evaluation")
    parser.add_argument(
        "--output", 
        type=str, 
        default=None, 
        help="Output JSON file path (default: evaluation/YYYY-MM-DD/HH-MM-SS/report.json)"
    )
    
    args = parser.parse_args()
    
    # Generate run ID and timestamps
    run_id = generate_run_id()
    started_at = datetime.now()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {started_at.isoformat()}")
    
    try:
        results = run_evaluation()
        
        # Success if: before tests fail (expected) AND after tests pass (expected)
        success = results.get("evaluation_passed", False)
        error_message = None if success else "Evaluation did not meet expected outcomes"
        
    except Exception as e:
        import traceback
        print(f"\nERROR: {str(e)}")
        traceback.print_exc()
        results = None
        success = False
        error_message = str(e)
    
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()
    
    # Collect environment information
    environment = get_environment_info()
    
    # Build report
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 6),
        "success": success,
        "error": error_message,
        "environment": environment,
        "results": results,
    }
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path()
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n✅ Report saved to: {output_path}")
    
    print(f"\n{'=' * 60}")
    print(f"EVALUATION COMPLETE")
    print(f"{'=' * 60}")
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'✅ YES' if success else '❌ NO'}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())