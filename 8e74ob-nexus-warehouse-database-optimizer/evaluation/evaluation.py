"""
Nexus Warehouse Database Optimizer - Evaluation System
Runs tests against both repository_before and repository_after implementations
and generates a detailed report including per-test node IDs.
"""

import subprocess
import sys
import os
import json
import uuid
import re
from datetime import datetime
from pathlib import Path

TASK_TITLE = "NEXUS WAREHOUSE DATABASE OPTIMIZER"

def run_tests(env_name: str, pythonpath: str) -> dict:
    """Run pytest and capture results with nodeid granularity"""
    env = os.environ.copy()
    env['PYTHONPATH'] = pythonpath
    
    # Using -v to ensure we get the nodeids in the output
    result = subprocess.run(
        [sys.executable, '-m', 'pytest', '-v', 'tests/', '--tb=short'],
        capture_output=True,
        text=True,
        env=env,
        cwd='/app' if os.path.exists('/app') else os.getcwd()
    )
    
    output = result.stdout + result.stderr
    
    passed = 0
    failed = 0
    errors = 0
    skipped = 0
    test_entries = []
    
    # Regex to capture: tests/test_file.py::TestClass::test_method STATUS
    # Example: tests/test_optimizer.py::TestRequirement6::test_p99 PASSED
    pattern = re.compile(r'^(tests/.*?)\s+(PASSED|FAILED|ERROR|SKIPPED|XFAIL|XPASS)', re.MULTILINE)
    
    matches = pattern.findall(output)
    for nodeid, status in matches:
        test_entries.append({
            'nodeid': nodeid,
            'status': status
        })
        if status == 'PASSED': passed += 1
        elif status == 'FAILED': failed += 1
        elif status == 'ERROR': errors += 1
        elif status == 'SKIPPED': skipped += 1

    total = passed + failed + errors + skipped
    
    return {
        'summary': {
            'passed': passed,
            'failed': failed,
            'errors': errors,
            'skipped': skipped,
            'total': total
        },
        'tests': test_entries,
        'output': output
    }

def print_test_results(results: dict):
    """Print formatted test results to console"""
    s = results['summary']
    print(f"\nResults: {s['passed']} passed, {s['failed']} failed, "
          f"{s['errors']} errors, {s['skipped']} skipped (total: {s['total']})")
    
    for test in results['tests']:
        status_icon = "[✓ PASS]" if test['status'] == 'PASSED' else "[✗ FAIL]"
        # Shorten nodeid for cleaner console output
        display_name = test['nodeid'].split('::')[-1]
        print(f"  {status_icon} {display_name}")

def main():
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}Z")
    print("\n" + "=" * 60)
    print(f"{TASK_TITLE} EVALUATION")
    print("=" * 60)
    
    base_path = '/app' if os.path.exists('/app') else os.getcwd()
    
    # 1. Run BEFORE tests
    print(f"\n>>> RUNNING: REPOSITORY_BEFORE")
    before_path = os.path.join(base_path, 'repository_before')
    before_results = run_tests('before', before_path)
    print_test_results(before_results)
    
    # 2. Run AFTER tests
    print(f"\n>>> RUNNING: REPOSITORY_AFTER")
    after_path = os.path.join(base_path, 'repository_after')
    after_results = run_tests('after', after_path)
    print_test_results(after_results)
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    # Logical Validation
    # Requirement: Before should fail, After should pass.
    before_failed_expected = before_results['summary']['failed'] > 0
    after_passed_expected = after_results['summary']['failed'] == 0 and after_results['summary']['errors'] == 0
    overall_success = before_failed_expected and after_passed_expected

    # Prepare JSON Report
    report_data = {
        'run_id': run_id,
        'task_title': TASK_TITLE,
        'timestamp': start_time.isoformat() + 'Z',
        'duration_s': duration,
        'overall_success': overall_success,
        'implementations': {
            'repository_before': {
                'summary': before_results['summary'],
                'test_details': before_results['tests']
            },
            'repository_after': {
                'summary': after_results['summary'],
                'test_details': after_results['tests']
            }
        },
        'validation': {
            'before_failed_as_expected': before_failed_expected,
            'after_passed_as_expected': after_passed_expected
        }
    }
    
    # Save Report
    date_str = start_time.strftime('%Y-%m-%d')
    time_str = start_time.strftime('%H-%M-%S')
    
    report_dir = Path(base_path) / 'evaluation' / 'reports' / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / 'report.json'
    
    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"Before Implementation: {'FAIL (Expected)' if before_failed_expected else 'PASS (Unexpected)'}")
    print(f"After Implementation:  {'PASS (Expected)' if after_passed_expected else 'FAIL (Unexpected)'}")
    print(f"Success: {'YES' if overall_success else 'NO'}")
    print(f"Report: {report_path}")
    
    return 0 if overall_success else 1

if __name__ == "__main__":
    sys.exit(main())