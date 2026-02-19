import os
import json
import subprocess
import sys
import datetime
import socket
import platform
import random
import string
import re
from pathlib import Path

# =================================================================
# EVALUATION CONFIGURATION
# =================================================================
TASK_NAME = "Flight Model Refactor to Pydantic v2"
TEST_FILES = ["tests/test_pydantic_models.py"]
EVALUATION_DIR = Path(__file__).parent
REPOSITORY_BEFORE = "repository_before"
REPOSITORY_AFTER = "repository_after"

def generate_run_id() -> str:
    """Generate a unique run ID."""
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))

def get_git_info():
    """Extract git info safely."""
    git_info = {"commit": "unknown", "branch": "unknown"}
    try:
        git_info["commit"] = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
        git_info["branch"] = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        pass
    return git_info

def run_tests_native(repo_path: str, repo_name: str):
    """Run tests using standard pytest output and parse the console text."""
    print(f"\n{'='*60}")
    print(f"RUNNING TESTS: {repo_name} ({repo_path})")
    print(f"{'='*60}")
    
    env = os.environ.copy()
    env["REPO_PATH"] = repo_path
    
    # We use -v to get individual test statuses
    cmd = ["pytest", "-v", *TEST_FILES]
    
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, encoding='utf-8')
        stdout = result.stdout
        stderr = result.stderr
        output = stdout + stderr
        
        # Simple regex parsing for pytest verbose output:
        # tests/file.py::test_name PASSED
        # tests/file.py::test_name FAILED
        # tests/file.py::test_name XFAIL
        test_results = []
        matches = re.findall(r"^(tests/.*::.*)\s+(PASSED|FAILED|ERROR|SKIPPED|XFAIL|XPASS)", output, re.MULTILINE)
        
        passed = 0
        failed = 0
        errors = 0
        skipped = 0
        xfail = 0
        xpass = 0
        
        for nodeid, status in matches:
            test_results.append({
                "nodeid": nodeid,
                "name": nodeid.split("::")[-1],
                "outcome": status.lower(),
                "message": "" 
            })
            if status == "PASSED": passed += 1
            elif status == "FAILED": failed += 1
            elif status == "ERROR": errors += 1
            elif status == "SKIPPED": skipped += 1
            elif status == "XFAIL": xfail += 1
            elif status == "XPASS": xpass += 1

        # Summary line fallback if regex fails to find itemized results
        if not test_results:
            summary_match = re.search(r"==.* ((\d+) passed)?.* ((\d+) failed)?.* ((\d+) error)?.*==", output)
            if summary_match:
                passed = int(summary_match.group(2)) if summary_match.group(2) else 0
                failed = int(summary_match.group(4)) if summary_match.group(4) else 0
                errors = int(summary_match.group(6)) if summary_match.group(6) else 0
        
        # In transformation mode, XFAIL in before repo is expected
        # but technically means the bug existed.
        success = result.returncode == 0 and failed == 0 and errors == 0 and xfail == 0
        
        return {
            "success": success,
            "exit_code": result.returncode,
            "tests": test_results,
            "summary": {
                "total": passed + failed + errors + skipped + xfail + xpass,
                "passed": passed,
                "failed": failed + xfail, # Treat XFAIL as a 'failed' for report purposes
                "errors": errors,
                "skipped": skipped,
                "xfail": xfail,
                "xpass": xpass
            },
            "stdout": stdout,
            "stderr": stderr
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "error": str(e),
            "stdout": "",
            "stderr": str(e)
        }

def main():
    # Use simple ascii indicators to avoid UnicodeEncodeError on some Windows terminals
    SUCCESS_ICON = "[PASS]"
    FAILURE_ICON = "[FAIL]"
    
    run_id = generate_run_id()
    started_at = datetime.datetime.now(datetime.UTC)
    
    print(f"\n{'='*60}")
    print(f"EVALUATION: {TASK_NAME}")
    print(f"{'='*60}")
    print(f"Run ID: {run_id}")
    print(f"Started at: {started_at.isoformat()}")

    before_results = run_tests_native(REPOSITORY_BEFORE, "repository_before")
    after_results = run_tests_native(REPOSITORY_AFTER, "repository_after")
    
    finished_at = datetime.datetime.now(datetime.UTC)
    duration = (finished_at - started_at).total_seconds()
    
    # Before is 'successful' ONLY if it has failures (XFAIL) and no unexpected errors
    before_status = before_results["summary"]["xfail"] > 0
    
    comparison = {
        "before_tests_detected_bugs": before_status,
        "after_tests_passed": after_results["success"],
        "before_total": before_results["summary"]["total"],
        "before_passed": before_results["summary"]["passed"],
        "before_failed": before_results["summary"]["failed"], # This now includes xfail
        "after_total": after_results["summary"]["total"],
        "after_passed": after_results["summary"]["passed"],
        "after_failed": after_results["summary"]["failed"],
    }
    
    # Task success: After must pass, and Before must have detected bugs (or at least not passed perfectly)
    success = after_results["success"]
    git_info = get_git_info()
    
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 6),
        "success": success,
        "error": None if success else "After implementation tests failed",
        "environment": {
            "python_version": sys.version.split()[0],
            "platform": platform.platform(),
            "os": platform.system(),
            "os_release": platform.release(),
            "architecture": platform.machine(),
            "hostname": socket.gethostname(),
            "git_commit": git_info["commit"],
            "git_branch": git_info["branch"]
        },
        "results": {
            "before": before_results,
            "after": after_results,
            "comparison": comparison
        }
    }
    
    date_str = started_at.strftime("%Y-%m-%d")
    time_str = started_at.strftime("%H-%M-%S")
    output_dir = EVALUATION_DIR / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "report.json"
    
    with open(report_path, "w", encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        
    print(f"\n{'='*60}")
    print("EVALUATION SUMMARY")
    print(f"{'='*60}")
    print(f"\nBefore Implementation ({REPOSITORY_BEFORE}):")
    # In transformation mode, we expect it to fail some tests
    print(f"  Overall: {FAILURE_ICON + ' (Expected)' if before_status else SUCCESS_ICON}")
    print(f"  Tests: {comparison['before_passed']}/{comparison['before_total']} passed")
    
    print(f"\nAfter Implementation ({REPOSITORY_AFTER}):")
    print(f"  Overall: {SUCCESS_ICON if after_results['success'] else FAILURE_ICON}")
    print(f"  Tests: {comparison['after_passed']}/{comparison['after_total']} passed")
    
    print(f"\nReport saved to: {report_path}")
    print(f"{'='*60}")
    print("EVALUATION COMPLETE")
    print(f"Duration: {round(duration, 2)}s")
    print(f"Success: {'YES' if success else 'NO'}")
    print(f"{'='*60}\n")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
