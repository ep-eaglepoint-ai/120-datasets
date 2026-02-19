"""
Evaluation runner for Thread-Safe Token Bucket Rate Limiter.

Runs tests against repository_after and generates structured reports.
"""

import json
import os
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path


TASK_TITLE = "7XLC0W - Thread-Safe Token Bucket Rate Limiter"


def get_base_path():
    """Get base path - /app in Docker, script directory locally."""
    if os.path.exists("/app/tests"):
        return "/app"
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_tests():
    """Run pytest and capture results."""
    base_path = get_base_path()
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_rate_limiter.py", "-v", "--tb=short"],
        capture_output=True,
        text=True,
        cwd=base_path
    )
    return result.stdout + result.stderr, result.returncode


def parse_test_output(output):
    """Parse pytest output to extract test results."""
    results = {
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0,
        "tests": []
    }
    
    lines = output.split('\n')
    for line in lines:
        if "::test_" in line:
            test_name = line.split("::")[-1].split()[0] if "::" in line else ""
            if " PASSED" in line:
                results["passed"] += 1
                results["tests"].append({"name": test_name, "status": "passed"})
            elif " FAILED" in line:
                results["failed"] += 1
                results["tests"].append({"name": test_name, "status": "failed"})
            elif " ERROR" in line:
                results["errors"] += 1
                results["tests"].append({"name": test_name, "status": "error"})
            elif " SKIPPED" in line:
                results["skipped"] += 1
                results["tests"].append({"name": test_name, "status": "skipped"})
    
    # Fallback: parse summary line
    for line in lines:
        if "passed" in line and ("failed" in line or "error" in line or line.strip().startswith("=")):
            import re
            passed_match = re.search(r'(\d+) passed', line)
            failed_match = re.search(r'(\d+) failed', line)
            error_match = re.search(r'(\d+) error', line)
            skipped_match = re.search(r'(\d+) skipped', line)
            
            if passed_match and results["passed"] == 0:
                results["passed"] = int(passed_match.group(1))
            if failed_match:
                results["failed"] = int(failed_match.group(1))
            if error_match:
                results["errors"] = int(error_match.group(1))
            if skipped_match:
                results["skipped"] = int(skipped_match.group(1))
    
    return results


def print_results(results):
    """Print test results in required format."""
    total = results["passed"] + results["failed"] + results["errors"] + results["skipped"]
    
    print(f"\nResults: {results['passed']} passed, {results['failed']} failed, {results['errors']} errors, {results['skipped']} skipped (total: {total})")
    
    for test in results["tests"]:
        if test["status"] == "passed":
            print(f"  [✓ PASS] {test['name']}")
        elif test["status"] == "failed":
            print(f"  [✗ FAIL] {test['name']}")
        elif test["status"] == "error":
            print(f"  [✗ ERROR] {test['name']}")
        else:
            print(f"  [- SKIP] {test['name']}")


def save_report(run_id, start_time, end_time, results):
    """Save JSON report to evaluation/reports directory."""
    duration = (end_time - start_time).total_seconds()
    
    report = {
        "run_id": run_id,
        "task_title": TASK_TITLE,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": duration,
        "test_results": {
            "passed": results["passed"],
            "failed": results["failed"],
            "errors": results["errors"],
            "skipped": results["skipped"],
            "total": results["passed"] + results["failed"] + results["errors"] + results["skipped"],
            "tests": results["tests"]
        },
        "overall_status": "PASSED" if results["failed"] == 0 and results["errors"] == 0 else "FAILED"
    }
    
    # Create report directory
    base_path = get_base_path()
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    report_dir = Path(base_path) / "evaluation" / "reports" / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    
    report_path = report_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    return str(report_path)


def main():
    """Main evaluation function."""
    run_id = str(uuid.uuid4())
    start_time = datetime.now()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}")
    
    print(f"\n{'='*60}")
    print(f"{TASK_TITLE} EVALUATION")
    print(f"{'='*60}")
    
    print(f"\n{'='*60}")
    print("RUNNING TESTS (REPOSITORY_AFTER)")
    print(f"{'='*60}")
    print("Environment: repository_after")
    print("Tests directory: /app/tests")
    
    # Run tests
    output, returncode = run_tests()
    results = parse_test_output(output)
    
    print_results(results)
    
    # Summary
    print(f"\n{'='*60}")
    print("EVALUATION SUMMARY")
    print(f"{'='*60}")
    
    total = results["passed"] + results["failed"] + results["errors"] + results["skipped"]
    overall_status = "PASSED" if results["failed"] == 0 and results["errors"] == 0 else "FAILED"
    
    print(f"\nImplementation (repository_after):")
    print(f"  Overall: {overall_status}")
    print(f"  Tests: {results['passed']}/{total} passed")
    
    print(f"\n{'='*60}")
    print("EXPECTED BEHAVIOR CHECK")
    print(f"{'='*60}")
    
    if overall_status == "PASSED":
        print("[✓ OK] All tests passed (expected)")
    else:
        print("[✗ FAIL] Some tests failed")
    
    # Save report
    end_time = datetime.now()
    report_path = save_report(run_id, start_time, end_time, results)
    
    print(f"\nReport saved to:")
    print(report_path)
    
    print(f"\n{'='*60}")
    print("EVALUATION COMPLETE")
    print(f"{'='*60}")
    
    duration = (end_time - start_time).total_seconds()
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if overall_status == 'PASSED' else 'NO'}")
    
    return 0 if overall_status == "PASSED" else 1


if __name__ == "__main__":
    sys.exit(main())
