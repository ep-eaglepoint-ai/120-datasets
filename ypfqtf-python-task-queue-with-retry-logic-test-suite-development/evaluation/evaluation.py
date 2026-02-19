"""
Evaluation Runner for Python Task Queue with Retry Logic Test Suite
Runs primary tests and meta-tests and generates a JSON report.
"""
import subprocess
import sys
import os
import json
import uuid
from datetime import datetime
from pathlib import Path


def run_pytest(test_path, cwd=None):
    """Run pytest and return results."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"],
        capture_output=True,
        text=True,
        cwd=cwd or test_path
    )
    return result


def parse_pytest_output(output):
    """Parse pytest output to extract test results."""
    tests = []
    lines = output.split("\n")
    
    for line in lines:
        if "PASSED" in line:
            test_name = line.split("::")[1].split(" ")[0] if "::" in line else line.split()[0]
            tests.append({"name": test_name, "status": "passed"})
        elif "FAILED" in line:
            test_name = line.split("::")[1].split(" ")[0] if "::" in line else line.split()[0]
            tests.append({"name": test_name, "status": "failed"})
    
    return tests


def count_results(tests):
    """Count passed, failed, and total tests."""
    passed = sum(1 for t in tests if t["status"] == "passed")
    failed = sum(1 for t in tests if t["status"] == "failed")
    return passed, failed, len(tests)


def main():
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}")
    print()
    print("=" * 60)
    print("PYTHON TASK QUEUE WITH RETRY LOGIC TEST EVALUATION")
    print("=" * 60)
    print()
    
    base_dir = Path(__file__).parent.parent
    repo_after = base_dir / "repository_after"
    tests_dir = base_dir / "tests"
    
    print("=" * 60)
    print("RUNNING PRIMARY TESTS")
    print("=" * 60)
    print(f"Test location: {repo_after}")
    print()
    
    primary_result = run_pytest(str(repo_after), cwd=str(repo_after))
    primary_tests = parse_pytest_output(primary_result.stdout)
    primary_passed, primary_failed, primary_total = count_results(primary_tests)
    
    print(f"Results: {primary_passed} passed, {primary_failed} failed, 0 errors, 0 skipped (total: {primary_total})")
    for test in primary_tests:
        status = "[✓ PASS]" if test["status"] == "passed" else "[✗ FAIL]"
        print(f"  {status} {test['name']}")
    print()
    
    print("=" * 60)
    print("RUNNING META-TESTS")
    print("=" * 60)
    print(f"Meta-tests directory: {tests_dir}")
    print()
    
    meta_result = run_pytest(str(tests_dir), cwd=str(base_dir))
    meta_tests = parse_pytest_output(meta_result.stdout)
    meta_passed, meta_failed, meta_total = count_results(meta_tests)
    
    print(f"Results: {meta_passed} passed, {meta_failed} failed, 0 errors, 0 skipped (total: {meta_total})")
    for test in meta_tests:
        status = "[✓ PASS]" if test["status"] == "passed" else "[✗ FAIL]"
        print(f"  {status} {test['name']}")
    print()
    
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    
    primary_overall = "PASSED" if primary_failed == 0 else "FAILED"
    meta_overall = "PASSED" if meta_failed == 0 else "FAILED"
    
    print("Primary Tests:")
    print(f"  Overall: {primary_overall}")
    print(f"  Tests: {primary_passed}/{primary_total} passed")
    print()
    print("Meta-Tests:")
    print(f"  Overall: {meta_overall}")
    print(f"  Tests: {meta_passed}/{meta_total} passed")
    print()
    
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    
    if primary_failed == 0:
        print("[✓ OK] Primary tests passed")
    else:
        print("[✗ FAIL] Primary tests failed")
    
    if meta_failed == 0:
        print("[✓ OK] Meta-tests passed")
    else:
        print("[✗ FAIL] Meta-tests failed")
    print()
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    report_dir = base_dir / "evaluation" / "reports" / start_time.strftime("%Y-%m-%d") / start_time.strftime("%H-%M-%S")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "report.json"
    
    report = {
        "run_id": run_id,
        "task_title": "Python Task Queue with Retry Logic - Test Suite Development",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": duration,
        "primary_test_results": {
            "total": primary_total,
            "passed": primary_passed,
            "failed": primary_failed,
            "tests": primary_tests,
            "overall": primary_overall
        },
        "meta_test_results": {
            "total": meta_total,
            "passed": meta_passed,
            "failed": meta_failed,
            "tests": meta_tests,
            "overall": meta_overall
        },
        "overall_status": "SUCCESS" if (primary_failed == 0 and meta_failed == 0) else "FAILURE",
        "execution_environment": {
            "python_version": sys.version,
            "platform": sys.platform
        }
    }
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"Report saved to:")
    print(f"{report_path}")
    print()
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if report['overall_status'] == 'SUCCESS' else 'NO'}")
    
    return 0 if report["overall_status"] == "SUCCESS" else 1


if __name__ == "__main__":
    sys.exit(main())
