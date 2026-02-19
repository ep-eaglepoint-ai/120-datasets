"""
Evaluation Runner for JWT Refresh Token Rotation with Request Deduplication
"""
import subprocess
import sys
import os
import json
import uuid
from datetime import datetime
from pathlib import Path


def run_tests(cwd):
    """Run vitest tests and return results."""
    result = subprocess.run(
        'npm test',
        capture_output=True,
        text=True,
        cwd=cwd,
        shell=True
    )
    return result


def parse_vitest_json(json_path):
    """Parse vitest JSON output."""
    tests = []
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
                
            for test_file in data.get('testResults', []):
                for assertion in test_file.get('assertionResults', []):
                    tests.append({
                        'nodeid': f"{test_file.get('name', '')}::{assertion.get('fullName', assertion.get('title', ''))}",
                        'name': assertion.get('title', ''),
                        'fullName': assertion.get('fullName', ''),
                        'status': 'passed' if assertion.get('status') == 'passed' else 'failed',
                        'duration': assertion.get('duration', 0)
                    })
        except Exception as e:
            print(f"Warning: Could not parse JSON results: {e}")
    return tests


def parse_vitest_output(output):
    """Parse vitest console output for test results."""
    tests = []
    lines = output.split('\n')
    
    for line in lines:
        if '✓' in line or '✔' in line or 'PASS' in line:
            name = line.strip()
            for prefix in ['✓', '✔', 'PASS']:
                name = name.replace(prefix, '').strip()
            if name:
                tests.append({'name': name, 'status': 'passed', 'nodeid': name})
        elif '✗' in line or '✘' in line or 'FAIL' in line:
            name = line.strip()
            for prefix in ['✗', '✘', 'FAIL']:
                name = name.replace(prefix, '').strip()
            if name:
                tests.append({'name': name, 'status': 'failed', 'nodeid': name})
    
    return tests


def count_results(tests):
    """Count passed, failed, and total tests."""
    passed = sum(1 for t in tests if t.get('status') == 'passed')
    failed = sum(1 for t in tests if t.get('status') == 'failed')
    return passed, failed, len(tests)


def main():
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}")
    print()
    print("=" * 60)
    print("JWT REFRESH TOKEN ROTATION WITH REQUEST DEDUPLICATION EVALUATION")
    print("=" * 60)
    print()
    
    base_dir = Path(__file__).parent.parent
    tests_dir = base_dir / "tests"
    
    print("=" * 60)
    print("RUNNING TESTS (REPOSITORY_AFTER)")
    print("=" * 60)
    print(f"Environment: repository_after")
    print(f"Tests directory: /app/tests")
    print()
    
    result = run_tests(str(tests_dir))
    
    json_path = tests_dir / "test-results.json"
    tests = parse_vitest_json(str(json_path))
    
    if not tests:
        tests = parse_vitest_output(result.stdout + result.stderr)
    
    passed, failed, total = count_results(tests)
    
    if total == 0 and result.returncode == 0:
        passed_match = None
        for line in (result.stdout + result.stderr).split('\n'):
            if 'passed' in line.lower():
                import re
                match = re.search(r'(\d+)\s+passed', line.lower())
                if match:
                    passed = int(match.group(1))
                    total = passed
                    break
    
    print(f"Results: {passed} passed, {failed} failed, 0 errors, 0 skipped (total: {total})")
    
    for test in tests:
        status = "[✓ PASS]" if test.get('status') == 'passed' else "[✗ FAIL]"
        print(f"  {status} {test.get('name', test.get('nodeid', 'unknown'))}")
    
    if not tests and passed > 0:
        print(f"  [✓ PASS] All {passed} tests passed")
    
    print()
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    
    overall = "PASSED" if failed == 0 and (passed > 0 or result.returncode == 0) else "FAILED"
    
    print("Implementation (repository_after):")
    print(f"  Overall: {overall}")
    print(f"  Tests: {passed}/{total if total > 0 else passed} passed")
    print()
    
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    
    if failed == 0 and (passed > 0 or result.returncode == 0):
        print("[✓ OK] All tests passed (expected)")
    else:
        print("[✗ FAIL] Some tests failed")
    print()
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    report_dir = base_dir / "evaluation" / "reports" / start_time.strftime("%Y-%m-%d") / start_time.strftime("%H-%M-%S")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "report.json"
    
    report = {
        "run_id": run_id,
        "task_title": "JWT Refresh Token Rotation with Request Deduplication",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": duration,
        "test_results": {
            "total": total if total > 0 else passed,
            "passed": passed,
            "failed": failed,
            "errors": 0,
            "skipped": 0,
            "tests": tests if tests else [{"nodeid": f"test_{i}", "name": f"test_{i}", "status": "passed"} for i in range(passed)]
        },
        "overall_status": "SUCCESS" if overall == "PASSED" else "FAILURE"
    }
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Report saved to:")
    print(f"evaluation/reports/{start_time.strftime('%Y-%m-%d')}/{start_time.strftime('%H-%M-%S')}/report.json")
    print()
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if overall == 'PASSED' else 'NO'}")
    
    return 0 if overall == "PASSED" else 1


if __name__ == "__main__":
    sys.exit(main())
