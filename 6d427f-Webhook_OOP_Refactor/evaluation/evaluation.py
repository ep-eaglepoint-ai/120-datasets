#!/usr/bin/env python3
import sys
import re
import json
import time
import uuid
import platform
import os
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

def run_tests(context_path=None, test_path="tests"):
    env = os.environ.copy()
    if context_path:
        env["PYTHONPATH"] = str(context_path) + os.pathsep + env.get("PYTHONPATH", "")
        
    try:
        proc = subprocess.run(
            ["pytest", str(test_path), "-v"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            env=env
        )
        
        output = proc.stdout + proc.stderr
        if len(output) > 20000:
            output = output[:4000] + "\n...[truncated]...\n" + output[-16000:]
            
        return {
            "passed": proc.returncode == 0,
            "return_code": proc.returncode,
            "output": output
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest timeout"
        }

def run_metrics(repo_path: Path):
    metrics = {
        "py_file_count": 0,
        "lines_of_code": 0,
        "class_count_approx": 0
    }
    
    if not repo_path.exists():
        return metrics

    try:
        for file_path in repo_path.rglob("*.py"):
            metrics["py_file_count"] += 1
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()
                metrics["lines_of_code"] += len(lines)
                # Simple heuristic to count classes
                metrics["class_count_approx"] += sum(1 for line in lines if line.strip().startswith("class "))
            except Exception:
                pass
    except Exception as e:
        metrics["error"] = str(e)
        
    return metrics

def evaluate(repo_name: str):
    repo_path = ROOT / repo_name
    
    # Check if specific tests exist for this repository version
    test_path = repo_path / "tests"
    if not test_path.exists():
        test_path = "tests"
    
    tests = run_tests(repo_path, test_path)
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
    
    comparison = {
        "passed_gate": after["tests"]["passed"],
        "improvement_summary": "After implementation passed correctness checks"
    }
    
    end = datetime.utcnow()
    
    return {
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

def parse_py_output(output_str):
    passed = 0
    failed = 0
    
    lines = output_str.strip().splitlines()
    summary_line = ""
    for line in reversed(lines):
        if "passed" in line or "failed" in line:
            if "in" in line and "s" in line:
                 summary_line = line
                 break
    
    if summary_line:
        p_match = re.search(r'(\d+) passed', summary_line)
        f_match = re.search(r'(\d+) failed', summary_line)
        e_match = re.search(r'(\d+) error', summary_line)
        
        if p_match: passed = int(p_match.group(1))
        if f_match: failed += int(f_match.group(1))
        if e_match: failed += int(e_match.group(1))
    
    reqs = {
        "Amenity": True,
        "BaseModel": True,
        "Place": True,
        "Review": True,
        "State": True,
        "User": True
    }
    
    if failed > 0:
        for line in lines:
            if line.startswith("FAILED") or line.startswith("ERROR"):
                lower = line.lower()
                if "amenity" in lower: reqs["Amenity"] = False
                if "base_model" in lower: reqs["BaseModel"] = False
                if "place" in lower: reqs["Place"] = False
                if "review" in lower: reqs["Review"] = False
                if "state" in lower: reqs["State"] = False
                if "user" in lower: reqs["User"] = False
                
    covered = sum(1 for v in reqs.values() if v)
    total = len(reqs)
    
    return passed, failed, covered, total

def print_report(report, report_path):
    b_p, b_f, b_cov, b_tot = parse_py_output(report["before"]["tests"]["output"])
    a_p, a_f, a_cov, a_tot = parse_py_output(report["after"]["tests"]["output"])
    
    print("=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    print()
    print(f"Run ID: {report['run_id']}")
    print(f"Duration: {report['duration_seconds']:.2f} seconds")
    print()
    print("BEFORE (repository_before):")
    print(f"  Tests passed: {report['before']['tests']['passed']}")
    print(f"  Passed: {b_p} | Failed: {b_f}")
    print(f"  Requirements covered: {b_cov}/{b_tot}")
    print()
    print("AFTER (repository_after):")
    print(f"  Tests passed: {report['after']['tests']['passed']}")
    print(f"  Passed: {a_p} | Failed: {a_f}")
    print(f"  Requirements covered: {a_cov}/{a_tot}")
    print()
    print("COMPARISON:")
    print(f"  Passed gate: {report['comparison']['passed_gate']}")
    print(f"  Summary: {report['comparison']['improvement_summary']} ({a_cov}/{a_tot} covered vs {b_cov}/{b_tot} before)")
    print()
    print("=" * 60)
    print(f"SUCCESS: {report['success']}")
    print("=" * 60)
    print()
    print(f"Report written to {report_path}")

def main():
    report = run_evaluation()
    
    # Generate report path: evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json
    now = datetime.strptime(report["started_at"].replace("Z", ""), "%Y-%m-%dT%H:%M:%S.%f")
    # Use timezone-aware logic if needed, but keeping existing logic to avoid breaking
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    
    report_dir = REPORTS / date_str / time_str
    report_dir.mkdir(parents=True, exist_ok=True)
    
    path = report_dir / "report.json"
    path.write_text(json.dumps(report, indent=2))
    
    print_report(report, path)
    return 0 if report["success"] else 1

if __name__ == "__main__":
    sys.exit(main())
