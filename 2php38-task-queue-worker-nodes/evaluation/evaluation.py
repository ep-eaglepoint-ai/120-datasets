"""Evaluation runner for the distributed task queue system."""
import json
import os
import platform
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path


def get_environment_info():
    """Get environment information."""
    return {
        "python_version": platform.python_version(),
        "platform": f"{platform.system().lower()}-{platform.machine()}",
    }


def run_tests(env_path: str):
    """Run pytest and collect results."""
    env = os.environ.copy()
    env["PYTHONPATH"] = f"{env_path}:{env.get('PYTHONPATH', '')}"
    
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short", "-q"],
        capture_output=True,
        text=True,
        env=env,
        cwd="/app" if os.path.exists("/app") else os.getcwd(),
    )
    
    return parse_pytest_output(result.stdout, result.stderr, result.returncode)


def parse_pytest_output(stdout: str, stderr: str, returncode: int):
    """Parse pytest output to extract test results."""
    import re
    
    full_output = stdout + "\n" + stderr
    
    passed = 0
    failed = 0
    errors = 0
    
    summary_match = re.search(r"(\d+)\s+passed", full_output)
    if summary_match:
        passed = int(summary_match.group(1))
    
    failed_match = re.search(r"(\d+)\s+failed", full_output)
    if failed_match:
        failed = int(failed_match.group(1))
    
    error_match = re.search(r"(\d+)\s+error", full_output)
    if error_match:
        errors = int(error_match.group(1))
    
    # Truncate output to 8000 chars
    if len(full_output) > 8000:
        full_output = full_output[:8000] + "\n... [truncated]"
    
    return {
        "passed": returncode == 0 and failed == 0 and errors == 0,
        "return_code": returncode,
        "output": full_output,
        "tests_passed": passed,
        "tests_failed": failed + errors,
    }


def main():
    """Main evaluation entry point."""
    run_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    print()
    print("=" * 60)
    print("DISTRIBUTED TASK QUEUE EVALUATION")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Started at: {start_time.isoformat()}")
    print()
    
    print("=" * 60)
    print("RUNNING TESTS: repository_before")
    print("=" * 60)
    
    # Before results - no implementation (creation task)
    before_results = {
        "passed": False,
        "return_code": 1,
        "output": "No implementation (CREATION task)",
    }
    print("Skipping repository_before as it contains no implementation code (CREATION mode).")
    print()
    
    print("=" * 60)
    print("RUNNING TESTS: repository_after")
    print("=" * 60)
    
    base_path = "/app" if os.path.exists("/app") else os.getcwd()
    after_path = os.path.join(base_path, "repository_after")
    
    after_results = run_tests(after_path)
    
    print(f"Tests: {after_results.get('tests_passed', 0)} passed, {after_results.get('tests_failed', 0)} failed")
    print()
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    # Success rule: after.tests.passed == true
    success = after_results["passed"]
    
    if success:
        improvement_summary = "Creation successful: all tests pass."
    else:
        improvement_summary = "Creation incomplete: tests still failing."
    
    print("=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print()
    print("Before Implementation (repository_before):")
    print(f"  Overall: FAILED/SKIPPED")
    print(f"  Output: {before_results['output']}")
    print()
    print("After Implementation (repository_after):")
    print(f"  Overall: {'PASSED' if success else 'FAILED'}")
    print(f"  Tests: {after_results.get('tests_passed', 0)} passed, {after_results.get('tests_failed', 0)} failed")
    print()
    
    # Build report following canonical schema
    report = {
        "run_id": run_id,
        "started_at": start_time.isoformat() + "Z",
        "finished_at": end_time.isoformat() + "Z",
        "duration_seconds": round(duration, 3),
        "environment": get_environment_info(),
        "before": {
            "tests": {
                "passed": before_results["passed"],
                "return_code": before_results["return_code"],
                "output": before_results["output"],
            },
            "metrics": {},
        },
        "after": {
            "tests": {
                "passed": after_results["passed"],
                "return_code": after_results["return_code"],
                "output": after_results["output"],
            },
            "metrics": {},
        },
        "comparison": {
            "passed_gate": success,
            "improvement_summary": improvement_summary,
        },
        "success": success,
        "error": None if success else "After implementation tests failed",
    }
    
    # Save reports
    now = datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    
    report_dir = Path("evaluation/reports") / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    
    report_path = report_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    # Also save to latest.json
    latest_path = Path("evaluation/reports/latest.json")
    with open(latest_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"Report saved to: {report_path}")
    print(f"Latest saved to: {latest_path}")
    print()
    print("=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if success else 'NO'}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
