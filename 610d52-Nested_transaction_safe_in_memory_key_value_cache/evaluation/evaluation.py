import json
import os
import platform
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path


def run_pytest(pytest_report_path):
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "--disable-warnings",
        "--maxfail=1",
        "--json-report",
        f"--json-report-file={pytest_report_path}",
    ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env={**os.environ, "PYTHONPATH": "/app/repository_after"},
    )

    return proc


def load_pytest_results(pytest_report_path):
    with open(pytest_report_path, "r") as f:
        data = json.load(f)

    tests = []
    for test in data.get("tests", []):
        tests.append({
            "nodeid": test["nodeid"],
            "name": test["nodeid"].split("::")[-1],
            "outcome": test["outcome"],
        })

    summary = {
        "total": data["summary"]["total"],
        "passed": data["summary"].get("passed", 0),
        "failed": data["summary"].get("failed", 0),
        "errors": data["summary"].get("errors", 0),
        "skipped": data["summary"].get("skipped", 0),
    }

    return tests, summary


def environment_info():
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": os.getenv("GIT_COMMIT", "unknown"),
        "git_branch": os.getenv("GIT_BRANCH", "unknown"),
    }


def main():
    run_id = uuid.uuid4().hex[:8]
    started_at = datetime.utcnow()
    start_time = time.time()

    error = None
    success = False
    tests = []
    summary = {}
    stdout = ""
    stderr = ""
    exit_code = 1

    # Create temporary file for pytest report
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
        pytest_report_path = tmp_file.name

    try:
        proc = run_pytest(pytest_report_path)
        stdout = proc.stdout
        stderr = proc.stderr
        exit_code = proc.returncode

        tests, summary = load_pytest_results(pytest_report_path)
        success = exit_code == 0 and summary.get("failed", 0) == 0

    except Exception as e:
        error = str(e)
    finally:
        # Clean up temporary pytest report file
        if os.path.exists(pytest_report_path):
            os.unlink(pytest_report_path)

    finished_at = datetime.utcnow()
    duration = time.time() - start_time

    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": duration,
        "success": success,
        "error": error,
        "environment": environment_info(),
        "results": {
            "after": {
                "success": success,
                "exit_code": exit_code,
                "tests": tests,
                "summary": summary,
                "stdout": stdout,
                "stderr": stderr,
            }
        },
    }

    out_dir = Path("/app/evaluation") / "report" / started_at.strftime("%Y-%m-%d") / started_at.strftime("%H-%M-%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    report_path = out_dir / "report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    
    # Also save to root and evaluation directory for CI
    root_report = Path("/app/report.json")
    eval_report = Path("/app/evaluation/report.json")
    
    report_json = json.dumps(report, indent=2)
    root_report.write_text(report_json)
    eval_report.write_text(report_json)

    print("\n" + "=" * 60)
    print("TRANSACTION CACHE EVALUATION")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'YES' if success else 'NO'}")
    print(f"Report saved to: {report_path}")
    print(f"Report saved to: {root_report}")
    print(f"Report saved to: {eval_report}")
    print("=" * 60)

    # Always exit 0 for CI compatibility
    sys.exit(0)


if __name__ == "__main__":
    main()
