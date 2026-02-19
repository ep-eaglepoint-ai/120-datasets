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
    output_dir = project_root / "evaluation" / "reports" / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
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
    env = os.environ.copy()
    # Prepend repo_dir to PYTHONPATH
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")

    # Run pytest
    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
        # 120s timeout to prevent CI hangs
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

        # Note: We return result info, but we do NOT raise exceptions here if tests fail
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
    def check(name_fragment):
        for t in tests:
            if name_fragment in t["name"]:
                return "Pass" if t["outcome"] == "passed" else "Fail"
        return "Not Run"

    return {
        "optimality_guarantee": check("test_bfs_optimality_trap"),
        "memory_efficiency": check("test_maze_is_modified_in_place"),
        "scalability_recursion_safety": check("test_recursion_limit_safe"),
        "strict_return_contract": check("test_no_solution_returns_empty"),
        "input_validation_empty": check("test_empty_maze_raises"),
        "input_validation_bounds": check("test_out_of_bounds_raises"),
        "input_validation_walls": check("test_walls_raise_error"),
    }

def main():
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--output", type=str, default=None, help="Custom path for report.json")
        args = parser.parse_args()

        run_id = generate_run_id()

        # Resolve paths
        current_file_path = Path(__file__).resolve()
        if current_file_path.parent.name == "evaluation":
            project_root = current_file_path.parent.parent
        else:
            project_root = current_file_path.parent

        tests_dir = project_root / "tests"

        if not tests_dir.exists():
            if (project_root / "test_maze.py").exists():
                 tests_dir = project_root
            else:
                # We catch this error, print it, but still exit 0 to avoid CI crash
                print(f"Error: Could not locate tests directory at {tests_dir}")
                # We can write a failed report
                sys.exit(0)

        print(f"Starting Maze Solver Evaluation [Run ID: {run_id}]")

        # 1. Evaluate BEFORE
        repo_before = project_root / "repository_before"
        results_before = None
        if repo_before.exists():
            print(f"Running evaluation on BEFORE...")
            results_before = run_evaluation_tests(tests_dir, repo_before)
        else:
            print(f"Warning: {repo_before} not found.")

        # 2. Evaluate AFTER
        repo_after = project_root / "repository_after"
        results_after = None
        if repo_after.exists():
            print(f"Running evaluation on AFTER...")
            results_after = run_evaluation_tests(tests_dir, repo_after)
        else:
            print(f"Error: {repo_after} not found.")
            # Even if repo is missing, we write a partial report and exit 0
            results_after = {
                "success": False,
                "exit_code": -1,
                "tests": [],
                "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0},
                "stderr": "repository_after directory not found"
            }

        # 3. Analyze
        criteria_analysis = map_criteria(results_after["tests"]) if results_after and results_after["tests"] else {}

        # 4. Construct Report
        report = {
            "run_id": run_id,
            "tool": "Maze Solver Evaluator",
            "started_at": datetime.now().isoformat(),
            "environment": get_environment_info(),
            "before": results_before,
            "after": results_after,
            "criteria_analysis": criteria_analysis,
            "comparison": {
                "summary": "Comparison of Recursive DFS vs Iterative BFS",
                "improvement_detected": (
                    results_before and results_after and
                    results_after["summary"]["passed"] > results_before["summary"]["passed"]
                ) if results_before and results_after else False,
                "success": results_after["success"]
            }
        }

        # 5. Output
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
            if not results_after["success"]:
                print("Some tests failed, but report was generated successfully.")
            else:
                print("All tests passed.")

    except Exception as e:
        print(f"INTERNAL EVALUATION SCRIPT ERROR: {e}")
        # Even on internal crash, try to exit 0 to allow CI to proceed if possible,
        # though usually an uncaught exception prints traceback and exits 1.
        # The try/except block here catches it.

    # ALWAYS EXIT 0 to satisfy "Failing tests shouldn't have exit code 1"
    sys.exit(0)

if __name__ == "__main__":
    main()