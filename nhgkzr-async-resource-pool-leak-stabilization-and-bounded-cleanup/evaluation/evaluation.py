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
        # Verify if git is available and we are in a repo
        result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]

        result = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=5)
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

def generate_output_path(project_root):
    now = datetime.now()
    output_dir = project_root / "evaluation" / "reports" / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"

def parse_pytest_verbose_output(output):
    """
    Parses pytest output to determine the status of individual test nodes.
    """
    tests = []
    lines = output.split('\n')
    for line in lines:
        line = line.strip()
        # Look for the specific pytest output format "nodeid STATUS"
        if '::' in line:
            outcome = None
            if ' PASSED' in line: outcome = "passed"
            elif ' FAILED' in line: outcome = "failed"
            elif ' ERROR' in line: outcome = "error"
            elif ' SKIPPED' in line: outcome = "skipped"
            elif ' XFAIL' in line: outcome = "xfail"

            if outcome:
                parts = line.split(' ')
                nodeid = parts[0]
                test_name = nodeid.split("::")[-1]
                tests.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})
    return tests

def run_evaluation_tests(tests_dir, repo_dir):
    """
    Runs pytest against a specific repository version by modifying PYTHONPATH.
    """
    env = os.environ.copy()
    # Prepend repo_dir to PYTHONPATH to ensure imports load from that specific version
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")

    # Run pytest with verbose output to parse individual test results
    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
        # 120s timeout is generous for the mocked tests
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
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1},
            "stdout": "",
            "stderr": "Evaluation timed out (Test suite took longer than 120s)."
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
    """
    Maps specific test functions to high-level success criteria.
    """
    def check(name_fragment):
        for t in tests:
            if name_fragment in t["name"]:
                return "Pass" if t["outcome"] == "passed" else "Fail"
        return "Not Run"

    # Since all logic (Files, DB, Tasks) is asserted in one consolidated batch test
    # for this specific problem, we map that single test to multiple conceptual criteria.
    test_name = "test_batch_processing_cleanliness"

    return {
        "resource_leak_prevention": check(test_name),
        "transaction_boundary_compliance": check(test_name),
        "async_task_lifecycle_management": check(test_name),
        "file_handle_raii": check(test_name)
    }

def main():
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--output", type=str, default=None, help="Custom path for report.json")
        args = parser.parse_args()

        run_id = generate_run_id()

        # Resolve paths
        # Structure:
        # root/
        #   repository_before/
        #   repository_after/
        #   tests/
        #   evaluation/
        #       evaluation.py

        current_file_path = Path(__file__).resolve()
        project_root = current_file_path.parent.parent

        tests_dir = project_root / "tests"

        if not tests_dir.exists():
            print(f"Error: Could not locate tests directory at {tests_dir}")
            sys.exit(0)

        print(f"Starting Async Resource Leak Evaluation [Run ID: {run_id}]")

        # 1. Evaluate BEFORE (Legacy Code)
        # We expect this to FAIL or have non-zero exit code due to assertions on leaks.
        repo_before = project_root / "repository_before"
        results_before = None
        if repo_before.exists():
            print(f"Running evaluation on BEFORE (Legacy)...")
            results_before = run_evaluation_tests(tests_dir, repo_before)
        else:
            print(f"Warning: {repo_before} not found.")

        # 2. Evaluate AFTER (Refactored Code)
        # We expect this to PASS with 0 exit code.
        repo_after = project_root / "repository_after"
        results_after = None
        if repo_after.exists():
            print(f"Running evaluation on AFTER (Refactored)...")
            results_after = run_evaluation_tests(tests_dir, repo_after)
        else:
            print(f"Error: {repo_after} not found.")
            results_after = {
                "success": False,
                "exit_code": -1,
                "tests": [],
                "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0},
                "stderr": "repository_after directory not found"
            }

        # 3. Analyze Criteria
        criteria_analysis = map_criteria(results_after["tests"]) if results_after and results_after["tests"] else {}

        # 4. Check for Regression/Improvement
        # In this specific challenge, 'before' MUST fail and 'after' MUST pass.
        before_failed = False
        if results_before:
             # It counts as "failed" if tests ran but assertions failed
             before_failed = results_before["summary"]["failed"] > 0 or results_before["summary"]["errors"] > 0

        after_passed = False
        if results_after:
            after_passed = results_after["success"] and results_after["summary"]["failed"] == 0

        improvement_detected = before_failed and after_passed

        # 5. Construct Report
        report = {
            "run_id": run_id,
            "tool": "Async Leak Evaluator",
            "started_at": datetime.now().isoformat(),
            "environment": get_environment_info(),
            "before": results_before,
            "after": results_after,
            "criteria_analysis": criteria_analysis,
            "comparison": {
                "summary": "Stabilization of Resource Pool & Async Task Cleanup",
                "improvement_detected": improvement_detected,
                "details": "Legacy code should fail resource checks; Refactored code should pass with 0 leaks.",
                "success": after_passed # The overall run is successful if the After code works.
            }
        }

        # 6. Output
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = generate_output_path(project_root)

        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)

        print(f"\n✅ Report saved to: {output_path}")

        # Print summary for logs
        if results_after:
            print(f"After Results: {results_after['summary']['passed']} passed, {results_after['summary']['failed']} failed.")
            if improvement_detected:
                print("SUCCESS: Improvement verified (Before Failed -> After Passed).")
            elif not results_after["success"]:
                print("FAILURE: Refactored code still fails tests.")
            else:
                print("WARNING: Refactored passed, but Legacy code did not fail as expected (Verification inconclusive).")

    except Exception as e:
        print(f"INTERNAL EVALUATION SCRIPT ERROR: {e}")
        # Catch-all to prevent pipeline crash

    # ALWAYS EXIT 0 to satisfy requirements
    sys.exit(0)

if __name__ == "__main__":
    main()