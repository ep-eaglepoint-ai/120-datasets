import os
import sys
import json
import uuid
import platform
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

# --- Helper functions (Enhanced with Git and OS info) ---

def generate_run_id():
    return uuid.uuid4().hex[:8]

def get_git_info():
    """Get git commit and branch information."""
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]

        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            git_info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    return git_info

def get_environment_info():
    git = get_git_info()
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }

def generate_output_path():
    """Generate output path in format: evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json"""
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")

    project_root = Path(__file__).parent.parent
    output_dir = project_root / "evaluation" / "reports" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)

    return output_dir / "report.json"

def parse_pytest_verbose_output(output):
    """Parse pytest verbose output to extract individual test results."""
    tests = []
    lines = output.split('\n')
    for line in lines:
        line = line.strip()
        if '::' in line:
            outcome = None
            if ' PASSED' in line: outcome = "passed"
            elif ' FAILED' in line: outcome = "failed"
            elif ' ERROR' in line: outcome = "error"
            elif ' SKIPPED' in line: outcome = "skipped"

            if outcome:
                nodeid = line.split(' ')[0]
                tests.append({
                    "nodeid": nodeid,
                    "name": nodeid.split("::")[-1],
                    "outcome": outcome,
                })
    return tests

def run_evaluation_tests(tests_dir):
    """Runs pytest and returns the structured data you requested."""
    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        stdout = result.stdout
        stderr = result.stderr

        tests = parse_pytest_verbose_output(stdout)

        summary = {
            "total": len(tests),
            "passed": sum(1 for t in tests if t["outcome"] == "passed"),
            "failed": sum(1 for t in tests if t["outcome"] == "failed"),
            "errors": sum(1 for t in tests if t["outcome"] == "error"),
            "skipped": sum(1 for t in tests if t["outcome"] == "skipped"),
        }

        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "tests": tests,
            "summary": summary,
            "stdout": stdout,
            "stderr": stderr
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e)
        }

# --- Main Evaluation Logic ---

def main():
    parser = argparse.ArgumentParser(description="Run evaluation")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    args = parser.parse_args()

    # 1. Metadata
    run_id = generate_run_id()
    started_at = datetime.now()

    # 2. Paths
    project_root = Path(__file__).parent.parent
    tests_dir = project_root / "tests"

    # 3. Run Tests
    detailed_results = run_evaluation_tests(tests_dir)

    # 4. Finalize Timing
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()

    # 5. Construct the specific JSON format
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 4),
        "environment": get_environment_info(),
        "before": None,
        "after": detailed_results,
        "comparison": {
            "passed_gate": detailed_results["success"],
            "improvement_summary": "Evaluated implementation against provided test suite."
        },
        "success": detailed_results["success"],
        "error": None if detailed_results["success"] else "Tests failed in the 'after' implementation."
    }

    # 6. Save Report
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n✅ Report saved to: {output_path}")
    print(f"Summary: {detailed_results['summary']['passed']}/{detailed_results['summary']['total']} passed")

    sys.exit(0 if detailed_results["success"] else 1)

if __name__ == "__main__":
    main()