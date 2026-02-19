#!/usr/bin/env python3
"""
Evaluation runner for Async Circular Data Processing (score).

This evaluation script:
- Runs pytest tests on the tests/ folder for both before and after implementations
- Collects individual test results with pass/fail status
- Generates structured reports with environment metadata

Run with:
    docker compose run --rm app python evaluation/evaluation.py [options]
"""
import sys
import json
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"

def environment_info():
    """Collect environment metadata as requested."""
    info = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": "unknown",
        "git_branch": "unknown"
    }
    
    # Try to get git info if available
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        info["git_commit"] = commit
        info["git_branch"] = branch
    except Exception:
        pass
        
    return info

def print_header(title):
    print(f"\n{'=' * 60}")
    print(title)
    print(f"{'=' * 60}")

def parse_pytest_verbose_output(output):
    """
    Parse pytest verbose output to extract test results.
    Returns a list of dicts: {nodeid, name, outcome}
    """
    tests = []
    lines = output.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Split line by whitespace to find status
        parts = line.split()
        if len(parts) < 2:
            continue

        # Check for status keyword
        status = None
        status_index = -1
        
        # Valid statuses
        valid_statuses = {"PASSED", "FAILED", "SKIPPED", "ERROR", "XFAIL", "XPASS"}
        
        # Iterate backwards to find status 
        for i, part in enumerate(reversed(parts)):
            if part in valid_statuses:
                status = part.lower()
                status_index = len(parts) - 1 - i
                break
        
        if status:
             # Everything before status is the nodeid
            nodeid = " ".join(parts[:status_index])
            
            # It should look like a test path
            if nodeid.startswith("tests/"):
                # Extract name
                if "::" in nodeid:
                    name = nodeid.split("::")[-1]
                else:
                    # Fallback for file-level errors or flat output
                    name = nodeid.split("/")[-1]

                tests.append({
                    "nodeid": nodeid,
                    "name": name,
                    "outcome": status
                })
    
    return tests

def run_tests_with_reporting(repo_name: str, label: str):
    """
    Run pytest and return detailed result dict matching schema.
    """
    repo_path = ROOT / repo_name
    print_header(f"RUNNING TESTS: {label}")
    print(f"PYTHONPATH: {repo_path}")
    print(f"Tests directory: {ROOT / 'tests'}")
    
    # We pass the repo path as PYTHONPATH
    env = sys.modules['os'].environ.copy()
    existing_path = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = str(repo_path) + (f"{sys.modules['os'].pathsep}{existing_path}" if existing_path else "")
    
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests", "-v", "--no-header", "--color=no"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            env=env,
            timeout=120
        )
        
        stdout = proc.stdout
        stderr = proc.stderr
        output = stdout + stderr
        
        # Parse results
        tests = parse_pytest_verbose_output(output)
        
        passed_count = sum(1 for t in tests if t['outcome'] == 'passed')
        failed_count = sum(1 for t in tests if t['outcome'] == 'failed')
        error_count = sum(1 for t in tests if t['outcome'] == 'error')
        skipped_count = sum(1 for t in tests if t['outcome'] == 'skipped')
        total_count = len(tests)
        
        # If parsing failed but we have output, maybe something went wrong with the pattern matching.
        # Print raw output to help debug if running interactively or ensure it's in the log.
        if total_count == 0 and len(output) > 0:
            print("WARNING: No tests parsed from pytest output. Raw output start:")
            print(output[:500])
            print("...")
        
        # Print to stdout as requested
        print(f"\nResults: {passed_count} passed, {failed_count} failed, {error_count} errors, {skipped_count} skipped (total: {total_count})")
        
        for test in tests:
            icon = "✅" if test['outcome'] == 'passed' else "❌" if test['outcome'] == 'failed' else "❓"
            print(f"  {icon} {test['nodeid']}: {test['outcome']}")
        
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "tests": tests,
            "summary": {
                "total": total_count,
                "passed": passed_count,
                "failed": failed_count,
                "errors": error_count,
                "skipped": skipped_count
            },
            "stdout": stdout,
            "stderr": stderr
        }
    except subprocess.TimeoutExpired:
        print("\n\n❌ TIMEOUT")
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
            "stdout": "pytest timeout",
            "stderr": ""
        }

def run_evaluation():
    run_id = str(uuid.uuid4())[:8]
    start = datetime.utcnow()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {start.isoformat()}Z")
    
    print_header("ASNYC CIRCULAR DATA PROCESSING EVALUATION")
    
    before_label = "BEFORE (REPOSITORY_BEFORE)"
    before_result = run_tests_with_reporting("repository_before", before_label)
    
    after_label = "AFTER (REPOSITORY_AFTER)"
    after_result = run_tests_with_reporting("repository_after", after_label)
    
    end = datetime.utcnow()
    duration = (end - start).total_seconds()
    
    # Comparison Logic
    comparison = {
        "before_tests_passed": before_result["success"],
        "after_tests_passed": after_result["success"],
        "before_total": before_result["summary"]["total"],
        "before_passed": before_result["summary"]["passed"],
        "before_failed": before_result["summary"]["failed"],
        "after_total": after_result["summary"]["total"],
        "after_passed": after_result["summary"]["passed"],
        "after_failed": after_result["summary"]["failed"]
    }
    
    # Success definition is After must pass
    success = after_result["success"]
    
    # Print Summary to Stdout
    print_header("EVALUATION SUMMARY")
    print(f"\nBefore Implementation (repository_before):")
    print(f"  Overall: {'✅ PASSED' if before_result['success'] else '❌ FAILED'}")
    print(f"  Tests: {before_result['summary']['passed']}/{before_result['summary']['total']} passed")

    print(f"\nAfter Implementation (repository_after):")
    print(f"  Overall: {'✅ PASSED' if after_result['success'] else '❌ FAILED'}")
    print(f"  Tests: {after_result['summary']['passed']}/{after_result['summary']['total']} passed")
    
    print_header("EXPECTED BEHAVIOR CHECK")
    if success:
        print("✅ After implementation: All tests passed (expected)")
    else:
        print("❌ After implementation: Some tests failed")

    # Construct final report
    report = {
        "run_id": run_id,
        "started_at": start.isoformat(),
        "finished_at": end.isoformat(),
        "duration_seconds": duration,
        "success": success,
        "error": None,
        "environment": environment_info(),
        "results": {
            "before": before_result,
            "after": after_result,
            "comparison": comparison
        }
    }
    
    return report

def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    report = run_evaluation()
    
    # Generate path based on date/time structure
    now = datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    path = REPORTS.parent / date_str / time_str / "report.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    
    path.write_text(json.dumps(report, indent=2))
    print(f"\n✅ Report saved to: {path}")
    
    print_header("EVALUATION COMPLETE")
    print(f"Run ID: {report['run_id']}")
    print(f"Duration: {report['duration_seconds']:.2f}s")
    print(f"Success: {'✅ YES' if report['success'] else '❌ NO'}")
    
    return 0 if report["success"] else 1

if __name__ == "__main__":
    sys.exit(main())
