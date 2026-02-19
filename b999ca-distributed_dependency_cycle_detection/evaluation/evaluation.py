#!/usr/bin/env python3
"""
Evaluation script for distributed dependency cycle detection.
Compares buggy (repository_before) vs fixed (repository_after) implementations.
"""

import sys
import os
import subprocess
import json
import time
import uuid
import platform
from datetime import datetime
from typing import Dict, Any, List

def run_tests(repo_path: str, test_name: str) -> Dict[str, Any]:
    """Run tests against a specific repository and return results"""
    
    print(f"\n{'='*60}")
    print(f"Running tests on {test_name}")
    print(f"Repository: {repo_path}")
    print(f"{'='*60}")
    
    # Set environment variable for test
    env = os.environ.copy()
    env['TEST_REPO_PATH'] = repo_path
    
    # Run pytest with detailed output
    cmd = [
        'python', '-m', 'pytest', 
        'tests/test_cycle_detection.py',
        '-v',
        '--tb=short',
        '--no-header'
    ]
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            cmd,
            cwd='/app',
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Parse test results
        output_lines = result.stdout.split('\n')
        
        # Count passed/failed tests and extract detailed test info
        tests = []
        passed_tests = []
        failed_tests = []
        seen_tests = set()  # Track seen tests to avoid duplicates
        
        for line in output_lines:
            # Look for test result lines with specific pattern
            if '::TestCycleDetection::test_' in line and ('PASSED' in line or 'FAILED' in line):
                # Extract test info: tests/test_cycle_detection.py::TestCycleDetection::test_name PASSED/FAILED
                parts = line.split('::TestCycleDetection::')
                if len(parts) >= 2:
                    test_name_part = parts[1].split(' ')[0]  # Get test_name from test_name PASSED/FAILED
                    
                    # Skip if we've already seen this test
                    if test_name_part in seen_tests:
                        continue
                    seen_tests.add(test_name_part)
                    
                    outcome = 'passed' if 'PASSED' in line else 'failed'
                    
                    # Create full nodeid
                    nodeid = f"tests/test_cycle_detection.py::TestCycleDetection::{test_name_part}"
                    
                    test_info = {
                        'nodeid': nodeid,
                        'name': test_name_part,
                        'outcome': outcome
                    }
                    tests.append(test_info)
                    
                    if outcome == 'passed':
                        passed_tests.append(test_name_part)
                    else:
                        failed_tests.append(test_name_part)
        
        # Extract summary line
        summary_line = ""
        for line in reversed(output_lines):
            if 'failed' in line or 'passed' in line:
                if '=' in line:
                    summary_line = line.strip()
                    break
        
        return {
            'success': result.returncode == 0,
            'exit_code': result.returncode,
            'execution_time': execution_time,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'tests': tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'summary': {
                'total': len(tests),
                'passed': len(passed_tests),
                'failed': len(failed_tests),
                'errors': 0,
                'skipped': 0
            },
            'summary_line': summary_line
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'exit_code': -1,
            'execution_time': 300,
            'stdout': '',
            'stderr': 'Test execution timed out after 5 minutes',
            'tests': [],
            'passed_tests': [],
            'failed_tests': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'errors': 0,
                'skipped': 0
            },
            'summary_line': 'TIMEOUT'
        }
    except Exception as e:
        return {
            'success': False,
            'exit_code': -1,
            'execution_time': 0,
            'stdout': '',
            'stderr': f'Error running tests: {str(e)}',
            'tests': [],
            'passed_tests': [],
            'failed_tests': [],
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'errors': 0,
                'skipped': 0
            },
            'summary_line': f'ERROR: {str(e)}'
        }

def analyze_implementation(repo_path: str) -> Dict[str, Any]:
    """Analyze implementation for key features"""
    
    cycle_detection_file = os.path.join(repo_path, 'cycle_detection.py')
    
    if not os.path.exists(cycle_detection_file):
        return {
            'file_exists': False,
            'has_multi_component_support': False,
            'has_global_visited_state': False,
            'has_component_restart': False,
            'complexity_analysis': 'File not found'
        }
    
    with open(cycle_detection_file, 'r') as f:
        content = f.read()
    
    # Analyze key features
    analysis = {
        'file_exists': True,
        'has_multi_component_support': 'for node_id in graph.nodes' in content and 'not in global_visited' in content,
        'has_global_visited_state': 'global_visited' in content,
        'has_component_restart': 'component_id' in content and 'START_COMPONENT' in content,
        'has_proper_dfs': 'dfs_detect_cycle' in content or 'dfs_recursive' in content,
        'maintains_complexity': 'O(V + E)' in content,
        'line_count': len(content.split('\n')),
        'has_disconnected_handling': 'disconnected_components' in content
    }
    
    # Determine if this is the buggy or fixed version
    if analysis['has_multi_component_support'] and analysis['has_global_visited_state']:
        analysis['implementation_type'] = 'FIXED'
        analysis['complexity_analysis'] = 'O(V + E) - visits each node and edge exactly once'
    else:
        analysis['implementation_type'] = 'BUGGY'
        analysis['complexity_analysis'] = 'O(V + E) for reachable nodes only - misses disconnected components'
    
    return analysis

def generate_report(before_results: Dict[str, Any], after_results: Dict[str, Any], 
                   before_analysis: Dict[str, Any], after_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Generate comprehensive evaluation report in the expected JSON format"""
    
    run_id = str(uuid.uuid4())[:8]
    started_at = datetime.now().isoformat()
    finished_at = datetime.now().isoformat()
    
    # Calculate duration
    duration_seconds = after_results['execution_time'] + before_results['execution_time']
    
    # Determine overall success
    expected_before_failures = [
        'test_component_restart_behavior',
        'test_disconnected_components_detection',
        'test_global_visited_state',
        'test_multiple_isolated_cycles',
        'test_self_loops',
        'test_space_complexity_requirement',
        'test_time_complexity_requirement',
        'test_visit_all_nodes_and_edges'
    ]
    
    expected_after_passes = [
        'test_disconnected_components_detection',
        'test_multiple_isolated_cycles',
        'test_time_complexity_requirement', 
        'test_space_complexity_requirement',
        'test_visit_all_nodes_and_edges',
        'test_component_restart_behavior',
        'test_global_visited_state',
        'test_no_probabilistic_behavior',
        'test_single_component_cycles',
        'test_self_loops',
        'test_backward_compatibility'
    ]
    
    # Check if before implementation fails as expected
    before_fails_correctly = all(
        test in before_results['failed_tests'] 
        for test in expected_before_failures
    )
    
    # Check if after implementation passes as expected
    after_passes_correctly = all(
        test in after_results['passed_tests']
        for test in expected_after_passes
    )
    
    overall_success = before_fails_correctly and after_passes_correctly
    
    # Get environment info
    environment = {
        'python_version': platform.python_version(),
        'platform': platform.platform(),
        'os': platform.system(),
        'os_release': platform.release(),
        'architecture': platform.machine(),
        'hostname': platform.node(),
        'git_commit': 'unknown',
        'git_branch': 'unknown'
    }
    
    report = {
        'run_id': run_id,
        'started_at': started_at,
        'finished_at': finished_at,
        'duration_seconds': duration_seconds,
        'success': overall_success,
        'error': None,
        'environment': environment,
        'results': {
            'before': {
                'success': before_results['success'],
                'exit_code': before_results['exit_code'],
                'tests': before_results['tests'],
                'summary': before_results['summary'],
                'stdout': before_results['stdout'],
                'stderr': before_results['stderr']
            },
            'after': {
                'success': after_results['success'],
                'exit_code': after_results['exit_code'],
                'tests': after_results['tests'],
                'summary': after_results['summary'],
                'stdout': after_results['stdout'],
                'stderr': after_results['stderr']
            },
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
        },
        'requirements_validation': {
            'time_complexity_o_v_plus_e': 'test_time_complexity_requirement' in after_results['passed_tests'],
            'space_complexity_o_v_plus_e': 'test_space_complexity_requirement' in after_results['passed_tests'],
            'visits_all_nodes_edges': 'test_visit_all_nodes_and_edges' in after_results['passed_tests'],
            'restarts_dfs_components': 'test_component_restart_behavior' in after_results['passed_tests'],
            'global_visited_state': 'test_global_visited_state' in after_results['passed_tests'],
            'deterministic_behavior': 'test_no_probabilistic_behavior' in after_results['passed_tests']
        }
    }
    
    return report

def save_report(report: Dict[str, Any]) -> str:
    """Save evaluation report to file"""
    
    # Create reports directory structure
    reports_dir = '/app/evaluation/reports'
    date_dir = datetime.now().strftime('%Y-%m-%d')
    time_dir = datetime.now().strftime('%H-%M-%S')
    
    full_dir = os.path.join(reports_dir, date_dir, time_dir)
    os.makedirs(full_dir, exist_ok=True)
    
    report_file = os.path.join(full_dir, 'report.json')
    
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    return report_file

def main():
    """Main evaluation function"""
    
    print("Distributed Dependency Cycle Detection - Evaluation")
    print("=" * 60)
    
    # Step 1: Analyze implementations
    print("\n[1/5] Analyzing implementations...")
    
    before_analysis = analyze_implementation('/app/repository_before')
    after_analysis = analyze_implementation('/app/repository_after')
    
    print(f"Before implementation: {before_analysis.get('implementation_type', 'UNKNOWN')}")
    print(f"After implementation: {after_analysis.get('implementation_type', 'UNKNOWN')}")
    
    # Step 2: Run tests on repository_before (should FAIL)
    print("\n[2/5] Testing repository_before (expected to FAIL)...")
    before_results = run_tests('/app/repository_before', 'repository_before')
    
    print(f"Before results: {before_results['summary']['passed']}/{before_results['summary']['total']} passed")
    if before_results['summary']['failed'] > 0:
        print(f"Failed tests: {', '.join(before_results['failed_tests'][:3])}{'...' if len(before_results['failed_tests']) > 3 else ''}")
    
    # Step 3: Run tests on repository_after (should PASS)
    print("\n[3/5] Testing repository_after (expected to PASS)...")
    after_results = run_tests('/app/repository_after', 'repository_after')
    
    print(f"After results: {after_results['summary']['passed']}/{after_results['summary']['total']} passed")
    if after_results['summary']['failed'] > 0:
        print(f"Failed tests: {', '.join(after_results['failed_tests'])}")
    
    # Step 4: Generate comprehensive report
    print("\n[4/5] Generating evaluation report...")
    report = generate_report(before_results, after_results, before_analysis, after_analysis)
    
    # Step 5: Save report
    print("\n[5/5] Saving report...")
    report_file = save_report(report)
    
    # Print summary
    print(f"\n{'='*60}")
    print("EVALUATION SUMMARY")
    print(f"{'='*60}")
    
    print(f"Overall Success: {report['success']}")
    print(f"Before Implementation: {before_analysis.get('implementation_type', 'UNKNOWN')}")
    print(f"After Implementation: {after_analysis.get('implementation_type', 'UNKNOWN')}")
    
    print(f"\nBefore (Buggy Implementation):")
    print(f"  - Tests Passed: {before_results['summary']['passed']}/{before_results['summary']['total']}")
    print(f"  - Tests Failed: {before_results['summary']['failed']}/{before_results['summary']['total']}")
    print(f"  - Disconnected Component Support: {before_analysis.get('has_multi_component_support', False)}")
    
    print(f"\nAfter (Fixed Implementation):")
    print(f"  - Tests Passed: {after_results['summary']['passed']}/{after_results['summary']['total']}")
    print(f"  - Tests Failed: {after_results['summary']['failed']}/{after_results['summary']['total']}")
    print(f"  - Disconnected Component Support: {after_analysis.get('has_multi_component_support', False)}")
    
    print(f"\nRequirements Validation:")
    for req, status in report['requirements_validation'].items():
        print(f"  - {req.replace('_', ' ').title()}: {'✓' if status else '✗'}")
    
    print(f"\nReport saved to: {report_file}")
    
    # Exit with appropriate code
    sys.exit(0 if report['success'] else 1)

if __name__ == '__main__':
    main()
