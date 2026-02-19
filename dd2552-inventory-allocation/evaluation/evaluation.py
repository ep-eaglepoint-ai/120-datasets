#!/usr/bin/env python3
import subprocess
import json
import uuid
import os
from datetime import datetime
from pathlib import Path


def run_tests(env_name, repo_path):
    """Run tests for a specific repository"""
    env = os.environ.copy()
    env['PYTHONPATH'] = f"/app/{repo_path}:/app"
    
    result = subprocess.run(
        ['pytest', '-v', '--tb=short', '--json-report', '--json-report-file=/tmp/report.json', 'tests/'],
        cwd='/app',
        env=env,
        capture_output=True,
        text=True
    )
    
    tests_output = result.stdout + result.stderr
    
    # Parse pytest output
    passed = failed = errors = skipped = 0
    test_results = []
    
    for line in tests_output.split('\n'):
        if 'PASSED' in line:
            passed += 1
            test_name = line.split('::')[1].split(' ')[0] if '::' in line else 'unknown'
            test_results.append({'name': test_name, 'status': 'PASS'})
        elif 'FAILED' in line:
            failed += 1
            test_name = line.split('::')[1].split(' ')[0] if '::' in line else 'unknown'
            test_results.append({'name': test_name, 'status': 'FAIL'})
        elif 'ERROR' in line:
            errors += 1
            test_name = line.split('::')[1].split(' ')[0] if '::' in line else 'unknown'
            test_results.append({'name': test_name, 'status': 'ERROR'})
        elif 'SKIPPED' in line:
            skipped += 1
            test_name = line.split('::')[1].split(' ')[0] if '::' in line else 'unknown'
            test_results.append({'name': test_name, 'status': 'SKIP'})
    
    # Try to load JSON report if available
    try:
        with open('/tmp/report.json', 'r') as f:
            json_report = json.load(f)
            test_results = []
            for test in json_report.get('tests', []):
                test_results.append({
                    'nodeid': test.get('nodeid', ''),
                    'status': test.get('outcome', '').upper()
                })
            passed = json_report.get('summary', {}).get('passed', 0)
            failed = json_report.get('summary', {}).get('failed', 0)
            errors = json_report.get('summary', {}).get('error', 0)
            skipped = json_report.get('summary', {}).get('skipped', 0)
    except:
        pass
    
    total = passed + failed + errors + skipped
    
    return {
        'passed': passed,
        'failed': failed,
        'errors': errors,
        'skipped': skipped,
        'total': total,
        'test_results': test_results,
        'output': tests_output
    }


def print_test_results(results, title, env_name):
    """Print test results in required format"""
    print(f"\n{'='*60}")
    print(title)
    print('='*60)
    print(f"Environment: {env_name}")
    print(f"Tests directory: /app/tests")
    print()
    
    total = results['total']
    passed = results['passed']
    failed = results['failed']
    errors = results['errors']
    skipped = results['skipped']
    
    print(f"Results: {passed} passed, {failed} failed, {errors} errors, {skipped} skipped (total: {total})")
    
    for test in results['test_results']:
        status = test['status']

        passed_statuses = {'PASS', 'PASSED'}
        failed_statuses = {'FAIL', 'FAILED', 'ERROR'}

        if status in passed_statuses:
            status_symbol = '✓'
            status_text = 'PASS'
        else:
            status_symbol = '✗'
            status_text = 'FAIL'
        test_name = test.get('nodeid', test.get('name', 'unknown'))
        print(f"  [{status_symbol} {status_text}] {test_name}")


def main():
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    start_iso = start_time.isoformat() + 'Z'
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_iso}")
    
    print("\n" + "="*60)
    print("POSTGRESQL INVENTORY ALLOCATION OPTIMIZATION EVALUATION")
    print("="*60)
    
    # Run tests for repository_before
    print_test_results(
        run_tests('repository_before', 'repository_before'),
        "RUNNING TESTS: BEFORE (REPOSITORY_BEFORE)",
        "repository_before"
    )
    before_results = run_tests('repository_before', 'repository_before')
    
    # Run tests for repository_after
    print_test_results(
        run_tests('repository_after', 'repository_after'),
        "RUNNING TESTS: AFTER (REPOSITORY_AFTER)",
        "repository_after"
    )
    after_results = run_tests('repository_after', 'repository_after')
    
    # Evaluation summary
    print("\n" + "="*60)
    print("EVALUATION SUMMARY")
    print("="*60)
    print()
    
    before_status = "PASSED" if before_results['failed'] == 0 and before_results['errors'] == 0 else "FAILED"
    after_status = "PASSED" if after_results['failed'] == 0 and after_results['errors'] == 0 else "FAILED"
    
    print(f"Before Implementation (repository_before):")
    print(f"  Overall: {before_status}")
    print(f"  Tests: {before_results['passed']}/{before_results['total']} passed")
    print()
    print(f"After Implementation (repository_after):")
    print(f"  Overall: {after_status}")
    print(f"  Tests: {after_results['passed']}/{after_results['total']} passed")
    
    # Expected behavior check
    print("\n" + "="*60)
    print("EXPECTED BEHAVIOR CHECK")
    print("="*60)
    
    after_ok = after_status == "PASSED"
    before_ok = before_status == "FAILED"
    
    if after_ok:
        print("[✓ OK] After implementation: All tests passed (expected)")
    else:
        print("[✗ FAIL] After implementation: Tests failed (unexpected)")
    
    if before_ok:
        print("[✓ OK] Before implementation: Tests failed (expected)")
    else:
        print("[✗ FAIL] Before implementation: Tests passed (unexpected)")
    
    # Save report
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    report_dir = Path(f"/app/evaluation/reports/{start_time.strftime('%Y-%m-%d')}/{start_time.strftime('%H-%M-%S')}")
    report_dir.mkdir(parents=True, exist_ok=True)
    
    report = {
        'run_id': run_id,
        'task_title': 'PostgreSQL Inventory Allocation Optimization',
        'start_time': start_iso,
        'end_time': end_time.isoformat() + 'Z',
        'duration_seconds': duration,
        'before_results': {
            'overall_status': before_status,
            'passed': before_results['passed'],
            'failed': before_results['failed'],
            'errors': before_results['errors'],
            'skipped': before_results['skipped'],
            'total': before_results['total'],
            'tests': before_results['test_results']
        },
        'after_results': {
            'overall_status': after_status,
            'passed': after_results['passed'],
            'failed': after_results['failed'],
            'errors': after_results['errors'],
            'skipped': after_results['skipped'],
            'total': after_results['total'],
            'tests': after_results['test_results']
        },
        'overall_status': 'SUCCESS' if after_ok and before_ok else 'FAILURE',
        'expected_behavior_validation': {
            'after_passed': after_ok,
            'before_failed': before_ok
        }
    }
    
    report_path = report_dir / 'report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nReport saved to:")
    print(f"{report_path}")
    
    print("\n" + "="*60)
    print("EVALUATION COMPLETE")
    print("="*60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if after_ok and before_ok else 'NO'}")


if __name__ == '__main__':
    main()
