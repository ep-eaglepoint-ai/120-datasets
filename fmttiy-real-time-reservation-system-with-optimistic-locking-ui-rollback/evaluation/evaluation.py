"""
Evaluation System for Real-Time Reservation System with OCC
Runs tests and generates structured JSON report
"""

import subprocess
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path


TASK_TITLE = "Real-Time Reservation System with Optimistic Locking & UI Rollback"


def run_tests():
    """Run pytest and capture results"""
    tests_dir = Path(__file__).parent.parent / "tests"
    repo_dir = Path(__file__).parent.parent / "repository_after"
    
    # Set PYTHONPATH to include repository_after
    env = os.environ.copy()
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")
    
    result = subprocess.run(
        [
            sys.executable, "-m", "pytest",
            str(tests_dir),
            "-v",
            "--tb=short",
            "-q"
        ],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent.parent),
        env=env
    )
    
    return result


def parse_pytest_output(output: str, return_code: int):
    """Parse pytest output to extract test results"""
    import re
    
    lines = output.strip().split('\n')
    
    tests = []
    passed = 0
    failed = 0
    errors = 0
    skipped = 0
    
    for line in lines:
        line = line.strip()
        
        # Match test result lines with :: separator
        if '::' in line and ('PASSED' in line or 'FAILED' in line or 'ERROR' in line or 'SKIPPED' in line):
            if 'PASSED' in line:
                status = 'passed'
            elif 'FAILED' in line:
                status = 'failed'
            elif 'ERROR' in line:
                status = 'error'
            elif 'SKIPPED' in line:
                status = 'skipped'
            else:
                continue
            
            # Extract test name
            test_name = line.split('::')[-1].split()[0] if '::' in line else line.split()[0]
            tests.append({
                'name': test_name,
                'status': status
            })
    
    # Parse the summary line - handle various formats
    for line in lines:
        # Match patterns like "30 passed", "30 passed, 2 warnings"
        passed_match = re.search(r'(\d+)\s+passed', line)
        failed_match = re.search(r'(\d+)\s+failed', line)
        error_match = re.search(r'(\d+)\s+error', line)
        skipped_match = re.search(r'(\d+)\s+skipped', line)
        
        if passed_match:
            passed = int(passed_match.group(1))
        if failed_match:
            failed = int(failed_match.group(1))
        if error_match:
            errors = int(error_match.group(1))
        if skipped_match:
            skipped = int(skipped_match.group(1))
    
    # If we found passed count but no individual tests, create placeholders
    if passed > 0 and len(tests) == 0:
        for i in range(passed):
            tests.append({'name': f'test_{i+1}', 'status': 'passed'})
    
    return {
        'tests': tests,
        'passed': passed,
        'failed': failed,
        'errors': errors,
        'skipped': skipped,
        'total': passed + failed + errors + skipped
    }


def main():
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}Z")
    print()
    print("=" * 60)
    print(f"{TASK_TITLE} EVALUATION")
    print("=" * 60)
    print()
    
    print("=" * 60)
    print("RUNNING TESTS (REPOSITORY_AFTER)")
    print("=" * 60)
    print("Environment: repository_after")
    print("Tests directory: /app/tests")
    print()
    
    # Run tests
    result = run_tests()
    
    # Print test output
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    
    # Parse results
    test_results = parse_pytest_output(result.stdout + result.stderr, result.returncode)
    
    total = test_results['total']
    passed = test_results['passed']
    failed = test_results['failed']
    errors = test_results['errors']
    skipped = test_results['skipped']
    
    print()
    print(f"Results: {passed} passed, {failed} failed, {errors} errors, {skipped} skipped (total: {total})")
    
    for test in test_results['tests']:
        symbol = "✓" if test['status'] == 'passed' else "✗"
        status_text = "PASS" if test['status'] == 'passed' else "FAIL"
        print(f"  [{symbol} {status_text}] {test['name']}")
    
    print()
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    
    overall_status = "PASSED" if failed == 0 and errors == 0 else "FAILED"
    
    print("Implementation (repository_after):")
    print(f"  Overall: {overall_status}")
    print(f"  Tests: {passed}/{total} passed")
    print()
    
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    
    if overall_status == "PASSED":
        print("[✓ OK] All tests passed (expected)")
    else:
        print("[✗ FAIL] Some tests failed (unexpected)")
    
    # Generate report
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    
    report_dir = Path(__file__).parent / "reports" / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    
    report = {
        "run_id": run_id,
        "task_title": TASK_TITLE,
        "start_time": start_time.isoformat() + "Z",
        "end_time": end_time.isoformat() + "Z",
        "duration_seconds": round(duration, 2),
        "test_results": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "skipped": skipped,
            "tests": test_results['tests']
        },
        "overall_status": overall_status
    }
    
    report_path = report_dir / "report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print()
    print("Report saved to:")
    print(f"evaluation/reports/{date_str}/{time_str}/report.json")
    print()
    
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if overall_status == 'PASSED' else 'NO'}")
    
    # Exit with appropriate code
    sys.exit(0 if overall_status == "PASSED" else 1)


if __name__ == "__main__":
    main()
