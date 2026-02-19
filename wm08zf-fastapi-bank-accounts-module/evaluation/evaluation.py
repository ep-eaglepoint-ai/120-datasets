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
    return uuid.uuid4().hex[:8]

def get_git_info():
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0: git_info["git_commit"] = result.stdout.strip()[:8]
        result = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0: git_info["git_branch"] = result.stdout.strip()
    except Exception: pass
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

def generate_output_path(project_root):
    now = datetime.now()
    # Save reports to project_root/reports/...
    output_dir = project_root/ "evaluation" / "reports" / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"

def parse_pytest_verbose_output(output):
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
                parts = line.split(' ')
                nodeid = parts[0]
                test_name = nodeid.split("::")[-1]
                tests.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})
    return tests

def run_evaluation_tests(tests_dir, repo_dir):
    """Runs pytest with a specific PYTHONPATH."""
    env = os.environ.copy()
    # Prepend repo_dir to PYTHONPATH so imports resolve to that specific folder
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")

    # Run pytest
    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
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
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1},
            "stdout": "",
            "stderr": str(e)
        }

def map_criteria(tests):
    """Maps test results to architectural criteria."""
    def check(name):
        for t in tests:
            if name in t["name"]:
                return "Pass" if t["outcome"] == "passed" else "Fail"
        return "Not Run"

    return {
        "non_blocking_api": check("test_blocking_behavior"),
        "correct_celery_usage": check("test_service_create_account_flow"),
        "db_atomicity": check("test_service_create_account_db_failure"),
        "decoupling": check("test_api_create_account_decoupling"),
        "reliability_retries": check("test_task_configuration")
    }

# --- Main Evaluation Logic ---

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    run_id = generate_run_id()

    # PATH RESOLUTION FIX
    # 1. Start from the file's location
    current_file_path = Path(__file__).resolve()

    # 2. Check if we are inside an 'evaluation' folder or at root
    if current_file_path.parent.name == "evaluation":
        # If in /app/evaluation/evaluator.py, root is /app
        project_root = current_file_path.parent.parent
    else:
        # If in /app/evaluator.py, root is /app
        project_root = current_file_path.parent

    tests_dir = project_root / "tests"

    # 1. Evaluate BEFORE
    repo_before = project_root / "repository_before"
    results_before = None
    if repo_before.exists():
        print(f"Running evaluation on BEFORE ({repo_before.name})...")
        results_before = run_evaluation_tests(tests_dir, repo_before)
    else:
        print(f"Warning: {repo_before} not found. Skipping comparison.")

    # 2. Evaluate AFTER
    repo_after = project_root / "repository_after"
    results_after = None
    if repo_after.exists():
        print(f"Running evaluation on AFTER ({repo_after.name})...")
        results_after = run_evaluation_tests(tests_dir, repo_after)
    else:
        print(f"Error: {repo_after} not found at {repo_after}. Cannot proceed.")
        sys.exit(1)

    # 3. Analyze
    criteria_analysis = map_criteria(results_after["tests"]) if results_after else {}

    # 4. Construct Report
    report = {
        "run_id": run_id,
        "tool": "FastAPI Architecture Evaluator",
        "started_at": datetime.now().isoformat(),
        "environment": get_environment_info(),
        "before": results_before,
        "after": results_after,
        "criteria_analysis": criteria_analysis,
        "comparison": {
            "improvement_summary": "Comparison of Buggy vs Refactored Implementation",
            "bugs_fixed": (results_before and not results_before["success"] and results_after["success"])
        },
        "success": results_after["success"]
    }

    # 5. Output
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path(project_root)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n✅ Report saved to: {output_path}")

    if results_before:
        print(f"Before: {results_before['summary']['passed']} passed, {results_before['summary']['failed']} failed")
    if results_after:
        print(f"After : {results_after['summary']['passed']} passed, {results_after['summary']['failed']} failed")
        print("-" * 30)
        for k, v in criteria_analysis.items():
            print(f"{'✅' if v == 'Pass' else '❌'} {k}: {v}")

    sys.exit(0 if results_after["success"] else 1)

if __name__ == "__main__":
    main()