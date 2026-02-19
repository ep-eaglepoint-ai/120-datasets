import os
import sys
import json
import subprocess
import platform
import socket
from datetime import datetime
from pathlib import Path

def get_git_info():
    try:
        commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], stderr=subprocess.STDOUT).decode().strip()
    except Exception:
        commit = "unknown"
    try:
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stderr=subprocess.STDOUT).decode().strip()
    except Exception:
        branch = "unknown"
    return commit, branch

def get_environment_info():
    commit, branch = get_git_info()
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": socket.gethostname(),
        "git_commit": commit,
        "git_branch": branch
    }

def run_tests():
    pytest_cmd = [sys.executable, "-m", "pytest"]
    
    report_file = os.path.abspath("temp_pytest_report.json")
    
    cmd = pytest_cmd + [
        "tests/",
        "--json-report",
        f"--json-report-file={report_file}",
        "-v"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
        
        tests = []
        summary = {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0}
        
        if os.path.exists(report_file):
            with open(report_file, 'r') as f:
                data = json.load(f)
            
            summary = {
                "total": data.get("summary", {}).get("total", 0),
                "passed": data.get("summary", {}).get("passed", 0),
                "failed": data.get("summary", {}).get("failed", 0) + data.get("summary", {}).get("xfailed", 0),
                "errors": data.get("summary", {}).get("errors", 0),
                "skipped": data.get("summary", {}).get("skipped", 0)
            }
            
            for t in data.get("tests", []):
                tests.append({
                    "nodeid": t.get("nodeid"),
                    "name": t.get("nodeid").split("::")[-1],
                    "outcome": t.get("outcome")
                })
            
            os.remove(report_file)
        
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "tests": tests,
            "summary": summary,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": 2,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 1, "skipped": 0},
            "stdout": "",
            "stderr": str(e)
        }

def generate_evaluation_report():
    start_time = datetime.now()
    run_id = os.urandom(4).hex()
    
    print(f"Starting Evaluation Run: {run_id}")
    
    after_results = run_tests()
    
    finish_time = datetime.now()
    duration = (finish_time - start_time).total_seconds()
    
    report = {
        "run_id": run_id,
        "started_at": start_time.isoformat(),
        "finished_at": finish_time.isoformat(),
        "duration_seconds": duration,
        "success": after_results["success"],
        "error": None if after_results["success"] else "One or more tests failed in repository_after",
        "environment": get_environment_info(),
        "results": {
            "before": None, 
            "after": after_results,
            "comparison": {
                "after_tests_passed": after_results["success"],
                "after_total": after_results["summary"]["total"],
                "after_passed": after_results["summary"]["passed"],
                "after_failed": after_results["summary"]["failed"]
            }
        }
    }
    
    output_dir = Path(f"evaluation/{start_time.strftime('%Y-%m-%d/%H-%M-%S')}")
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "report.json"
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    after_overall = "PASSED" if after_results['success'] else "FAILED"

    print("\n" + "="*60)
    print("EVALUATION SUMMARY")
    print("="*60)
    print(f"Implementation Check (repository_after):")
    print(f"  Overall: {after_overall}")
    print(f"  Tests: {after_results['summary']['passed']}/{after_results['summary']['total']} passed")
    print("="*60)
    print(f"Full report saved to: {report_path}")
    
    return 0 if after_results["success"] else 1

if __name__ == "__main__":
    sys.exit(generate_evaluation_report())
