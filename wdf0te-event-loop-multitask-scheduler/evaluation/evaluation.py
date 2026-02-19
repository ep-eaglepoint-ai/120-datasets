import os
import sys
import json
import uuid
import platform
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

# --- Helper functions ---

def generate_run_id():
    """Generates a short unique identifier for this run."""
    return uuid.uuid4().hex[:8]

def get_git_info():
    """Get git commit and branch information if available."""
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        # Check if git is installed and we are in a repo
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
    """Captures system metadata for the report."""
    git = get_git_info()
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }

def generate_output_path():
    """
    Generate output path in format: reports/YYYY-MM-DD/HH-MM-SS/report.json
    This ensures historical tracking of evaluations.
    """
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")

    # Assuming evaluator.py is at project root
    project_root = Path(__file__).parent
    output_dir = project_root / "reports" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)

    return output_dir / "report.json"

def parse_pytest_verbose_output(output):
    """
    Parse pytest verbose output to extract individual test results.
    Look for lines like: tests/test_scheduler.py::TestCooperativeScheduler::test_name PASSED
    """
    tests = []
    lines = output.split('\n')
    for line in lines:
        line = line.strip()
        # Look for test execution lines (usually containing ::)
        if '::' in line:
            outcome = None
            if ' PASSED' in line: outcome = "passed"
            elif ' FAILED' in line: outcome = "failed"
            elif ' ERROR' in line: outcome = "error"
            elif ' SKIPPED' in line: outcome = "skipped"

            if outcome:
                # Extract clean nodeid (everything before the status)
                # Example: tests/test_scheduler.py::TestClass::test_func PASSED
                parts = line.split(' ')
                nodeid = parts[0]

                # Extract a readable name
                test_name = nodeid.split("::")[-1]

                tests.append({
                    "nodeid": nodeid,
                    "name": test_name,
                    "outcome": outcome,
                })
    return tests

def run_evaluation_tests(tests_dir, repo_dir):
    """
    Runs pytest on the tests directory.
    Crucially, it adds 'repo_dir' (repository_after) to PYTHONPATH so imports work.
    """
    env = os.environ.copy()

    # CRITICAL: Add 'repository_after' to PYTHONPATH so tests can `import scheduler`
    # regardless of where the script is run from.
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")

    # Command: python -m pytest tests/ -v --tb=short
    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
        # Run process with modified environment
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, env=env)
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

        # Exit code 0 = All passed, 1 = Tests failed but ran.
        # Anything else (2, 3, 4) is an internal error or usage error.
        success = (result.returncode == 0)

        return {
            "success": success,
            "exit_code": result.returncode,
            "tests": tests,
            "summary": summary,
            "stdout": stdout,
            "stderr": stderr
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e)
        }

# --- Main Evaluation Logic ---

def main():
    parser = argparse.ArgumentParser(description="Run Cooperative Scheduler Evaluation")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    args = parser.parse_args()

    # 1. Metadata
    run_id = generate_run_id()
    started_at = datetime.now()

    # 2. Define Paths
    # We assume this script is at the project root.
    project_root = Path(__file__).parent.parent

    # Path to the unit tests
    tests_dir = project_root / "tests"

    # Path to the scheduler implementation
    repo_dir = project_root / "repository_after"

    # Validation
    if not tests_dir.exists():
        print(f"Error: Tests directory not found at {tests_dir}")
        sys.exit(1)

    if not repo_dir.exists():
        print(f"Error: Repository directory not found at {repo_dir}")
        sys.exit(1)

    # 3. Run Tests
    print(f"Running evaluation {run_id} on Cooperative Scheduler...")
    detailed_results = run_evaluation_tests(tests_dir, repo_dir)

    # 4. Finalize Timing
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()

    # 5. Construct Report
    report = {
        "run_id": run_id,
        "tool": "Event loop Scheduler Evaluator",
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 4),
        "environment": get_environment_info(),
        "results": detailed_results,
        "criteria_analysis": {
            "scheduler_implementation": "Implicitly tested via task execution",
            "no_threads": "Checked via test_concurrency_behavior (concurrent logic)",
            "voluntary_yield": "Checked via test_voluntary_yield",
            "priority_scheduling": "Checked via test_priority_scheduling",
            "non_blocking_sleep": "Checked via test_simulated_delays",
            "starvation_prevention": "Checked via test_starvation_and_deadlock_prevention",
            "cleanup": "Checked via test_task_completion_and_cleanup",
        },
        "success": detailed_results["success"],
        "error": None if detailed_results["success"] else "Tests failed or execution error occurred."
    }

    # 6. Save Report
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    # 7. Console Output
    print(f"\n✅ Report saved to: {output_path}")
    print(f"Summary: {detailed_results['summary']['passed']}/{detailed_results['summary']['total']} passed")

    if detailed_results['summary']['failed'] > 0:
        print("❌ Some tests failed.")
        # Print failures to console for immediate feedback
        for test in detailed_results['tests']:
            if test['outcome'] == 'failed':
                print(f"   - Failed: {test['name']}")

    if detailed_results['summary']['errors'] > 0:
        print("⚠️ Errors encountered during collection/execution.")

    # Return appropriate exit code for CI/CD pipelines
    sys.exit(0 if detailed_results["success"] else 1)

if __name__ == "__main__":
    main()