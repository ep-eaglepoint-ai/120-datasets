#!/usr/bin/env python3
"""
Power Transformer Structural Scaling Evaluation.
Runs pytest against repository_before and repository_after, parses JUnit XML,
and writes a report to evaluation/<date>/<time>/report.json.
"""
from __future__ import annotations

import json
import os
import platform
import random
import string
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


def generate_run_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def get_git_info() -> dict:
    out = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.getcwd(),
        )
        if result.returncode == 0 and result.stdout:
            out["git_commit"] = result.stdout.strip()[:8]
    except Exception:
        pass
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.getcwd(),
        )
        if result.returncode == 0 and result.stdout:
            out["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    return out


def get_environment_info() -> dict:
    git = get_git_info()
    return {
        "python_version": sys.version.split()[0],
        "platform": sys.platform,
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "unknown")),
        "git_commit": git["git_commit"],
        "git_branch": git["git_branch"],
    }


def parse_junit_xml(path: Path) -> tuple[list[dict], dict]:
    """Parse pytest JUnit XML; return (test_results, summary)."""
    test_results = []
    total = 0
    passed = 0
    failed = 0
    errors = 0
    skipped = 0
    try:
        tree = ET.parse(path)
        root = tree.getroot()
        for suite in root.findall(".//testsuite"):
            for case in suite.findall("testcase"):
                total += 1
                classname = case.get("classname", "")
                name = case.get("name", "")
                nodeid = f"{classname}::{name}" if classname else name
                failure = case.find("failure")
                err = case.find("error")
                skip = case.find("skipped")
                if skip is not None:
                    skipped += 1
                    outcome = "skipped"
                elif failure is not None or err is not None:
                    failed += 1
                    outcome = "failed"
                else:
                    passed += 1
                    outcome = "passed"
                test_results.append({"nodeid": nodeid, "name": name, "outcome": outcome})
    except Exception:
        pass
    summary = {
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "skipped": skipped,
    }
    return test_results, summary


def run_tests(repository_path: str, repository_name: str, project_root: Path) -> dict:
    """Run pytest against the given repository path; return RepositoryResults dict."""
    src_path = project_root / repository_path / "power_transformer_project" / "src"
    if not src_path.exists():
        return {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
            "stdout": "",
            "stderr": "",
            "error": f"Path does not exist: {src_path}",
        }
    env = os.environ.copy()
    env["REPO_PATH"] = repository_path
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as f:
        xml_path = Path(f.name)
    try:
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "tests",
            "-q",
            f"--junitxml={xml_path}",
        ]
        result = subprocess.run(
            cmd,
            cwd=str(project_root),
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        stdout = result.stdout or ""
        stderr = result.stderr or ""
        test_results, summary = parse_junit_xml(xml_path)
        success = result.returncode == 0
        return {
            "success": success,
            "exit_code": result.returncode,
            "tests": test_results,
            "summary": summary,
            "stdout": stdout,
            "stderr": stderr,
            "error": None if success else (stderr or "Tests failed"),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": "pytest timed out",
            "error": "pytest timed out",
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e),
            "error": str(e),
        }
    finally:
        if xml_path.exists():
            xml_path.unlink()


def generate_output_path(project_root: Path) -> Path:
    now = datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    out_dir = project_root / "evaluation" / date_str / time_str
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / "report.json"


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    os.chdir(project_root)

    run_id = generate_run_id()
    started_at = datetime.utcnow()

    print("\n" + "=" * 60)
    print("POWER TRANSFORMER STRUCTURAL SCALING EVALUATION")
    print("=" * 60)
    print(f"Run ID: {run_id}")
    print(f"Started at: {started_at.isoformat()}Z")

    before_results = run_tests("repository_before", "repository_before", project_root)
    after_results = run_tests("repository_after", "repository_after", project_root)

    finished_at = datetime.utcnow()
    duration_seconds = (finished_at - started_at).total_seconds()

    sb = before_results["summary"]
    sa = after_results["summary"]
    comparison = {
        "before_tests_passed": before_results["success"],
        "after_tests_passed": after_results["success"],
        "before_total": sb["total"],
        "before_passed": sb["passed"],
        "before_failed": sb["failed"],
        "after_total": sa["total"],
        "after_passed": sa["passed"],
        "after_failed": sa["failed"],
    }

    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    print("\nBefore Implementation (repository_before):")
    print(f"  Overall: {'PASSED' if before_results['success'] else 'FAILED/SKIPPED'}")
    print(f"  Tests: {sb['passed']}/{sb['total']} passed")
    print("\nAfter Implementation (repository_after):")
    print(f"  Overall: {'PASSED' if after_results['success'] else 'FAILED'}")
    print(f"  Tests: {sa['passed']}/{sa['total']} passed")

    success = after_results["success"]
    error_message = None if success else "After implementation tests failed"

    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat() + "Z",
        "finished_at": finished_at.isoformat() + "Z",
        "duration_seconds": round(duration_seconds, 6),
        "success": success,
        "error": error_message,
        "environment": get_environment_info(),
        "results": {
            "before": before_results,
            "after": after_results,
            "comparison": comparison,
        },
    }

    output_path = generate_output_path(project_root)
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nReport saved to: {output_path}")
    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Duration: {duration_seconds:.2f}s")
    print(f"Success: {'YES' if success else 'NO'}")

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
