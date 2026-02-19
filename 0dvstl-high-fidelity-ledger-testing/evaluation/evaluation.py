import subprocess
import sys
import json
import os
from datetime import datetime
import uuid
import re


def run_command(cmd, cwd=None):
    """Run a command and capture output."""
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    return result


def parse_pytest_output(output):
    """Parse pytest output to extract test results."""
    tests = []
    passed = failed = errors = skipped = 0
    
    # Extract individual test results
    for line in output.split('\n'):
        if '::test_' in line or 'PASSED' in line or 'FAILED' in line:
            if 'PASSED' in line:
                test_name = line.split('::')[-1].split(' ')[0] if '::' in line else line.split()[0]
                tests.append({"name": test_name, "status": "PASS"})
                passed += 1
            elif 'FAILED' in line:
                test_name = line.split('::')[-1].split(' ')[0] if '::' in line else line.split()[0]
                tests.append({"name": test_name, "status": "FAIL"})
                failed += 1
    
    # Try to extract summary line
    summary_match = re.search(r'(\d+) passed', output)
    if summary_match and passed == 0:
        passed = int(summary_match.group(1))
    
    return {
        "tests": tests,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
        "total": passed + failed + errors + skipped
    }


def run_primary_tests():
    """Run primary tests in repository_after."""
    print("=" * 60)
    print("RUNNING PRIMARY TESTS")
    print("=" * 60)
    print("Test location: repository_after")
    print()
    
    result = run_command([sys.executable, "-m", "pytest", "repository_after/test_ledger_processor.py", "-v"])
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    
    test_results = parse_pytest_output(result.stdout)
    
    print()
    print(f"Results: {test_results['passed']} passed, {test_results['failed']} failed, "
          f"{test_results['errors']} errors, {test_results['skipped']} skipped "
          f"(total: {test_results['total']})")
    
    for test in test_results['tests']:
        symbol = "✓" if test['status'] == "PASS" else "✗"
        status = "PASS" if test['status'] == "PASS" else "FAIL"
        print(f"  [{symbol} {status}] {test['name']}")
    
    return test_results


def run_meta_tests():
    """Run meta-tests in tests/ directory."""
    print()
    print("=" * 60)
    print("RUNNING META-TESTS")
    print("=" * 60)
    print("Meta-tests directory: /app/tests")
    print()
    
    result = run_command([sys.executable, "-m", "pytest", "tests/test_meta_validation.py", "-v"])
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    
    test_results = parse_pytest_output(result.stdout)
    
    print()
    print(f"Results: {test_results['passed']} passed, {test_results['failed']} failed, "
          f"{test_results['errors']} errors, {test_results['skipped']} skipped "
          f"(total: {test_results['total']})")
    
    for test in test_results['tests']:
        symbol = "✓" if test['status'] == "PASS" else "✗"
        status = "PASS" if test['status'] == "PASS" else "FAIL"
        print(f"  [{symbol} {status}] {test['name']}")
    
    return test_results


def save_report(run_id, start_time, end_time, primary_results, meta_results):
    """Save evaluation report as JSON."""
    duration = (end_time - start_time).total_seconds()
    
    report = {
        "run_id": run_id,
        "task_title": "High-Fidelity Ledger Testing",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": duration,
        "primary_test_results": {
            "total": primary_results['total'],
            "passed": primary_results['passed'],
            "failed": primary_results['failed'],
            "errors": primary_results['errors'],
            "skipped": primary_results['skipped'],
            "tests": [{"id": t['name'], "status": t['status']} for t in primary_results['tests']]
        },
        "meta_test_results": {
            "total": meta_results['total'],
            "passed": meta_results['passed'],
            "failed": meta_results['failed'],
            "errors": meta_results['errors'],
            "skipped": meta_results['skipped'],
            "tests": [{"id": t['name'], "status": t['status']} for t in meta_results['tests']]
        },
        "overall_status": "PASSED" if (primary_results['failed'] == 0 and meta_results['failed'] == 0) else "FAILED",
        "execution_environment": {
            "python_version": sys.version,
            "platform": sys.platform
        }
    }
    
    # Create reports directory
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports", date_str, time_str)
    os.makedirs(report_dir, exist_ok=True)
    
    report_path = os.path.join(report_dir, "report.json")
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    return report_path


def main():
    """Main evaluation runner."""
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}Z")
    print()
    
    print("=" * 60)
    print("HIGH-FIDELITY LEDGER TESTING EVALUATION")
    print("=" * 60)
    print()
    
    # Run primary tests
    primary_results = run_primary_tests()
    
    # Run meta-tests
    meta_results = run_meta_tests()
    
    # Summary
    print()
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    print("Primary Tests:")
    print(f"  Overall: {'PASSED' if primary_results['failed'] == 0 else 'FAILED'}")
    print(f"  Tests: {primary_results['passed']}/{primary_results['total']} passed")
    print()
    print("Meta-Tests:")
    print(f"  Overall: {'PASSED' if meta_results['failed'] == 0 else 'FAILED'}")
    print(f"  Tests: {meta_results['passed']}/{meta_results['total']} passed")
    print()
    
    # Expected behavior check
    print("=" * 60)
    print("EXPECTED BEHAVIOR CHECK")
    print("=" * 60)
    primary_ok = primary_results['failed'] == 0
    meta_ok = meta_results['failed'] == 0
    print(f"[{'✓' if primary_ok else '✗'} {'OK' if primary_ok else 'FAIL'}] Primary tests passed")
    print(f"[{'✓' if meta_ok else '✗'} {'OK' if meta_ok else 'FAIL'}] Meta-tests passed")
    print()
    
    # Save report
    end_time = datetime.utcnow()
    report_path = save_report(run_id, start_time, end_time, primary_results, meta_results)
    
    print(f"Report saved to:")
    print(f"{report_path}")
    print()
    
    # Final summary
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {(end_time - start_time).total_seconds():.2f}s")
    print(f"Success: {'YES' if (primary_ok and meta_ok) else 'NO'}")
    print()


if __name__ == "__main__":
    main()
