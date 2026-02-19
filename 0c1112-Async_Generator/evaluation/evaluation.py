#!/usr/bin/env python3

"""
Evaluation script for async_generator project.
Runs tests on both repository_before and repository_after and generates comparison report.
"""

import subprocess
import json
import os
import sys
import platform
from datetime import datetime
from pathlib import Path
import uuid
import re


def generate_run_id():
    """Generate unique run ID"""
    return str(uuid.uuid4())[:8]


def get_timestamp():
    """Get current timestamp in ISO format"""
    return datetime.utcnow().isoformat() + 'Z'


def create_report_dir():
    """Create report directory with date/time structure"""
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H-%M-%S')
    report_dir = Path(__file__).parent / 'reports' / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    return report_dir


def run_tests(pythonpath, label):
    """Run tests and capture detailed results"""
    print(f"\n{'='*60}")
    print(f"Running tests on {label}...")
    print('='*60)
    
    env = os.environ.copy()
    env['PYTHONPATH'] = pythonpath
    
    try:
        result = subprocess.run(
            ['pytest', 'tests/test_async_generator.py', '-v', '--tb=short'],
            capture_output=True,
            text=True,
            timeout=60,
            env=env
        )
        
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        
        # Parse test results from verbose output
        tests = []
        lines = result.stdout.split('\n')
        
        # Only parse lines before the FAILURES or short test summary section
        in_test_section = False
        for line in lines:
            # Start parsing after "collected X items"
            if "collected" in line and "items" in line:
                in_test_section = True
                continue
            
            # Stop parsing at FAILURES or short test summary
            if "===" in line and ("FAILURES" in line or "short test summary" in line):
                break
            
            if in_test_section and "::" in line and any(status in line for status in ["PASSED", "FAILED", "SKIPPED", "ERROR"]):
                # Parse lines like "tests/test_async_generator.py::test_generator_exists PASSED"
                parts = line.split()
                if len(parts) >= 2:
                    nodeid = parts[0]
                    # Skip if nodeid doesn't contain the test file path
                    if "test_async_generator.py::" not in nodeid:
                        continue
                    
                    if "PASSED" in line:
                        outcome = "passed"
                    elif "FAILED" in line:
                        outcome = "failed"
                    elif "SKIPPED" in line:
                        outcome = "skipped"
                    elif "ERROR" in line:
                        outcome = "error"
                    else:
                        continue
                    
                    tests.append({
                        "nodeid": nodeid,
                        "name": nodeid.split("::")[-1],
                        "outcome": outcome
                    })
        
        # Calculate summary
        total = len(tests)
        passed = sum(1 for t in tests if t["outcome"] == "passed")
        failed = sum(1 for t in tests if t["outcome"] == "failed")
        errors = sum(1 for t in tests if t["outcome"] == "error")
        skipped = sum(1 for t in tests if t["outcome"] == "skipped")
        
        return {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'tests': tests,
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'errors': errors,
                'skipped': skipped
            },
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'exit_code': -1,
            'tests': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'errors': 0,
                'skipped': 0
            },
            'stdout': '',
            'stderr': 'Test execution timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'exit_code': -1,
            'tests': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'errors': 0,
                'skipped': 0
            },
            'stdout': '',
            'stderr': str(e)
        }


def get_environment_info():
    """Get environment information"""
    return {
        'python_version': platform.python_version(),
        'platform': platform.platform(),
        'os': platform.system(),
        'os_release': platform.release(),
        'architecture': platform.machine(),
        'hostname': platform.node(),
        'git_commit': 'unknown',
        'git_branch': 'unknown'
    }


def main():
    """Main evaluation function"""
    run_id = generate_run_id()
    start_time = datetime.now()
    
    print('Starting async_generator evaluation...')
    print(f'Run ID: {run_id}')
    print(f'Started at: {start_time.isoformat()}')
    
    # Run tests on repository_before
    before_results = run_tests('/app/repository_before', 'repository_before')
    
    # Run tests on repository_after
    after_results = run_tests('/app/repository_after', 'repository_after')
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # Determine overall success
    # Before should have some tests failing (no dependency injection support)
    # After should have all tests passing
    overall_success = (
        not before_results['success'] and 
        after_results['success'] and 
        after_results['summary']['passed'] > before_results['summary']['passed']
    )
    
    # Create report
    report = {
        'run_id': run_id,
        'started_at': start_time.isoformat(),
        'finished_at': end_time.isoformat(),
        'duration_seconds': round(duration, 5),
        'success': overall_success,
        'error': None,
        'environment': get_environment_info(),
        'results': {
            'before': before_results,
            'after': after_results,
            'comparison': {
                'before_tests_passed': before_results['success'],
                'after_tests_passed': after_results['success'],
                'before_total': before_results['summary']['total'],
                'before_passed': before_results['summary']['passed'],
                'before_failed': before_results['summary']['failed'],
                'after_total': after_results['summary']['total'],
                'after_passed': after_results['summary']['passed'],
                'after_failed': after_results['summary']['failed']
            }
        }
    }
    
    # Save report
    report_dir = create_report_dir()
    report_path = report_dir / 'report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print('\n' + '='*60)
    print('EVALUATION SUMMARY')
    print('='*60)
    print(f'Run ID: {run_id}')
    print(f'Duration: {duration:.2f}s')
    print(f'Report saved to: {report_path}')
    print(f'Overall success: {overall_success}')
    print('')
    print('Summary:')
    print(f'  Before tests: {before_results["summary"]["passed"]}/{before_results["summary"]["total"]} passed')
    print(f'  After tests: {after_results["summary"]["passed"]}/{after_results["summary"]["total"]} passed')
    print('='*60)
    
    # Exit with appropriate code
    sys.exit(0 if overall_success else 1)


if __name__ == '__main__':
    main()
