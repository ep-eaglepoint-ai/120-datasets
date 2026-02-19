#!/usr/bin/env python3
"""
Evaluation runner for Square Split Line Problem.
Runs pytest on both repository_before and repository_after.
"""
import os
import sys
import json
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"


def environment_info():

    """Collect environment information."""
    
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }


def run_tests(repo_path: Path):
    """Run pytest for a repository and parse detailed test results."""
    import re
    
    env = os.environ.copy()
    env["PYTHONPATH"] = str(repo_path)
    
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", str(ROOT / "tests"), "-q", "--tb=short"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            env=env
        )
        output = (proc.stdout + proc.stderr)[:8000]
        
        # Parse pytest output to extract test counts
        # Look for patterns like "15 failed, 2 passed" or "17 passed"
        passed_count = 0
        failed_count = 0
        total_count = 0
        
        # Try to extract counts from output
        # Pattern 1: "X failed, Y passed" or "X passed, Y failed"
        match = re.search(r'(\d+)\s+failed', output, re.IGNORECASE)
        if match:
            failed_count = int(match.group(1))
        
        match = re.search(r'(\d+)\s+passed', output, re.IGNORECASE)
        if match:
            passed_count = int(match.group(1))
        
        total_count = passed_count + failed_count
        
        # If we couldn't parse, try alternative patterns
        if total_count == 0:
            # Look for "X passed in Y.Ys" pattern
            match = re.search(r'(\d+)\s+passed\s+in', output, re.IGNORECASE)
            if match:
                passed_count = int(match.group(1))
                total_count = passed_count
                # Check return code to see if there were failures
                if proc.returncode != 0:
                    # If return code is non-zero but we only see "passed", 
                    # pytest might have been interrupted or there were errors
                    failed_count = 1 if proc.returncode != 0 else 0
        
        # Determine if tests passed (all tests must pass)
        all_passed = (proc.returncode == 0) and (failed_count == 0) and (total_count > 0)
        
        return {
            "passed": all_passed,
            "return_code": proc.returncode,
            "output": output,
            "test_counts": {
                "total": total_count,
                "passed": passed_count,
                "failed": failed_count
            }
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest timeout",
            "test_counts": {
                "total": 0,
                "passed": 0,
                "failed": 0
            }
        }
    except Exception as e:
        return {
            "passed": False,
            "return_code": -1,
            "output": f"Error running tests: {str(e)}",
            "test_counts": {
                "total": 0,
                "passed": 0,
                "failed": 0
            }
        }


def run_metrics(repo_path: Path):
    return {}


def evaluate(repo_name: str):
    repo_path = ROOT / repo_name
    tests = run_tests(repo_path)
    metrics = run_metrics(repo_path)
    return {
        "tests": tests,
        "metrics": metrics
    }


def run_evaluation():

    """Run the complete evaluation and return report dict."""
    
    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    
    try:
        before = evaluate("repository_before")
        after = evaluate("repository_after")
        
        before_tests = before["tests"]
        after_tests = after["tests"]
        
        before_passed = before_tests.get("test_counts", {}).get("passed", 0)
        before_failed = before_tests.get("test_counts", {}).get("failed", 0)
        before_total = before_tests.get("test_counts", {}).get("total", 0)
        
        after_passed = after_tests.get("test_counts", {}).get("passed", 0)
        after_failed = after_tests.get("test_counts", {}).get("failed", 0)
        after_total = after_tests.get("test_counts", {}).get("total", 0)
        
        passed_gate = after_tests["passed"] and (after_failed == 0)
        
        # Create detailed improvement summary
        if passed_gate:
            if before_failed > 0:
                improvement_summary = f"After implementation: {after_passed}/{after_total} tests passed (improved from {before_passed}/{before_total} passed, {before_failed} failed in before)"
            else:
                improvement_summary = f"After implementation: {after_passed}/{after_total} tests passed"
        else:
            if after_failed > 0:
                improvement_summary = f"After implementation: {after_failed} failed, {after_passed} passed out of {after_total} total tests"
            else:
                improvement_summary = "After implementation failed correctness tests"
        
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
                "improvement_summary": improvement_summary,
                "before_test_summary": f"{before_passed} passed, {before_failed} failed out of {before_total} total",
                "after_test_summary": f"{after_passed} passed, {after_failed} failed out of {after_total} total"
            },
            "success": passed_gate,
            "error": None
        }
    except Exception as e:
        end = datetime.utcnow()
        return {
            "run_id": run_id,
            "started_at": start.isoformat() + "Z",
            "finished_at": end.isoformat() + "Z",
            "duration_seconds": (end - start).total_seconds(),
            "environment": environment_info(),
            "before": {
                "tests": {
                    "passed": False,
                    "return_code": -1,
                    "output": "",
                    "test_counts": {
                        "total": 0,
                        "passed": 0,
                        "failed": 0
                    }
                },
                "metrics": {}
            },
            "after": {
                "tests": {
                    "passed": False,
                    "return_code": -1,
                    "output": "",
                    "test_counts": {
                        "total": 0,
                        "passed": 0,
                        "failed": 0
                    }
                },
                "metrics": {}
            },
            "comparison": {
                "passed_gate": False,
                "improvement_summary": "Evaluation crashed"
            },
            "success": False,
            "error": str(e)
        }


def main():
    """Main entry point."""
    REPORTS.mkdir(parents=True, exist_ok=True)
    
    try:
        report = run_evaluation()
        latest_path = REPORTS / "latest.json"
        report_path = REPORTS / "report.json"
        
        report_json = json.dumps(report, indent=2)
        latest_path.write_text(report_json)
        report_path.write_text(report_json)
        
        print(f"Report written to {latest_path}")
        print(f"Report written to {report_path}")
        return 0 if report["success"] else 1
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
