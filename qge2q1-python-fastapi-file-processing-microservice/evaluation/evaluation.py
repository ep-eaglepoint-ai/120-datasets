import argparse
import json
import os
import platform
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path


def generate_run_id() -> str:
    return uuid.uuid4().hex[:8]


def get_git_info() -> dict:
    info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            info["git_commit"] = result.stdout.strip()[:8]

        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    return info


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
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    output_dir = project_root / "evaluation" / "reports" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "report.json"


def parse_pytest_verbose_output(output: str) -> list[dict]:
    tests: list[dict] = []
    for raw in output.split("\n"):
        line = raw.strip()
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

        if not outcome:
            continue

        nodeid = line.split(" ", 1)[0]
        name = nodeid.split("::")[-1]
        tests.append({"nodeid": nodeid, "name": name, "outcome": outcome})

    return tests


def run_evaluation_tests(tests_dir: Path, repo_dir: Path, timeout_seconds: int = 180) -> dict:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(repo_dir) + os.pathsep + env.get("PYTHONPATH", "")

    cmd = [sys.executable, "-m", "pytest", str(tests_dir), "-v", "--tb=short"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds, env=env)
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
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run File Processing Microservice Evaluation")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    parser.add_argument("--timeout", type=int, default=180, help="Pytest timeout in seconds")
    args = parser.parse_args()

    run_id = generate_run_id()
    started_at = datetime.now()

    project_root = Path(__file__).parent.parent
    tests_dir = project_root / "tests"
    repo_dir = project_root / "repository_after"

    if not tests_dir.exists():
        print(f"Error: Tests directory not found at {tests_dir}")
        sys.exit(1)
    if not repo_dir.exists():
        print(f"Error: Repository directory not found at {repo_dir}")
        sys.exit(1)

    print(f"Running evaluation {run_id} on async file processing microservice...")
    detailed_results = run_evaluation_tests(tests_dir, repo_dir, timeout_seconds=args.timeout)

    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()

    report = {
        "run_id": run_id,
        "tool": "Async File Processing Microservice Evaluator",
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 4),
        "environment": get_environment_info(),
        "results": detailed_results,
        "criteria_analysis": {
            "lifespan_db_pooling": "Covered by app startup and engine pool config tests",
            "models_job_processingerror": "Covered by ORM schema usage and endpoint flows",
            "upload_streaming_limits": "Covered by upload chunk size and 413 enforcement tests",
            "jobs_listing_filters": "Covered by pagination/filter tests",
            "job_detail_and_errors": "Covered by GET job and GET errors tests",
            "cancel_delete_retry": "Covered by delete/cancel and retry behavior tests",
            "celery_config_and_processing": "Covered by Celery config tests and chunk/openpyxl mode tests",
            "webhook_delivery": "Covered by webhook retry test and upload flow webhook assertion",
            "health_endpoint": "Covered by forced-unhealthy health test",
        },
        "success": detailed_results["success"],
        "error": None if detailed_results["success"] else "Tests failed or execution error occurred.",
    }

    output_path = Path(args.output) if args.output else generate_output_path(project_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: {output_path}")
    summary = detailed_results["summary"]
    print(f"Summary: {summary['passed']}/{summary['total']} passed")
    sys.exit(0 if detailed_results["success"] else 1)


if __name__ == "__main__":
    main()
