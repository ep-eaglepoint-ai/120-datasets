

import os
import sys
import json
import uuid
import platform
import subprocess
from datetime import datetime
from pathlib import Path

def generate_run_id():
	return uuid.uuid4().hex[:8]

def get_environment_info():
	return {
		"python_version": platform.python_version(),
		"platform": platform.platform(),
		"os": platform.system(),
		"os_release": platform.release(),
		"architecture": platform.machine(),
		"hostname": platform.node(),
		"git_commit": "unknown",
		"git_branch": "unknown"
	}

def parse_pytest_verbose_output(output):
	tests = []
	lines = output.split('\n')
	for line in lines:
		line_stripped = line.strip()
		if '::' in line_stripped:
			outcome = None
			if ' PASSED' in line_stripped:
				outcome = "passed"
			elif ' FAILED' in line_stripped:
				outcome = "failed"
			elif ' ERROR' in line_stripped:
				outcome = "error"
			elif ' SKIPPED' in line_stripped:
				outcome = "skipped"
			if outcome:
				for status_word in [' PASSED', ' FAILED', ' ERROR', ' SKIPPED']:
					if status_word in line_stripped:
						nodeid = line_stripped.split(status_word)[0].strip()
						break
				tests.append({
					"nodeid": nodeid,
					"name": nodeid.split("::")[-1] if "::" in nodeid else nodeid,
					"outcome": outcome,
				})
	return tests

def run_pytest_with_pythonpath(pythonpath, test_file, label):
	cmd = [
		sys.executable, "-m", "pytest",
		str(test_file),
		"-v",
		"--tb=short",
	]
	env = os.environ.copy()
	env["PYTHONPATH"] = pythonpath
	try:
		result = subprocess.run(
			cmd,
			capture_output=True,
			text=True,
			cwd=str(Path(test_file).parent),
			env=env,
			timeout=120
		)
		stdout = result.stdout
		stderr = result.stderr
		tests = parse_pytest_verbose_output(stdout)
		passed = sum(1 for t in tests if t.get("outcome") == "passed")
		failed = sum(1 for t in tests if t.get("outcome") == "failed")
		errors = sum(1 for t in tests if t.get("outcome") == "error")
		skipped = sum(1 for t in tests if t.get("outcome") == "skipped")
		total = len(tests)
		return {
			"success": result.returncode == 0,
			"exit_code": result.returncode,
			"tests": tests,
			"summary": {
				"total": total,
				"passed": passed,
				"failed": failed,
				"errors": errors,
				"skipped": skipped,
			},
			"stdout": stdout[-3000:] if len(stdout) > 3000 else stdout,
			"stderr": stderr[-1000:] if len(stderr) > 1000 else stderr,
		}
	except subprocess.TimeoutExpired:
		return {
			"success": False,
			"exit_code": -1,
			"tests": [],
			"summary": {"error": "Test execution timed out"},
			"stdout": "",
			"stderr": "",
		}
	except Exception as e:
		return {
			"success": False,
			"exit_code": -1,
			"tests": [],
			"summary": {"error": str(e)},
			"stdout": "",
			"stderr": "",
		}

def run_evaluation():
	run_id = generate_run_id()
	started_at = datetime.now()
	project_root = Path(__file__).parent.parent
	before_pythonpath = str(project_root / "repository_before")
	after_pythonpath = str(project_root / "repository_after")
	test_before = project_root / "tests" / "test_before.py"
	test_after = project_root / "tests" / "test_after.py"
	before_results = run_pytest_with_pythonpath(before_pythonpath, test_before, "before")
	after_results = run_pytest_with_pythonpath(after_pythonpath, test_after, "after")
	comparison = {
		"before_tests_passed": before_results.get("success", False),
		"after_tests_passed": after_results.get("success", False),
		"before_total": before_results.get("summary", {}).get("total", 0),
		"before_passed": before_results.get("summary", {}).get("passed", 0),
		"before_failed": before_results.get("summary", {}).get("failed", 0),
		"after_total": after_results.get("summary", {}).get("total", 0),
		"after_passed": after_results.get("summary", {}).get("passed", 0),
		"after_failed": after_results.get("summary", {}).get("failed", 0),
	}
	finished_at = datetime.now()
	environment = get_environment_info()
	report = {
		"run_id": run_id,
		"started_at": started_at.isoformat(),
		"finished_at": finished_at.isoformat(),
		"duration_seconds": (finished_at - started_at).total_seconds(),
		"success": after_results.get("success", False),
		"error": None if after_results.get("success", False) else "After implementation tests failed",
		"environment": environment,
		"results": {
			"before": before_results,
			"after": after_results,
			"comparison": comparison
		}
	}
	return report

def main():
	project_root = Path(__file__).parent.parent
	reports_dir = project_root / "evaluation" / "reports"
	reports_dir.mkdir(parents=True, exist_ok=True)
	report = run_evaluation()
	now = datetime.now()
	datedir = reports_dir / now.strftime("%Y-%m-%d") / now.strftime("%H-%M-%S")
	datedir.mkdir(parents=True, exist_ok=True)
	path = datedir / "report.json"
	path.write_text(json.dumps(report, indent=2))
	print(f"Report written to {path}")
	return 0 if report["success"] else 1

if __name__ == "__main__":
	sys.exit(main())
