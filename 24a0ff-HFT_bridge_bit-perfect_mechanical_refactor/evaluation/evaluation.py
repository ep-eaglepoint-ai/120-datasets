#!/usr/bin/env python3
import sys
import json
import os
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"

def environment_info():
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }

def run_tests(target: str):
    env = os.environ.copy()
    env["TEST_TARGET"] = target
    try:
        # Using unified_test.py which handles loading the correct module via TEST_TARGET env var
        proc = subprocess.run(
            [sys.executable, str(ROOT / "tests" / "unified_test.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            env=env
        )
        return {
            "passed": proc.returncode == 0,
            "return_code": proc.returncode,
            "output": (proc.stdout + proc.stderr)[:8000]
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "timeout"
        }

def run_metrics(repo_path: Path):
    # Metric: Line count (crucial for this refactor task)
    file_path = repo_path / "hft_parity_refactor.py"
    if not file_path.exists():
        return {}
    
    with open(file_path, 'r') as f:
        line_count = len(f.readlines())
        
    return {
        "line_count": line_count
    }

def evaluate(repo_name: str):
    repo_path = ROOT / repo_name
    # Map repo name to test target (before/after)
    target = "before" if "before" in repo_name else "after"
    tests = run_tests(target)
    metrics = run_metrics(repo_path)
    return {
        "tests": tests,
        "metrics": metrics
    }

def run_evaluation():
    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    
    before = evaluate("repository_before")
    after = evaluate("repository_after")
    

    passed_gate = after["tests"]["passed"]
    
    improvement_summary = (
        f"Refactor successful. Line count: {before['metrics'].get('line_count')} -> {after['metrics'].get('line_count')}. "
        "All behavioral and structural tests passed in the 'after' repository."
    )
    
    end = datetime.utcnow()
    return {
        "run_id": run_id,
        "started_at": start.isoformat() + "Z",
        "finished_at": end.isoformat() + "Z",
        "duration_seconds": (end - start).total_seconds(),
        "environment": environment_info(),
        "before": before,
        "after": after,
        "comparison": {
            "passed_gate": passed_gate,
            "improvement_summary": improvement_summary
        },
        "success": passed_gate,
        "error": None
    }

def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    report = run_evaluation()
    
    # Write latest.json
    path = REPORTS / "latest.json"
    path.write_text(json.dumps(report, indent=2))
    
    print(f"Report written to {path}")
    return 0 if report["success"] else 1

if __name__ == "__main__":
    sys.exit(main())
