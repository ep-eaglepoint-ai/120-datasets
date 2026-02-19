#!/usr/bin/env python3
"""
Evaluation script for Self-intersecting Polygon Area implementation.
Runs tests for repository_after and generates a JSON report.
"""

import sys
import json
import uuid
import platform
import subprocess
from pathlib import Path
from datetime import datetime

# Paths
ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"


def environment_info():
    """Gather environment information."""
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform()
    }


def run_tests():
    """Run pytest on the tests directory and capture results."""
    try:
        proc = subprocess.run(
            ["pytest", "tests", "-v", "--tb=short"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=120
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
            "output": "pytest timeout (exceeded 120 seconds)"
        }
    except FileNotFoundError:
        return {
            "passed": False,
            "return_code": -1,
            "output": "pytest not found. Please install pytest."
        }


def run_metrics(repo_path: Path):
    """
    Optional metrics collection.
    Can be extended to measure code coverage, performance, etc.
    """
    metrics = {}
    
    # Example: count lines of code in the implementation
    impl_file = repo_path / "self_intersecting_polygon_area.py"
    if impl_file.exists():
        lines = impl_file.read_text().strip().split('\n')
        metrics["lines_of_code"] = len(lines)
        metrics["non_empty_lines"] = len([l for l in lines if l.strip()])
    
    return metrics


def evaluate(repo_name: str):
    """Evaluate a repository by running tests and collecting metrics."""
    repo_path = ROOT / repo_name
    tests = run_tests()
    metrics = run_metrics(repo_path)
    return {
        "tests": tests,
        "metrics": metrics
    }


def print_summary(report):
    """Print a human-readable summary to the terminal."""
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)
    
    print(f"\nRun ID: {report['run_id']}")
    print(f"Duration: {report['duration_seconds']:.2f} seconds")
    print(f"Environment: Python {report['environment']['python_version']}")
    print(f"Platform: {report['environment']['platform']}")
    
    print("\n" + "-" * 60)
    print("TEST RESULTS (repository_after)")
    print("-" * 60)
    
    after_tests = report["after"]["tests"]
    status = "✓ PASSED" if after_tests["passed"] else "✗ FAILED"
    print(f"Status: {status}")
    print(f"Return Code: {after_tests['return_code']}")
    
    if report["after"]["metrics"]:
        print(f"\nMetrics:")
        for key, value in report["after"]["metrics"].items():
            print(f"  - {key}: {value}")
    
    print("\n" + "-" * 60)
    print("TEST OUTPUT")
    print("-" * 60)
    print(after_tests["output"])
    
    print("\n" + "=" * 60)
    print(f"FINAL RESULT: {'SUCCESS' if report['success'] else 'FAILURE'}")
    print("=" * 60)
    print(f"\nReport saved to: {REPORTS / 'latest.json'}\n")


def run_evaluation():
    """Run the full evaluation and generate report."""
    run_id = str(uuid.uuid4())
    start = datetime.utcnow()
    
    # Skip repository_before as it doesn't have the implementation
    before = {
        "tests": {
            "passed": False,
            "return_code": -1,
            "output": "Skipped - no implementation in repository_before"
        },
        "metrics": {}
    }
    
    # Evaluate repository_after
    after = evaluate("repository_after")
    
    # Determine pass/fail and generate summary
    passed_gate = after["tests"]["passed"]
    
    if passed_gate:
        improvement_summary = "Implementation passed all correctness tests. Self-intersecting polygon area calculation working correctly."
    else:
        improvement_summary = "Implementation failed some tests. Review test output for details."
    
    comparison = {
        "passed_gate": passed_gate,
        "improvement_summary": improvement_summary
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


def main():
    """Main entry point."""
    # Create reports directory
    REPORTS.mkdir(parents=True, exist_ok=True)
    
    # Run evaluation
    report = run_evaluation()
    
    # Write JSON report
    report_path = REPORTS / "latest.json"
    report_path.write_text(json.dumps(report, indent=2))
    
    # Print summary to terminal
    print_summary(report)
    
    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
