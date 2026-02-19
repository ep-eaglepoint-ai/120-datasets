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
        # Simple timeout to prevent hanging if git is not configured
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
    # Save reports to project_root/evaluation/reports/...
    output_dir = project_root / "evaluation" / "reports" / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"

def parse_pytest_verbose_output(output):
    """
    Parses pytest stdout to identify which specific tests passed/failed.
    """
    tests = []
    lines = output.split('\n')
    for line in lines:
        line = line.strip()
        # Look for standard pytest verbose output (e.g., tests/test_check_cycle.py::TestHasCycle::test_name PASSED)
        if '::' in line:
            outcome = None
            if ' PASSED' in line: outcome = "passed"
            elif ' FAILED' in line: outcome = "failed"
            elif ' ERROR' in line: outcome = "error"
            elif ' SKIPPED' in line: outcome = "skipped"

            if outcome:
                parts = line.split(' ')
                # Extract the test path/nodeid
                nodeid = parts[0]
                # Extract just the function name (test_basic_correctness)
                # Usually format is filepath::ClassName::test_function
                test_name = nodeid.split("::")[-1]
                tests.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})
    return tests

def run_evaluation_tests(tests_dir, project_root):
    """
    Runs pytest with the project root added to PYTHONPATH.
    This ensures 'from repository_after.check_cycle import hasCycle' works.
    """
    env = os.environ.copy()
    # Prepend project_root to PYTHONPATH so the tests can import 'repository_after'
    env["PYTHONPATH"] = str(project_root) + os.pathsep + env.get("PYTHONPATH", "")

    # Run pytest
    # -v: verbose (needed for parser)
    # --tb=short: shorter tracebacks to keep log size manageable
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
    """
    Maps specific Cycle Detection test names to the architectural criteria
    defined in the task requirements.
    """
    def check(name_fragment):
        # Returns Pass if at least one test matching the fragment passed,
        # and no tests matching the fragment failed.
        matches = [t for t in tests if name_fragment in t["name"]]
        if not matches:
            return "Not Run"

        has_failure = any(t["outcome"] in ["failed", "error"] for t in matches)
        if has_failure:
            return "Fail"
        return "Pass"

    # Mapping requirements to specific test functions provided in the prompt
    return {
        # Req 4, 5: Basic functionality
        "basic_correctness": check("test_simple"),

        # Req 6: Self-loop handling
        "self_dependency_handling": check("test_self_loop"),

        # Req 7, 8: Disconnected components & multiple cycles
        "disconnected_graph_handling": check("test_disconnected"),

        # Req 10, 13: Recursion depth safety (Stack overflow prevention)
        "recursion_safety_stack_depth": check("test_large_line_graph"),

        # Req 11: Linear Time Complexity O(V+E)
        "large_scale_performance": check("test_large_cycle"),

        # Req 14: Handling Duplicate Dependencies
        "input_robustness_duplicates": check("test_duplicate"),

        # Req 15: Correct algorithm (not brute force) - Diamond problem
        "algorithmic_correctness": check("test_diamond_graph"),

        # Req 9: Empty graph handling
        "edge_case_empty_graph": check("test_no_edges")
    }

# --- Main Evaluation Logic ---

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=str, default=None, help="Custom path for report.json")
    args = parser.parse_args()

    run_id = generate_run_id()

    # PATH RESOLUTION
    # 1. Start from the file's location: /app/evaluation/evaluation.py
    current_file_path = Path(__file__).resolve()

    # 2. Determine Project Root (/app)
    if current_file_path.parent.name == "evaluation":
        project_root = current_file_path.parent.parent
    else:
        # Fallback if script is moved
        project_root = current_file_path.parent

    tests_dir = project_root / "tests"

    # Ensure tests directory exists
    if not tests_dir.exists():
        print(f"Error: Could not locate tests directory at {tests_dir}")
        sys.exit(1)

    # 1. Evaluate AFTER (The solution)
    repo_after = project_root / "repository_after"
    results_after = None

    if repo_after.exists():
        print(f"Running evaluation on SOLUTION ({repo_after.name})...")
        results_after = run_evaluation_tests(tests_dir, project_root)
    else:
        print(f"Error: {repo_after} not found. Cannot proceed with evaluation.")
        sys.exit(1)

    # 2. Analyze Criteria
    criteria_analysis = map_criteria(results_after["tests"]) if results_after else {}

    # 3. Construct Report
    report = {
        "run_id": run_id,
        "tool": "Cycle Detection Evaluator",
        "started_at": datetime.now().isoformat(),
        "environment": get_environment_info(),
        "before": None, # Skipping as requested
        "after": results_after,
        "criteria_analysis": criteria_analysis,
        "comparison": {
            "summary": "Evaluation of Cycle Detection Implementation",
            "improvement_detected": False # No baseline to compare against
        },
        "success": results_after["success"]
    }

    # 4. Output
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path(project_root)

    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n✅ Report saved to: {output_path}")

    if results_after:
        print(f"Results: {results_after['summary']['passed']} passed, {results_after['summary']['failed']} failed")
        print("-" * 40)
        print("ARCHITECTURAL CRITERIA STATUS:")
        for k, v in criteria_analysis.items():
            icon = '✅' if v == 'Pass' else '❌' if v == 'Fail' else '⚠️'
            print(f"{icon} {k.replace('_', ' ').title()}: {v}")

    sys.exit(0 if results_after["success"] else 1)

if __name__ == "__main__":
    main()