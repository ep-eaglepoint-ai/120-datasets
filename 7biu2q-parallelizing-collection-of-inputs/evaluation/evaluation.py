"""
Evaluation runner for Parallelizing Collection of Inputs task.
"""
import subprocess
import sys
import os
import json
import uuid
import platform
from datetime import datetime

TASK_TITLE = "Parallelizing Collection of Inputs"


def run_tests(implementation):
    """Run pytest tests for a specific implementation."""
    env = os.environ.copy()
    env["TEST_IMPLEMENTATION"] = implementation
    
    result = subprocess.run(
        ["pytest", "tests/", "-v", "--tb=short"],
        capture_output=True,
        text=True,
        cwd="/app",
        env=env
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
        # Only parse lines with percentage progress indicator (actual test run lines)
        if "::" in line and ("[" in line and "%" in line and "]" in line):
            nodeid = line.strip().split(" ")[0]
            
            # Extract just the test name for deduplication
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


def save_report(report, reports_dir):
    """Save JSON report to file."""
    os.makedirs(reports_dir, exist_ok=True)
    report_path = os.path.join(reports_dir, "report.json")
    
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    return report_path


def main():
    run_id = str(uuid.uuid4())[:8]
    start_time = datetime.utcnow()
    start_iso = start_time.isoformat()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_iso}")
    print()
    print("=" * 60)
    print(f"{TASK_TITLE.upper()} EVALUATION")
    print("=" * 60)
    print()
    
    # Run tests for BEFORE
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
        status = "✓ PASS" if test["outcome"] == "passed" else "✗ FAIL"
        print(f"  [{status}] {test['name']}")
    print()
    
    # Run tests for AFTER
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
        status = "✓ PASS" if test["outcome"] == "passed" else "✗ FAIL"
        print(f"  [{status}] {test['name']}")
    print()
    
    # Evaluation Summary
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    
    before_failed = before_results["failed"] > 0 or before_results["errors"] > 0
    after_passed = after_results["failed"] == 0 and after_results["errors"] == 0 and after_results["passed"] > 0
    
    print("Before Implementation (repository_before):")
    print(f"  Overall: {'FAILED' if before_failed else 'PASSED'}")
    print(f"  Tests: {before_results['passed']}/{before_results['total']} passed")
    print()
    print("After Implementation (repository_after):")
    print(f"  Overall: {'PASSED' if after_passed else 'FAILED'}")
    print(f"  Tests: {after_results['passed']}/{after_results['total']} passed")
    print()
    
    # Expected Behavior Check
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    
    if after_passed:
        print("[✓ OK] After implementation: All tests passed (expected)")
    else:
        print("[✗ FAIL] After implementation: Tests failed (unexpected)")
    
    if before_failed:
        print("[✓ OK] Before implementation: Tests failed (expected)")
    else:
        print("[✗ FAIL] Before implementation: Tests passed (unexpected)")
    
    print()
    
    # Save report
    end_time = datetime.utcnow()
    duration_seconds = (end_time - start_time).total_seconds()
    
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    reports_dir = f"/app/evaluation/reports/{date_str}/{time_str}"
    
    overall_success = after_passed and before_failed
    
    report = {
        "run_id": run_id,
        "tool": f"{TASK_TITLE} Evaluator",
        "started_at": start_iso,
        "finished_at": end_time.isoformat(),
        "duration_seconds": round(duration_seconds, 4),
        "environment": {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "os": platform.system(),
            "git_commit": "unknown",
            "git_branch": "unknown"
        },
        "results": {
            "success": after_passed,
            "exit_code": 0 if after_passed else 1,
            "tests": after_results["tests"],
            "summary": {
                "total": after_results["total"],
                "passed": after_results["passed"],
                "failed": after_results["failed"],
                "errors": after_results["errors"],
                "skipped": after_results["skipped"]
            },
            "stdout": after_results["stdout"],
            "stderr": after_results["stderr"]
        },
        "before_results": {
            "success": not before_failed,
            "tests": before_results["tests"],
            "summary": {
                "total": before_results["total"],
                "passed": before_results["passed"],
                "failed": before_results["failed"],
                "errors": before_results["errors"],
                "skipped": before_results["skipped"]
            },
            "stdout": before_results["stdout"],
            "stderr": before_results["stderr"]
        },
        "criteria_analysis": {
            "limits_concurrent_processes": "Checked via TestRequirement1",
            "efficient_cpu_utilization": "Checked via TestRequirement2",
            "minimize_overhead": "Checked via TestRequirement3",
            "all_cores_busy": "Checked via TestRequirement4",
            "predictable_scaling": "Checked via TestRequirement5"
        },
        "success": overall_success,
        "error": None
    }
    
    report_path = save_report(report, reports_dir)
    
    print(f"Report saved to:")
    print(f"{report_path}")
    print()
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration_seconds:.1f}s")
    print(f"Success: {'YES' if overall_success else 'NO'}")
    print()
    
    sys.exit(0 if overall_success else 1)


if __name__ == "__main__":
    main()
