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


def generate_run_id() -> str:
    """Generates a short unique identifier for this run."""
    return uuid.uuid4().hex[:8]


def get_git_info() -> dict:
    """Get git commit and branch information if available."""
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]

        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            git_info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    return git_info


def get_environment_info() -> dict:
    """Captures system metadata for the report."""
    git = get_git_info()
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }


def generate_output_path(project_root: Path) -> Path:
    """Generate output path in format: reports/YYYY-MM-DD/HH-MM-SS/report.json."""
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")

    output_dir = project_root/"evaluation" / "reports" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"


def parse_pytest_verbose_output(output: str) -> list[dict]:
    """Parse pytest verbose output to extract individual test results."""
    tests: list[dict] = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if "::" not in line:
            continue

        outcome = None
        if " PASSED" in line:
            outcome = "passed"
        elif " FAILED" in line:
            outcome = "failed"
        elif " ERROR" in line:
            outcome = "error"
        elif " SKIPPED" in line:
            outcome = "skipped"
        elif " XFAIL" in line:
            outcome = "xfail"
        elif " XPASS" in line:
            outcome = "xpass"

        if not outcome:
            continue

        nodeid = line.split(" ", 1)[0]
        test_name = nodeid.split("::")[-1]
        tests.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})

    return tests


def run_evaluation_tests(*, tests_dir: Path, repo_after_dir: Path, timeout_s: int) -> dict:
    """Run pytest on the test suite and capture structured results."""
    env = os.environ.copy()

    # Add repository_after to PYTHONPATH so tests can import the implementation.
    env["PYTHONPATH"] = str(repo_after_dir) + os.pathsep + env.get("PYTHONPATH", "")

    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            env=env,
        )
        stdout = result.stdout
        stderr = result.stderr

        tests = parse_pytest_verbose_output(stdout)
        summary = {
            "total": len(tests),
            "passed": sum(1 for t in tests if t["outcome"] == "passed"),
            "failed": sum(1 for t in tests if t["outcome"] == "failed"),
            "errors": sum(1 for t in tests if t["outcome"] == "error"),
            "skipped": sum(1 for t in tests if t["outcome"] == "skipped"),
            "xfail": sum(1 for t in tests if t["outcome"] == "xfail"),
            "xpass": sum(1 for t in tests if t["outcome"] == "xpass"),
        }

        success = result.returncode == 0
        return {
            "success": success,
            "exit_code": result.returncode,
            "tests": tests,
            "summary": summary,
            "stdout": stdout,
            "stderr": stderr,
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 1,
                "skipped": 0,
                "xfail": 0,
                "xpass": 0,
            },
            "stdout": "",
            "stderr": str(e),
        }


# --- Main Evaluation Logic ---


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Geodesic Navigation with Wind Triangle Evaluation")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    parser.add_argument("--timeout", type=int, default=120, help="Timeout in seconds for pytest")
    args = parser.parse_args()

    run_id = generate_run_id()
    started_at = datetime.now()

    # evaluation/evaluation.py -> project root is parent of evaluation/
    project_root = Path(__file__).resolve().parents[1]

    tests_dir = project_root / "tests"
    repo_after_dir = project_root / "repository_after"

    if not tests_dir.exists():
        print(f"Error: Tests directory not found at {tests_dir}")
        sys.exit(1)

    if not repo_after_dir.exists():
        print(f"Error: Repository directory not found at {repo_after_dir}")
        sys.exit(1)

    print(f"Running evaluation {run_id} on Geodesic Navigation with Wind Triangle Correction...")
    detailed_results = run_evaluation_tests(
        tests_dir=tests_dir,
        repo_after_dir=repo_after_dir,
        timeout_s=args.timeout,
    )

    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()

    report = {
        "run_id": run_id,
        "tool": "Geodesic Navigation Evaluator",
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 4),
        "environment": get_environment_info(),
        "paths": {
            "project_root": str(project_root),
            "tests_dir": str(tests_dir),
            "repository_after": str(repo_after_dir),
            "repository_before": None,
        },
        "results": detailed_results,
        "criteria_analysis": {
            "haversine_formula": "Verified via test_haversine_distance_equator_one_degree_lon and source token checks",
            "initial_bearing_atan2": "Verified via test_source_uses_required_math_and_no_forbidden_libs and bearing numeric test",
            "heading_vs_course_crosswind": "Verified via test_wind_triangle_crosswind_changes_heading_and_vector_groundspeed",
            "vector_groundspeed": "Verified via test_wind_triangle_crosswind_changes_heading_and_vector_groundspeed",
            "heading_normalization_0_360": "Verified via test_heading_normalization_wraps_above_360",
            "no_forbidden_geo_libs": "Verified via test_source_uses_required_math_and_no_forbidden_libs",
            "zero_wind_behavior": "Verified via test_zero_wind_heading_equals_course_and_gs_equals_tas",
            "international_date_line": "Verified via test_international_date_line_handling_distance_and_course",
        },
        "success": detailed_results["success"],
        "error": None if detailed_results["success"] else "Tests failed or execution error occurred.",
    }

    output_path = Path(args.output) if args.output else generate_output_path(project_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: {output_path}")
    print(f"Summary: {detailed_results['summary']['passed']}/{detailed_results['summary']['total']} passed")

    if detailed_results["summary"]["failed"] > 0:
        print("Some tests failed:")
        for t in detailed_results["tests"]:
            if t["outcome"] == "failed":
                print(f"  - {t['nodeid']}")

    if detailed_results["summary"]["errors"] > 0:
        print("Errors encountered during collection/execution.")

    sys.exit(0 if detailed_results["success"] else 1)


if __name__ == "__main__":
    main()
