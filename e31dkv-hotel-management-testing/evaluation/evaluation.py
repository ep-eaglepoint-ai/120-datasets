import subprocess
import json
import os
import sys
import uuid
import platform
from datetime import datetime, timezone
from pathlib import Path

TASK_TITLE = "E31DKV - Hotel Management Testing"

def run_maven_tests(test_type, pom_path):
    """Run Maven tests and return raw result data."""
    cmd = ["mvn", "test", "-f", pom_path]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
            cwd="/app"
        )
        return {
            "return_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "output": result.stdout + result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "return_code": -1,
            "stdout": "",
            "stderr": "Timeout expired",
            "output": "Timeout expired"
        }
    except Exception as e:
        return {
            "return_code": -1,
            "stdout": "",
            "stderr": str(e),
            "output": str(e)
        }

import re

def parse_test_metrics(output, returncode):
    """Parse output to get counts using regex."""
    counts = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0
    }
    
    # Regex to find the summary line:
    # [INFO] Tests run: 22, Failures: 0, Errors: 0, Skipped: 0
    # or just "Tests run: 22, Failures: 0, Errors: 0, Skipped: 0"
    
    # We look for the last occurrence of this pattern to get the final summary
    pattern = r"Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)"
    
    matches = re.findall(pattern, output)
    if matches:
        # Use the last match which usually represents the aggregate or the final module
        # If there are multiple modules, Maven usually prints a final "Total tests run: X, Failures: Y, ..." 
        # but standard `mvn test` on a single module (or reactor) often repeats per module.
        # However, for this specific project structure, we expect one main summary or we can sum them up.
        
        # Let's sum them up to be safe if multiple matches found (e.g. distinct test classes)
        # But wait, Maven prints "Tests run: X..." for EACH test class too.
        # We should NOT sum them if there is a summary line.
        
        # Actually, surefire plugin usually prints a final summary:
        # [INFO] Results:
        # [INFO] 
        # [INFO] Tests run: 22, Failures: 0, Errors: 0, Skipped: 0
        
        # This final summary is what we want. It is typically the LAST match.
        last_match = matches[-1]
        counts["total"] = int(last_match[0])
        counts["failed"] = int(last_match[1])
        counts["errors"] = int(last_match[2])
        counts["skipped"] = int(last_match[3])
        
        counts["passed"] = counts["total"] - counts["failed"] - counts["errors"] - counts["skipped"]
    else:
        print("WARNING: No test summary found in output.")
        # Fallback: look for "Total tests run: X..." if it exists in reactor builds
        pass
        
    return counts



def main():
    start_time = datetime.now(timezone.utc)
    run_id = str(uuid.uuid4())
    
    print(f"Starting evaluation... Run ID: {run_id}")

    # 1. Before State (Mocked)
    before_data = {
        "tests": {"passed": False, "return_code": 0, "output": "No tests available for state 'before'."},
        "metrics": {"test_counts": {"total": 0, "passed": 0, "failed": 0}, "mutation_score": 0.0}
    }

    # 2. After State
    print("Running Meta-Tests (Mutation Analysis)...")
    # This now runs MetaTest.java which performs mutation testing
    meta_run = run_maven_tests("meta", "/app/tests/pom.xml")
    meta_output = meta_run["output"]
    
    # Parse Mutation Metrics from the console output
    mutation_score = 0.0
    killed = 0
    total = 0
    
    score_match = re.search(r"Final Mutation Score:\s*([\d.]+)%", meta_output)
    killed_match = re.search(r"Mutants Killed by Tests:\s*(\d+)", meta_output)
    total_match = re.search(r"Total Generated Mutants:\s*(\d+)", meta_output)
    
    if score_match: mutation_score = float(score_match.group(1))
    if killed_match: killed = int(killed_match.group(1))
    if total_match: total = int(total_match.group(1))

    # Parse standard JUnit metrics as well
    meta_metrics = parse_test_metrics(meta_output, meta_run["return_code"])
    
    after_data = {
        "tests": {
            "passed": meta_run["return_code"] == 0,
            "return_code": meta_run["return_code"],
            "output": meta_output[-2000:]
        },
        "metrics": {
            "test_counts": {
                "total": meta_metrics["total"],
                "passed": meta_metrics["passed"],
                "failed": meta_metrics["failed"] + meta_metrics["errors"]
            },
            "mutation_score": mutation_score,
            "killed_mutants": killed,
            "total_mutants": total
        }
    }

    end_time = datetime.now(timezone.utc)
    duration = (end_time - start_time).total_seconds()
    
    # Success determination
    success = after_data["tests"]["passed"]

    report = {
        "run_id": run_id,
        "started_at": start_time.isoformat().replace("+00:00", "Z"),
        "finished_at": end_time.isoformat().replace("+00:00", "Z"),
        "duration_seconds": duration,
        "environment": {
            "python_version": sys.version.split()[0],
            "platform": sys.platform,
            "arch": platform.machine(),
            "cpus": os.cpu_count()
        },
        "before": before_data,
        "after": after_data,
        "comparison": {
            "passed_gate": success,
            "improvement_summary": "Executed meta tests to verify architectural requirements."
        },
        "success": success,
        "error": None
    }

    # Save Report
    date_str = start_time.strftime("%Y-%m-%d")
    time_str = start_time.strftime("%H-%M-%S")
    report_dir = Path(f"/app/evaluation/reports/{date_str}/{time_str}")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "report.json"
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
        
    print(f"Report saved to: {report_path}")
    
    # Print Summary to Console
    print("\nEvaluation Summary:")
    print(f"Success: {success}")
    print(f"Meta Tests (After): {meta_metrics['passed']}/{meta_metrics['total']} passed")

if __name__ == "__main__":
    main()
