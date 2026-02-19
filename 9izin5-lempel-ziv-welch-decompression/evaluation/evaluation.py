import subprocess
import sys
import os
import json
import uuid
from datetime import datetime

TASK_TITLE = "LEMPEL-ZIV-WELCH DECOMPRESSION"

def run_tests(implementation):
    """Run pytest for specified implementation."""
    env = os.environ.copy()
    env["TEST_IMPLEMENTATION"] = implementation
    
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=no"],
        capture_output=True,
        text=True,
        env=env,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    
    return {
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr
    }


def parse_test_results(test_output):
    """Parse pytest output to extract test results."""
    stdout = test_output.get("stdout", "")
    lines = stdout.split("\n")
    
    test_details = []
    seen_tests = set()
    
    for line in lines:
        if "::" in line and ("[" in line and "%" in line and "]" in line):
            nodeid = line.strip().split(" ")[0]
            parts = nodeid.split("::")
            test_name = parts[-1] if parts else nodeid
            
            if test_name in seen_tests:
                continue
            seen_tests.add(test_name)
            
            if "PASSED" in line:
                outcome = "passed"
            elif "FAILED" in line:
                outcome = "failed"
            elif "ERROR" in line:
                outcome = "error"
            else:
                continue
                
            test_details.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})
    
    passed = sum(1 for t in test_details if t["outcome"] == "passed")
    failed = sum(1 for t in test_details if t["outcome"] == "failed")
    errors = sum(1 for t in test_details if t["outcome"] == "error")
    skipped = 0
    total = len(test_details)
    
    return {
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
        "total": total,
        "tests": test_details,
        "stdout": stdout,
        "stderr": test_output.get("stderr", "")
    }


def main():
    run_id = str(uuid.uuid4())[:8]
    start_time = datetime.now()
    start_iso = start_time.isoformat()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_iso}")
    print()
    print("=" * 60)
    print(f"{TASK_TITLE} EVALUATION")
    print("=" * 60)
    print()
    
    # Run BEFORE tests
    print("=" * 60)
    print("RUNNING TESTS: BEFORE (REPOSITORY_BEFORE)")
    print("=" * 60)
    print("Environment: repository_before")
    print("Tests directory: /app/tests")
    print()
    
    before_output = run_tests("before")
    before_results = parse_test_results(before_output)
    
    print(f"Results: {before_results['passed']} passed, {before_results['failed']} failed, {before_results['errors']} errors, {before_results['skipped']} skipped (total: {before_results['total']})")
    for test in before_results["tests"]:
        status = "[✓ PASS]" if test["outcome"] == "passed" else "[✗ FAIL]"
        print(f"  {status} {test['name']}")
    print()
    
    # Run AFTER tests
    print("=" * 60)
    print("RUNNING TESTS: AFTER (REPOSITORY_AFTER)")
    print("=" * 60)
    print("Environment: repository_after")
    print("Tests directory: /app/tests")
    print()
    
    after_output = run_tests("after")
    after_results = parse_test_results(after_output)
    
    print(f"Results: {after_results['passed']} passed, {after_results['failed']} failed, {after_results['errors']} errors, {after_results['skipped']} skipped (total: {after_results['total']})")
    for test in after_results["tests"]:
        status = "[✓ PASS]" if test["outcome"] == "passed" else "[✗ FAIL]"
        print(f"  {status} {test['name']}")
    print()
    
    # Summary
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    
    before_failed = before_results["failed"] > 0 or before_results["errors"] > 0
    after_passed = after_results["failed"] == 0 and after_results["errors"] == 0
    
    print("Before Implementation (repository_before):")
    print(f"  Overall: {'FAILED' if before_failed else 'PASSED'}")
    print(f"  Tests: {before_results['passed']}/{before_results['total']} passed")
    print()
    print("After Implementation (repository_after):")
    print(f"  Overall: {'PASSED' if after_passed else 'FAILED'}")
    print(f"  Tests: {after_results['passed']}/{after_results['total']} passed")
    print()
    
    # Expected behavior check
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    
    if after_passed:
        print("[✓ OK] After implementation: All tests passed (expected)")
    else:
        print("[✗ FAIL] After implementation: Some tests failed (unexpected)")
    
    if before_failed:
        print("[✓ OK] Before implementation: Tests failed (expected)")
    else:
        print("[✗ FAIL] Before implementation: All tests passed (unexpected)")
    print()
    
    # Save report
    end_time = datetime.now()
    duration_seconds = (end_time - start_time).total_seconds()
    
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports", date_str, time_str)
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "report.json")
    
    overall_success = after_passed and before_failed
    
    report = {
        "run_id": run_id,
        "task_title": TASK_TITLE,
        "start_time": start_iso,
        "end_time": end_time.isoformat(),
        "duration_seconds": round(duration_seconds, 4),
        "before_results": {
            "success": not before_failed,
            "tests": before_results["tests"],
            "summary": {
                "total": before_results["total"],
                "passed": before_results["passed"],
                "failed": before_results["failed"],
                "errors": before_results["errors"],
                "skipped": before_results["skipped"]
            }
        },
        "after_results": {
            "success": after_passed,
            "tests": after_results["tests"],
            "summary": {
                "total": after_results["total"],
                "passed": after_results["passed"],
                "failed": after_results["failed"],
                "errors": after_results["errors"],
                "skipped": after_results["skipped"]
            }
        },
        "overall_status": "PASSED" if overall_success else "FAILED",
        "expected_behavior_validation": {
            "before_fails": before_failed,
            "after_passes": after_passed,
            "valid": overall_success
        }
    }
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    print("Report saved to:")
    print(f"evaluation/reports/{date_str}/{time_str}/report.json")
    print()
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {round(duration_seconds, 1)}s")
    print(f"Success: {'YES' if overall_success else 'NO'}")
    print()


if __name__ == "__main__":
    main()
