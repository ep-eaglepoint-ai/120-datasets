import os
import sys
import json
import uuid
import platform
import subprocess
import argparse
from datetime import datetime
from pathlib import Path


def generate_run_id() -> str:
    return uuid.uuid4().hex[:8]


def get_git_info() -> dict:
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            git_info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    return git_info


def get_environment_info() -> dict:
    git = get_git_info()
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }


def generate_output_path(project_root: Path) -> Path:
    now = datetime.now()
    output_dir = project_root / "evaluation" / "reports" / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"


def parse_pytest_verbose_output(output: str) -> list[dict]:
    tests: list[dict] = []
    for raw_line in output.split("\n"):
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

        if outcome is None:
            continue

        nodeid = line.split(" ")[0]
        test_name = nodeid.split("::")[-1]
        tests.append({"nodeid": nodeid, "name": test_name, "outcome": outcome})
    return tests


def run_evaluation_tests(tests_dir: Path, repo_target_dir: Path) -> dict:
    """Runs pytest in a way that targets the requested repo directory.

    This dataset uses `repository_after/` as the implementation root and the
    tests import modules as `repository_after.*`.

    To make that import resolvable regardless of CWD, we prepend the *project
    root* (parent of repository_after) to PYTHONPATH.
    """

    project_root = repo_target_dir.parent

    env = os.environ.copy()
    env["PYTHONPATH"] = str(project_root) + os.pathsep + env.get("PYTHONPATH", "")
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
            "stderr": stderr,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": "Evaluation timed out (Test suite took longer than 120s).",
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e),
        }


def map_criteria(tests: list[dict]) -> dict:
    """Map tests to key feature-store requirements.

    This is a lightweight rubric for this dataset task.
    """

    def check(name_fragment: str) -> str:
        for t in tests:
            if name_fragment in t["name"]:
                return "Pass" if t["outcome"] == "passed" else "Fail"
        return "Not Run"

    return {
        "registry_lineage": check("test_registry_register_and_lineage_edges"),
        "registry_upsert": check("test_registry_upsert_replaces_lineage"),
        "online_defaults": check("test_online_store_get_defaults_when_missing"),
        "online_staleness": check("test_online_store_staleness_returns_defaults"),
        "online_batch": check("test_online_store_batch"),
        "pit_join_correct": check("test_point_in_time_join_picks_latest_past_value"),
        "pit_join_no_leakage": check("test_point_in_time_join_prevents_leakage_future_feature_is_not_used"),
        "api_discovery": check("test_api_health_and_feature_listing"),
        "catalog_hook": check("test_catalog_hook_called"),
        "redis_timeseries": check("test_redis_timeseries_write_and_get"),
        "schema_validation": check("test_schema_validation_success"),
        "drift_psi": check("test_drift_psi_alert"),
        "spark_optional": check("test_point_in_time_join_spark_requires_pyspark"),
    }


def find_repo_path(project_root: Path, repo_name: str) -> Path | None:
    possible_paths = [
        project_root / "patches" / repo_name,
        project_root / repo_name,
    ]
    for path in possible_paths:
        if path.exists() and path.is_dir():
            return path
    return None


def main() -> None:
    try:
        parser = argparse.ArgumentParser()
        parser.add_argument("--output", type=str, default=None, help="Custom path for report.json")
        args = parser.parse_args()

        run_id = generate_run_id()

        current_file_path = Path(__file__).resolve()
        if current_file_path.parent.name == "evaluation":
            project_root = current_file_path.parent.parent
        else:
            project_root = current_file_path.parent

        tests_dir = project_root / "tests"
        if not tests_dir.exists():
            print(f"Error: Could not locate tests directory at {tests_dir}")
            sys.exit(0)

        print(f"Starting ML Feature Store Evaluation [Run ID: {run_id}]")

        # This task run does not include a meaningful repository_before baseline.
        results_before = None

        repo_after = find_repo_path(project_root, "repository_after")
        results_after = None
        if repo_after:
            print(f"Running evaluation on AFTER (Implemented) at {repo_after}...")
            results_after = run_evaluation_tests(tests_dir, repo_after)
        else:
            print("Error: 'repository_after' directory not found. Cannot evaluate implementation.")
            results_after = {
                "success": False,
                "exit_code": -1,
                "tests": [],
                "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
                "stderr": "repository_after directory not found",
            }

        criteria_analysis = map_criteria(results_after["tests"]) if results_after and results_after.get("tests") else {}

        report = {
            "run_id": run_id,
            "tool": "ML Feature Store Evaluator",
            "started_at": datetime.now().isoformat(),
            "environment": get_environment_info(),
            "before": results_before,
            "after": results_after,
            "criteria_analysis": criteria_analysis,
            "comparison": {
                "summary": "Evaluation of Implemented ML Feature Store",
                "improvement_detected": False,
                "success": bool(results_after and results_after.get("success")),
            },
        }

        output_path = Path(args.output) if args.output else generate_output_path(project_root)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)

        print(f"\nReport saved to: {output_path}")

    except Exception as e:
        print(f"INTERNAL EVALUATION SCRIPT ERROR: {e}")
        import traceback

        traceback.print_exc()

    sys.exit(0)


if __name__ == "__main__":
    main()
