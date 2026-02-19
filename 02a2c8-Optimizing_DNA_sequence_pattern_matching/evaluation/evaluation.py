#!/usr/bin/env python3
import sys
import os
import json
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime
import re

# Root directories
ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"

def environment_info():
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }

def parse_per_test(output: str):
    """
    Parse pytest verbose output to extract individual test names and pass/fail.
    """
    per_test = []
    # Match lines like: test.py::test_name PASSED
    pattern = re.compile(r"(\S+\.py::\S+)\s+(PASSED|FAILED|ERROR)")
    for match in pattern.finditer(output):
        test_name = match.group(1).split("::")[-1]
        status = match.group(2) == "PASSED"
        per_test.append({
            "name": test_name,
            "passed": status
        })
    return per_test

def run_tests(repo_name: str):
    """
    Run pytest on the given repo folder and return structured results.
    PYTHONPATH is set so that dna_sequence_pattern_matcher can be imported.
    """
    repo_path = ROOT / repo_name
    env = {**os.environ, "PYTHONPATH": str(repo_path)}

    try:
        proc = subprocess.run(
            ["pytest", "-v", "-s", str(ROOT / "tests" / "test.py")],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes max per test run
        )
        output = proc.stdout + proc.stderr
        return {
            "passed": proc.returncode == 0,
            "return_code": proc.returncode,
            "output": output[:8000],  # truncate long output
            "per_test": parse_per_test(output)
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest timeout",
            "per_test": []
        }
    except Exception as e:
        return {
            "passed": False,
            "return_code": -2,
            "output": str(e),
            "per_test": []
        }

def run_metrics(repo_path: Path):
    """
    Optional metrics collection (performance, stability, etc.)
    Can implement later; must return JSON-serializable dict.
    """
    return {}

def evaluate(repo_name: str):
    """
    Evaluate a repository: run tests and collect metrics.
    """
    repo_path = ROOT / repo_name
    tests = run_tests(repo_name)
    metrics = run_metrics(repo_path)
    return {
        "tests": tests,
        "metrics": metrics
    }

def run_evaluation():
    """
    Main evaluation: evaluate before and after repos, compare, return full report.
    """
    print("Evaluating repositories... ⏳")

    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    before = evaluate("repository_before")
    after = evaluate("repository_after")

    comparison = {
        "passed_gate": after["tests"]["passed"],
        "improvement_summary": (
            "After repository passed all tests"
            if after["tests"]["passed"]
            else "After repository failed tests"
        )
    }

    end = datetime.utcnow()

    report = {
        "run_id": run_id,
        "started_at": start.isoformat() + "Z",
        "finished_at": end.isoformat() + "Z",
        "duration_seconds": (end - start).total_seconds(),
        "environment": environment_info(),
        "before": before,
        "after": after,
        "comparison": comparison,
        "success": comparison["passed_gate"],
        "error": None
    }

    # Print final status to terminal
    status_text = "PASSED ✅" if report["success"] else "FAILED ❌"
    print(f"Evaluation completed: {status_text}")
    return report

def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    try:
        report = run_evaluation()
        path = REPORTS / "latest.json"
        path.write_text(json.dumps(report, indent=2))
        print(f"Report written to {path}")
        return 0 if report["success"] else 1
    except Exception as e:
        path = REPORTS / "latest.json"
        error_report = {
            "run_id": str(uuid.uuid4()),
            "started_at": datetime.utcnow().isoformat() + "Z",
            "finished_at": datetime.utcnow().isoformat() + "Z",
            "duration_seconds": 0.0,
            "environment": environment_info(),
            "before": None,
            "after": None,
            "comparison": None,
            "success": False,
            "error": str(e)
        }
        path.write_text(json.dumps(error_report, indent=2))
        print(f"Evaluation failed. Report written to {path}")
        return 1

if __name__ == "__main__":
    sys.exit(main())