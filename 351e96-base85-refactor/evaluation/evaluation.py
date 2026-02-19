#!/usr/bin/env python3
"""
ASCII85 Refactor Evaluation Script

Evaluates the refactoring task by running tests on both repository_before and repository_after,
then generates a comprehensive report in the expected JSON format.
"""

import json
import os
import platform
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path


def run_tests(test_env):
    """Run pytest and capture detailed results"""
    env = os.environ.copy()
    if test_env == "before":
        env["PYTHONPATH"] = "/app/repository_before"
        cmd = ["pytest", "-v", "tests/test_equivalence.py", "tests/test_structure.py::test_helper_functions_exist", "tests/test_structure.py::test_iterative_base_conversion", "tests/test_structure.py::test_precomputed_powers", "tests/test_structure.py::test_struct_module_usage", "tests/test_structure.py::test_input_validation", "tests/test_structure.py::test_efficient_chunking", "tests/test_structure.py::test_reduced_string_operations", "tests/test_performance.py::test_encode_performance_improvement", "tests/test_performance.py::test_decode_performance_improvement", "tests/test_performance.py::test_memory_efficiency", "tests/test_performance.py::test_no_stack_overflow"]
    else:
        env["PYTHONPATH"] = "/app/repository_after"
        cmd = ["pytest", "-v", "tests"]
    
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    # Parse test results from verbose output
    tests = []
    lines = result.stdout.split('\n')
    
    for line in lines:
        if "::" in line and any(status in line for status in ["PASSED", "FAILED", "SKIPPED"]):
            # Parse lines like "tests/test_equivalence.py::test_basic_functionality PASSED"
            parts = line.split()
            if len(parts) >= 2:
                nodeid = parts[0]
                if "PASSED" in line:
                    outcome = "passed"
                elif "FAILED" in line:
                    outcome = "failed"
                elif "SKIPPED" in line:
                    outcome = "skipped"
                else:
                    continue
                
                tests.append({
                    "nodeid": nodeid,
                    "name": nodeid.split("::")[-1],
                    "outcome": outcome
                })
    
    # If no tests parsed from verbose output, parse from summary
    if not tests:
        for line in lines:
            if "passed" in line or "failed" in line:
                # Extract test counts from summary line
                import re
                # Look for patterns like "13 passed, 1 failed"
                passed_match = re.search(r'(\d+)\s+passed', line)
                failed_match = re.search(r'(\d+)\s+failed', line)
                
                passed_count = int(passed_match.group(1)) if passed_match else 0
                failed_count = int(failed_match.group(1)) if failed_match else 0
                
                # Create dummy test entries based on counts
                for i in range(passed_count):
                    tests.append({
                        "nodeid": f"test_passed_{i}",
                        "name": f"test_passed_{i}",
                        "outcome": "passed"
                    })
                for i in range(failed_count):
                    tests.append({
                        "nodeid": f"test_failed_{i}",
                        "name": f"test_failed_{i}",
                        "outcome": "failed"
                    })
                break
    
    # Calculate summary
    total = len(tests)
    passed = sum(1 for t in tests if t["outcome"] == "passed")
    failed = sum(1 for t in tests if t["outcome"] == "failed")
    errors = sum(1 for t in tests if t["outcome"] == "error")
    skipped = sum(1 for t in tests if t["outcome"] == "skipped")
    
    return {
        "success": result.returncode == 0,
        "exit_code": result.returncode,
        "tests": tests,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "skipped": skipped
        },
        "stdout": result.stdout,
        "stderr": result.stderr
    }


def get_environment_info():
    """Get environment information"""
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": "unknown",
        "git_branch": "unknown"
    }


def main():
    """Main evaluation function"""
    start_time = datetime.now()
    run_id = str(uuid.uuid4())[:8]
    
    print("Starting ASCII85 refactor evaluation...")
    
    # Run tests on repository_before
    print("Running tests on repository_before...")
    before_results = run_tests("before")
    
    # Run tests on repository_after  
    print("Running tests on repository_after...")
    after_results = run_tests("after")
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # Create evaluation report
    report = {
        "run_id": run_id,
        "started_at": start_time.isoformat(),
        "finished_at": end_time.isoformat(),
        "duration_seconds": round(duration, 5),
        "success": before_results["success"] == False and after_results["success"] == True,
        "error": None,
        "environment": get_environment_info(),
        "results": {
            "before": before_results,
            "after": after_results,
            "comparison": {
                "before_tests_passed": before_results["success"],
                "after_tests_passed": after_results["success"],
                "before_total": before_results["summary"]["total"],
                "before_passed": before_results["summary"]["passed"],
                "before_failed": before_results["summary"]["failed"],
                "after_total": after_results["summary"]["total"],
                "after_passed": after_results["summary"]["passed"],
                "after_failed": after_results["summary"]["failed"]
            }
        }
    }
    
    # Create reports directory with timestamp
    timestamp = start_time.strftime("%Y-%m-%d/%H-%M-%S")
    reports_dir = Path(f"/app/evaluation/reports/{timestamp}")
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    # Save report
    report_file = reports_dir / "report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"Evaluation completed in {duration:.2f}s")
    print(f"Report saved to: {report_file}")
    print(f"Overall success: {report['success']}")
    
    # Print summary
    print("\nSummary:")
    print(f"Before tests: {before_results['summary']['passed']}/{before_results['summary']['total']} passed")
    print(f"After tests: {after_results['summary']['passed']}/{after_results['summary']['total']} passed")
    
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())