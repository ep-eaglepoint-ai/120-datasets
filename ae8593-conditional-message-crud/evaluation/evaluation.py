import json
import subprocess
import re
import uuid
from datetime import datetime
import platform
import os
import sys

def get_git_info():
    try:
        commit = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, cwd=os.path.dirname(__file__)).stdout.strip()
        branch = subprocess.run(['git', 'branch', '--show-current'], capture_output=True, text=True, cwd=os.path.dirname(__file__)).stdout.strip()
        return commit, branch
    except:
        return "unknown", "unknown"

def parse_pytest_output(stdout):
    tests = []
    summary = {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0}
    
    lines = stdout.split('\n')
    for line in lines:
        # Match test lines like "tests/test_app.py::TestMessageCRUD::test_create_message PASSED"
        match = re.match(r'(\S+) (\w+)$', line.strip())
        if match:
            nodeid, outcome = match.groups()
            if outcome in ['PASSED', 'FAILED', 'ERROR', 'SKIPPED']:
                name = nodeid.split('::')[-1]
                tests.append({
                    "nodeid": nodeid,
                    "name": name,
                    "outcome": outcome.lower()
                })
                summary[outcome.lower() + 'd' if outcome == 'PASSED' else outcome.lower() + 's'] += 1
                summary['total'] += 1
    
    # Also parse summary line
    summary_match = re.search(r'(\d+) passed(?:, (\d+) failed)?(?:, (\d+) errors)?(?:, (\d+) skipped)?', stdout)
    if summary_match:
        summary['passed'] = int(summary_match.group(1))
        summary['failed'] = int(summary_match.group(2) or 0)
        summary['errors'] = int(summary_match.group(3) or 0)
        summary['skipped'] = int(summary_match.group(4) or 0)
        summary['total'] = summary['passed'] + summary['failed'] + summary['errors'] + summary['skipped']
    
    return tests, summary

def main():
    started_at = datetime.now()
    run_id = uuid.uuid4().hex[:8]
    
    # Run pytest
    env = os.environ.copy()
    env['PYTHONPATH'] = '/app/repository_after'  # Adjust if needed
    project_root = os.path.dirname(os.path.dirname(__file__))
    tests_path = os.path.join(project_root, 'tests')
    result = subprocess.run([sys.executable, '-m', 'pytest', '-v', tests_path], capture_output=True, text=True, env=env, cwd=project_root)
    
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()
    
    success = result.returncode == 0
    error = None if success else result.stderr
    
    # Environment info
    git_commit, git_branch = get_git_info()
    environment = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": git_commit,
        "git_branch": git_branch
    }
    
    # Parse results
    tests, summary = parse_pytest_output(result.stdout)
    
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": duration,
        "success": success,
        "error": error,
        "environment": environment,
        "results": {
            "after": {
                "success": success,
                "exit_code": result.returncode,
                "tests": tests,
                "summary": summary,
                "stdout": result.stdout,
                "stderr": result.stderr
            },
            "comparison": {
                "after_tests_passed": success,
                "after_total": summary["total"],
                "after_passed": summary["passed"],
                "after_failed": summary["failed"]
            }
        }
    }
    
    # Create directory
    date_str = started_at.strftime("%Y-%m-%d")
    time_str = started_at.strftime("%H-%M-%S")
    dir_path = os.path.join(os.path.dirname(__file__), "report", date_str, time_str)
    os.makedirs(dir_path, exist_ok=True)
    
    # Write JSON
    with open(os.path.join(dir_path, "report.json"), 'w') as f:
        json.dump(report, f, indent=2)
    
    print("Tests passed, report generated")

if __name__ == "__main__":
    main()