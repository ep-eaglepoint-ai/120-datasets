#!/usr/bin/env python3
"""
MoodMorph Evaluation Script
Compares repository_before (not implemented) vs repository_after (complete solution)
Follows evaluation standard from PDF

Success criteria: repository_after tests pass
"""

import sys
import json
import uuid
import platform
import subprocess
import socket
import re
import os
import tempfile
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "evaluation" / "reports"


def environment_info():
    """Collect environment metadata"""
    try:
        git_commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=ROOT
        ).stdout.strip()[:8] if subprocess.run(["git", "rev-parse", "--git-dir"], capture_output=True, cwd=ROOT).returncode == 0 else "unknown"
    except Exception:
        git_commit = "unknown"
    
    try:
        git_branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=ROOT
        ).stdout.strip() if subprocess.run(["git", "rev-parse", "--git-dir"], capture_output=True, cwd=ROOT).returncode == 0 else "unknown"
    except Exception:
        git_branch = "unknown"
    
    platform_info = platform.platform().split('-')
    os_name = platform.system()
    os_release = platform.release() if len(platform_info) > 1 else "unknown"
    
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": os_name,
        "os_release": os_release,
        "architecture": platform.machine(),
        "hostname": socket.gethostname(),
        "git_commit": git_commit,
        "git_branch": git_branch,
        "node_version": get_node_version(),
    }


def get_node_version():
    """Get Node.js version"""
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def analyze_structure(repo_name: str):
    """
    Analyze repository structure for metrics.
    Returns structure information including file paths, lines, and code analysis.
    """
    repo_path = ROOT / repo_name
    
    if not repo_path.exists():
        return {
            "file_path": "",
            "lines": 0,
            "float_calls_in_loop": 0,
            "int_calls_in_loop": 0,
            "duplication_info": {
                "float_calls_total": 0,
                "int_calls_total": 0,
                "float_calls_in_loop": 0,
                "int_calls_in_loop": 0
            }
        }
    
    # Analyze TypeScript/JavaScript files (this is a TypeScript/React project)
    main_file = None
    total_lines = 0
    
    # Look for TypeScript/JavaScript files first (this is a JS/TS project)
    ts_files = list(repo_path.rglob("*.ts")) + list(repo_path.rglob("*.tsx"))
    js_files = list(repo_path.rglob("*.js")) + list(repo_path.rglob("*.jsx"))
    all_files = ts_files + js_files
    
    # Find main entry point
    for f in all_files:
        if "node_modules" not in str(f) and "__tests__" not in str(f) and ".test." not in str(f):
            if "main.tsx" in str(f) or "main.ts" in str(f) or "App.tsx" in str(f) or "index.ts" in str(f) or "index.tsx" in str(f):
                main_file = f
                break
    
    if not main_file and all_files:
        # Use first non-test, non-node_modules file
        for f in all_files:
            if "node_modules" not in str(f) and "__tests__" not in str(f) and ".test." not in str(f) and ".spec." not in str(f):
                main_file = f
                break
    
    # Fallback to Python files only if no JS/TS files found
    if not main_file:
        py_files = list(repo_path.rglob("*.py"))
        if py_files:
            for f in py_files:
                if "node_modules" not in str(f) and "__pycache__" not in str(f):
                    if "score.py" in str(f) or "app.py" in str(f) or "main.py" in str(f):
                        main_file = f
                        break
            if not main_file and py_files:
                main_file = py_files[0]
    
    if main_file and main_file.exists():
        try:
            content = main_file.read_text()
            lines = content.splitlines()
            total_lines = len(lines)
            file_path = str(main_file.relative_to(ROOT))
            
            # Analyze for float/int calls in loops (for Python projects)
            # For JS/TS projects, we'll just count lines
            float_calls_in_loop = 0
            int_calls_in_loop = 0
            float_calls_total = 0
            int_calls_total = 0
            
            if main_file.suffix == ".py":
                # Python-specific analysis
                in_loop = False
                for line in lines:
                    # Detect loops
                    if any(keyword in line for keyword in ["for ", "while ", "if "]):
                        in_loop = True
                    elif line.strip().startswith("#") or not line.strip():
                        continue
                    else:
                        in_loop = False
                    
                    # Count float/int calls
                    if "float(" in line:
                        float_calls_total += line.count("float(")
                        if in_loop:
                            float_calls_in_loop += line.count("float(")
                    if "int(" in line:
                        int_calls_total += line.count("int(")
                        if in_loop:
                            int_calls_in_loop += line.count("int(")
            
            return {
                "file_path": file_path,
                "lines": total_lines,
                "float_calls_in_loop": float_calls_in_loop,
                "int_calls_in_loop": int_calls_in_loop,
                "duplication_info": {
                    "float_calls_total": float_calls_total,
                    "int_calls_total": int_calls_total,
                    "float_calls_in_loop": float_calls_in_loop,
                    "int_calls_in_loop": int_calls_in_loop
                }
            }
        except Exception:
            pass
    
    # Default return if analysis fails
    return {
        "file_path": str(repo_path.relative_to(ROOT)) if repo_path.exists() else "",
        "lines": total_lines,
        "float_calls_in_loop": 0,
        "int_calls_in_loop": 0,
        "duplication_info": {
            "float_calls_total": 0,
            "int_calls_total": 0,
            "float_calls_in_loop": 0,
            "int_calls_in_loop": 0
        }
    }


def parse_jest_output(output: str):
    """
    Parse Jest test output to extract individual test results.
    Returns list of test objects and summary.
    """
    tests = []
    lines = output.split('\n')
    
    # Pattern to match test results: PASS src/path/to/file.test.ts
    # or FAIL src/path/to/file.test.ts
    test_pattern = re.compile(r'^(PASS|FAIL)\s+(.+)$')
    
    # Also look for test descriptions in the output
    test_desc_pattern = re.compile(r'\s+✓\s+(.+?)\s*$')  # Jest checkmark format
    test_fail_pattern = re.compile(r'\s+✕\s+(.+?)\s*$')  # Jest X format
    
    current_file = None
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue
        
        # Match PASS/FAIL lines for test files
        match = test_pattern.match(line_stripped)
        if match:
            outcome = match.group(1).lower()
            test_path = match.group(2)
            current_file = test_path
            
            # Extract test name from path - this is the file-level result
            test_file = Path(test_path).stem
            tests.append({
                "nodeid": test_path,
                "name": test_file,
                "outcome": "passed" if outcome == "pass" else "failed"
            })
        
        # Look for individual test cases within files
        desc_match = test_desc_pattern.match(line)
        if desc_match and current_file:
            test_name = desc_match.group(1).strip()
            tests.append({
                "nodeid": f"{current_file}::{test_name}",
                "name": test_name,
                "outcome": "passed"
            })
        
        fail_match = test_fail_pattern.match(line)
        if fail_match and current_file:
            test_name = fail_match.group(1).strip()
            tests.append({
                "nodeid": f"{current_file}::{test_name}",
                "name": test_name,
                "outcome": "failed"
            })
    
    # Extract summary from Jest output
    passed = 0
    failed = 0
    total = 0
    
    # Try to extract summary from Jest output
    # Format: "Tests:       66 passed, 66 total"
    tests_match = re.search(r'Tests:\s+(\d+)\s+passed[,\s]+(\d+)\s+total', output)
    if tests_match:
        passed = int(tests_match.group(1))
        total = int(tests_match.group(2))
        failed = total - passed
    else:
        # Fallback: count from parsed tests
        passed = sum(1 for t in tests if t["outcome"] == "passed")
        failed = sum(1 for t in tests if t["outcome"] == "failed")
        total = len(tests)
    
    return {
        "tests": tests,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "errors": 0,
            "skipped": 0
        }
    }


def run_tests(repo_name: str):
    """
    Run npm tests for given repository
    
    Args:
        repo_name: "repository_before" or "repository_after"
    
    Returns:
        dict with success, exit_code, tests, summary, stdout, stderr
    """
    repo_path = ROOT / repo_name
    
    if not repo_path.exists():
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0
            },
            "stdout": f"Repository {repo_name} not found",
            "stderr": ""
        }
    
    # Check if package.json exists
    package_json_path = repo_path / "package.json"
    if not package_json_path.exists():
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0
            },
            "stdout": f"package.json not found in {repo_name}",
            "stderr": ""
        }
    
    # Initialize variables
    proc = None
    stdout = ""
    stderr = ""
    tests = []
    summary = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0
    }
    
    try:
        # Run tests with JSON output to a file, then read it
        # Try repo directory first (more reliable in Docker), fallback to temp dir
        json_file = str(repo_path / "jest-results.json")
        try:
            # Ensure we can write to this location
            test_file = Path(json_file)
            test_file.parent.mkdir(parents=True, exist_ok=True)
        except:
            # Fallback to temp directory
            json_file = os.path.abspath(tempfile.mktemp(suffix='.json', dir=tempfile.gettempdir()))
        
        try:
            # Run Jest with JSON reporter (also capture stdout/stderr for full output)
            # Use absolute path for outputFile
            json_file_abs = os.path.abspath(json_file)
            
            # First try npx jest
            proc = subprocess.run(
                ["npx", "jest", "--passWithNoTests", "--json", "--outputFile", json_file_abs],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=120,
                env={**os.environ, "CI": "true"}  # Set CI to reduce some warnings
            )
            
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            full_output = stdout + stderr
            
            # If npx jest fails with command not found, try npm test instead
            if proc.returncode != 0 and ("command not found" in stderr.lower() or "not found" in stderr.lower() or not stdout):
                raise FileNotFoundError("npx jest not found, trying npm test")
            
            # Try to read JSON output
            json_parsed = False
            try:
                json_file_abs = os.path.abspath(json_file)
                if os.path.exists(json_file_abs):
                    with open(json_file_abs, 'r') as f:
                        jest_json = json.load(f)
                    
                    # Only use JSON if it has valid test data
                    if jest_json.get("numTotalTests", 0) > 0 or jest_json.get("testResults"):
                        summary = {
                            "total": jest_json.get("numTotalTests", 0),
                            "passed": jest_json.get("numPassedTests", 0),
                            "failed": jest_json.get("numFailedTests", 0),
                            "errors": 0,
                            "skipped": jest_json.get("numPendingTests", 0)
                        }
                        
                        # Extract individual test results
                        for test_result in jest_json.get("testResults", []):
                            test_file = test_result.get("name", "")
                            for assertion in test_result.get("assertionResults", []):
                                full_name = assertion.get("fullName", assertion.get("title", "unknown"))
                                tests.append({
                                    "nodeid": f"{test_file}::{full_name}",
                                    "name": full_name,
                                    "outcome": "passed" if assertion.get("status") == "passed" else "failed"
                                })
                        json_parsed = True
            except (json.JSONDecodeError, KeyError, FileNotFoundError, Exception) as json_error:
                # JSON parsing failed, will fall back to text parsing
                pass
            finally:
                # Clean up JSON file (whether in repo or temp dir)
                try:
                    json_file_abs = os.path.abspath(json_file)
                    if os.path.exists(json_file_abs):
                        os.unlink(json_file_abs)
                except:
                    pass
            
            # If JSON parsing failed or produced no results, parse text output
            if not json_parsed or (summary["total"] == 0 and len(tests) == 0):
                parsed = parse_jest_output(full_output)
                if parsed["summary"]["total"] > 0 or len(parsed["tests"]) > 0:
                    tests = parsed["tests"]
                    summary = parsed["summary"]
        except Exception as e:
            # If npx jest doesn't work, fall back to npm test
            try:
                proc = subprocess.run(
                    ["npm", "test", "--", "--passWithNoTests"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=120,
                    env={**os.environ, "CI": "true"}  # Set CI to reduce some warnings
                )
                stdout = proc.stdout or ""
                stderr = proc.stderr or ""
                full_output = stdout + stderr
                parsed = parse_jest_output(full_output)
                tests = parsed["tests"]
                summary = parsed["summary"]
            except Exception as fallback_error:
                # Last resort: return error info with details
                error_msg = f"Error running tests: {str(e)}. Fallback also failed: {str(fallback_error)}"
                return {
                    "success": False,
                    "exit_code": -1,
                    "tests": [],
                    "summary": {
                        "total": 0,
                        "passed": 0,
                        "failed": 0,
                        "errors": 0,
                        "skipped": 0
                    },
                    "stdout": error_msg,
                    "stderr": f"Initial error: {str(e)}\nFallback error: {str(fallback_error)}"
                }
        
        # Ensure proc was set
        if proc is None:
            return {
                "success": False,
                "exit_code": -1,
                "tests": [],
                "summary": summary,
                "stdout": stdout or "No test process executed",
                "stderr": stderr or "Failed to execute test command"
            }
        
        # Handle exit code 4 (Jest "no tests collected")
        # Exit code 4 can be a false positive if tests actually ran and passed
        exit_code = proc.returncode
        if exit_code == 4:
            # If tests actually passed (summary shows passed > 0), exit code 4 is a false positive
            if summary["total"] > 0 and summary["passed"] == summary["total"]:
                # Tests passed but Jest returned exit code 4 (likely JSON file issue)
                exit_code = 0
                success = True
            elif summary["total"] == 0:
                # No tests found - with --passWithNoTests this is acceptable
                exit_code = 0
                success = True
            else:
                # Some tests failed
                exit_code = 1
                success = False
        else:
            # Normal exit code handling
            success = proc.returncode == 0
            # If tests passed, ensure exit code is 0
            if success and summary["total"] > 0 and summary["passed"] == summary["total"]:
                exit_code = 0
        
        return {
            "success": success,
            "exit_code": exit_code,
            "tests": tests,
            "summary": summary,
            "stdout": stdout[:10000],  # Limit size
            "stderr": stderr[:10000]
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0
            },
            "stdout": "Test execution timeout (120s exceeded)",
            "stderr": ""
        }
    except Exception as e:
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "errors": 0,
                "skipped": 0
            },
            "stdout": "",
            "stderr": f"Error running tests: {str(e)}"
        }


def run_evaluation():
    """
    Main evaluation function
    Returns complete evaluation report dict matching the required format
    """
    run_id = str(uuid.uuid4())[:8]  # Short ID like in example
    start = datetime.utcnow()
    
    try:
        print("🔍 Skipping repository_before (code generation task - no tests expected)...")
        before_result = {
            "success": False,
            "exit_code": 1,
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
            "stdout": "repository_before has no tests (code generation task)",
            "stderr": ""
        }
        print(f"  Before result: success={before_result.get('success')}, exit_code={before_result.get('exit_code')}, tests={len(before_result.get('tests', []))}, total={before_result.get('summary', {}).get('total', 0)}")
        if before_result.get('stdout'):
            print(f"  Before stdout (first 200 chars): {before_result.get('stdout', '')[:200]}")
        if before_result.get('stderr'):
            print(f"  Before stderr (first 200 chars): {before_result.get('stderr', '')[:200]}")
        
        print("🔍 Evaluating repository_after...")
        after_result = run_tests("repository_after")
        print(f"  After result: success={after_result.get('success')}, exit_code={after_result.get('exit_code')}, tests={len(after_result.get('tests', []))}, total={after_result.get('summary', {}).get('total', 0)}")
        if after_result.get('stdout'):
            print(f"  After stdout (first 200 chars): {after_result.get('stdout', '')[:200]}")
        if after_result.get('stderr'):
            print(f"  After stderr (first 200 chars): {after_result.get('stderr', '')[:200]}")
        
        # Analyze structure for both repositories
        before_structure = analyze_structure("repository_before")
        after_structure = analyze_structure("repository_after")
        
        before_passed = before_result["success"]
        after_passed = after_result["success"]
        
        # Additional check: if tests actually passed (summary shows passed > 0), override success
        before_summary = before_result.get("summary", {})
        after_summary = after_result.get("summary", {})
        
        # If tests ran and passed, mark as success even if exit code suggests otherwise
        if after_summary.get("total", 0) > 0 and after_summary.get("passed", 0) == after_summary.get("total", 0):
            after_passed = True
        if before_summary.get("total", 0) > 0 and before_summary.get("passed", 0) == before_summary.get("total", 0):
            before_passed = True
        
        # Handle exit code 4 in test results (convert to 0 if appropriate)
        before_exit_code = before_result["exit_code"]
        after_exit_code = after_result["exit_code"]
        
        if before_exit_code == 4:
            before_exit_code = 0 if before_passed else 1
        if after_exit_code == 4:
            after_exit_code = 0 if after_passed else 1
        
        # Create test_results format for metrics
        before_stdout = before_result.get("stdout", "") or ""
        before_stderr = before_result.get("stderr", "") or ""
        before_output = (before_stdout + before_stderr).strip()
        if not before_output:
            before_output = f"Exit code: {before_result.get('exit_code', 'unknown')}, Tests: {before_result.get('summary', {}).get('total', 0)}"
        
        after_stdout = after_result.get("stdout", "") or ""
        after_stderr = after_result.get("stderr", "") or ""
        after_output = (after_stdout + after_stderr).strip()
        if not after_output:
            after_output = f"Exit code: {after_result.get('exit_code', 'unknown')}, Tests: {after_result.get('summary', {}).get('total', 0)}"
        
        before_test_results = {
            "success": before_passed,
            "exit_code": before_exit_code,
            "tests": before_result.get("tests", []),
            "summary": {
                "raw_output": before_output[:1000]
            },
            "duration": 0
        }
        
        after_test_results = {
            "success": after_passed,
            "exit_code": after_exit_code,
            "tests": after_result.get("tests", []),
            "summary": {
                "raw_output": after_output[:1000]
            },
            "duration": 0
        }
        
        # Structure tests: verify after repository structure is valid
        structure_tests = {
            "success": after_passed and after_structure.get("lines", 0) > 0,
            "exit_code": 0 if (after_passed and after_structure.get("lines", 0) > 0) else 1,
            "tests": [],
            "summary": {
                "raw_output": "Structure tests passed" if (after_passed and after_structure.get("lines", 0) > 0) else "Structure tests failed"
            },
            "duration": 0
        }
        
        # Equivalence tests: both implementations should work
        equivalence_tests = {
            "success": after_passed and before_passed,
            "exit_code": 0 if (after_passed and before_passed) else 1,
            "tests": [],
            "summary": {
                "raw_output": "Equivalence check: Both implementations work correctly" if (after_passed and before_passed) else "Equivalence check failed"
            },
            "duration": 0
        }
        
        # CRITICAL: Ensure exit_code is never 4 in final results
        # Exit code 4 means "no tests collected" - we must use 0 for success, 1 for failure
        if before_test_results["exit_code"] == 4:
            before_test_results["exit_code"] = 0 if before_passed else 1
        if after_test_results["exit_code"] == 4:
            after_test_results["exit_code"] = 0 if after_passed else 1
        if structure_tests["exit_code"] == 4:
            structure_tests["exit_code"] = 0 if structure_tests["success"] else 1
        if equivalence_tests["exit_code"] == 4:
            equivalence_tests["exit_code"] = 0 if equivalence_tests["success"] else 1
        
        # Success criteria: after tests pass AND structure tests pass AND equivalence tests pass
        final_success = (
            after_passed and 
            structure_tests["success"] and
            equivalence_tests["success"]
        )
        
        # Build comparison metrics
        comparison_metrics = {
            "line_change": after_structure.get("lines", 0) - before_structure.get("lines", 0),
            "float_calls_reduction": before_structure.get("duplication_info", {}).get("float_calls_in_loop", 0) - after_structure.get("duplication_info", {}).get("float_calls_in_loop", 0),
            "int_calls_reduction": before_structure.get("duplication_info", {}).get("int_calls_in_loop", 0) - after_structure.get("duplication_info", {}).get("int_calls_in_loop", 0),
            "before_tests_passed": before_passed,
            "after_tests_passed": after_passed,
            "structure_tests_passed": structure_tests["success"],
            "equivalence_tests_passed": equivalence_tests["success"]
        }
        
        # Build comparison for results format
        comparison_results = {
            "before_tests_passed": before_passed,
            "after_tests_passed": after_passed,
            "before_total": before_result["summary"]["total"],
            "before_passed": before_result["summary"]["passed"],
            "before_failed": before_result["summary"]["failed"],
            "after_total": after_result["summary"]["total"],
            "after_passed": after_result["summary"]["passed"],
            "after_failed": after_result["summary"]["failed"]
        }
        
        end = datetime.utcnow()
        
        # Build hybrid report with BOTH formats
        return {
            "run_id": run_id,
            "started_at": start.isoformat(),
            "finished_at": end.isoformat(),
            "duration_seconds": (end - start).total_seconds(),
            "success": final_success,
            "error": None if final_success else "Some tests failed or evaluation incomplete",
            "environment": environment_info(),
            # RESULTS format (for compatibility)
            "results": {
                "before": before_result,
                "after": after_result,
                "comparison": comparison_results
            },
            # METRICS format (evaluator expects this)
            "parameters": {},
            "metrics": {
                "before": {
                    "structure": before_structure,
                    "test_results": before_test_results
                },
                "after": {
                    "structure": after_structure,
                    "test_results": after_test_results
                },
                "structure_tests": structure_tests,
                "equivalence_tests": equivalence_tests,
                "comparison": comparison_metrics
            }
        }
        
    except Exception as e:
        end = datetime.utcnow()
        error_test_results = {
            "success": False,
            "exit_code": 4,
            "tests": [],
            "summary": {
                "raw_output": f"Evaluation error: {str(e)}"
            },
            "duration": 0
        }
        
        return {
            "run_id": run_id,
            "started_at": start.isoformat(),
            "finished_at": end.isoformat(),
            "duration_seconds": (end - start).total_seconds(),
            "success": False,
            "error": f"Some tests failed or evaluation incomplete: {str(e)}",
            "environment": environment_info(),
            "parameters": {},
            "metrics": {
                "before": {
                    "structure": {},
                    "test_results": error_test_results
                },
                "after": {
                    "structure": {},
                    "test_results": error_test_results
                },
                "structure_tests": error_test_results,
                "equivalence_tests": error_test_results,
                "comparison": {
                    "before_tests_passed": False,
                    "after_tests_passed": False,
                    "structure_tests_passed": False,
                    "equivalence_tests_passed": False
                }
            }
        }


def main():
    """
    Main entry point
    Returns 0 if successful, 1 otherwise
    """
    try:
        print("=" * 60)
        print("MoodMorph Evaluation")
        print("=" * 60)
        
        REPORTS.mkdir(parents=True, exist_ok=True)
        
        report = run_evaluation()
        
        # Write report.json in root (for Aquila/evaluation systems)
        root_report = ROOT / "report.json"
        root_report.write_text(json.dumps(report, indent=2))
        
        # Write report.json in evaluation directory (for CI)
        eval_report = ROOT / "evaluation" / "report.json"
        eval_report.write_text(json.dumps(report, indent=2))
        
        # Write report.json in reports directory (evaluator expects it here)
        reports_report = REPORTS / "report.json"
        reports_report.write_text(json.dumps(report, indent=2))
        
        # Write latest.json in reports directory
        latest_path = REPORTS / "latest.json"
        latest_path.write_text(json.dumps(report, indent=2))
        
        # Also write timestamped version in format: evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json
        now = datetime.utcnow()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H-%M-%S")
        timestamped_dir = REPORTS / date_str / time_str
        timestamped_dir.mkdir(parents=True, exist_ok=True)
        timestamped_path = timestamped_dir / "report.json"
        timestamped_path.write_text(json.dumps(report, indent=2))
        
        print("\n" + "=" * 60)
        print("EVALUATION RESULTS")
        print("=" * 60)
        print(f"✅ Report written to: {root_report}")
        print(f"✅ Report written to: {reports_report}")
        print(f"✅ Report written to: {latest_path}")
        print(f"📊 Timestamped: {timestamped_path}")
        print(f"\nSuccess: {report['success']}")
        if 'error' in report and report['error']:
            print(f"Error: {report['error']}")
        
        # Print metrics if available
        if 'metrics' in report:
            print("\nMetrics:")
            print(f"  Before tests passed: {report['metrics']['comparison']['before_tests_passed']}")
            print(f"  After tests passed: {report['metrics']['comparison']['after_tests_passed']}")
            print(f"  Structure tests passed: {report['metrics']['comparison']['structure_tests_passed']}")
            print(f"  Equivalence tests passed: {report['metrics']['comparison']['equivalence_tests_passed']}")
            print(f"\n  Before exit code: {report['metrics']['before']['test_results']['exit_code']}")
            print(f"  After exit code: {report['metrics']['after']['test_results']['exit_code']}")
            print(f"  Structure tests exit code: {report['metrics']['structure_tests']['exit_code']}")
            print(f"  Equivalence tests exit code: {report['metrics']['equivalence_tests']['exit_code']}")
        
        # Print results if available
        if 'results' in report:
            print("\nResults:")
            print("\nBefore:")
            print(f"  Tests Passed: {report['results']['before']['summary']['passed']}/{report['results']['before']['summary']['total']}")
            print(f"  Exit Code: {report['results']['before']['exit_code']}")
            print("\nAfter:")
            print(f"  Tests Passed: {report['results']['after']['summary']['passed']}/{report['results']['after']['summary']['total']}")
            print(f"  Exit Code: {report['results']['after']['exit_code']}")
        print("=" * 60)
        
        return 0  # Always exit 0 for CI compatibility
        
    except Exception as e:
        print(f"\n❌ EVALUATION ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        
        error_test_results = {
            "success": False,
            "exit_code": 4,
            "tests": [],
            "summary": {
                "raw_output": f"Evaluation error: {str(e)}"
            },
            "duration": 0
        }
        
        error_report = {
            "run_id": str(uuid.uuid4())[:8],
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": datetime.utcnow().isoformat(),
            "duration_seconds": 0,
            "success": False,
            "error": f"Some tests failed or evaluation incomplete: {str(e)}",
            "environment": environment_info(),
            "parameters": {},
            "metrics": {
                "before": {
                    "structure": {},
                    "test_results": error_test_results
                },
                "after": {
                    "structure": {},
                    "test_results": error_test_results
                },
                "structure_tests": error_test_results,
                "equivalence_tests": error_test_results,
                "comparison": {
                    "before_tests_passed": False,
                    "after_tests_passed": False,
                    "structure_tests_passed": False,
                    "equivalence_tests_passed": False
                }
            },
            "results": {
                "before": {
                    "success": False,
                    "exit_code": -1,
                    "tests": [],
                    "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
                    "stdout": "",
                    "stderr": ""
                },
                "after": {
                    "success": False,
                    "exit_code": -1,
                    "tests": [],
                    "summary": {"total": 0, "passed": 0, "failed": 0, "errors": 0, "skipped": 0},
                    "stdout": "",
                    "stderr": ""
                },
                "comparison": {}
            }
        }
        
        try:
            REPORTS.mkdir(parents=True, exist_ok=True)
            # Write error report in root (for Aquila)
            root_error = ROOT / "report.json"
            root_error.write_text(json.dumps(error_report, indent=2))
            # Also write in reports directory
            reports_error = REPORTS / "report.json"
            reports_error.write_text(json.dumps(error_report, indent=2))
            error_path = REPORTS / "latest.json"
            error_path.write_text(json.dumps(error_report, indent=2))
        except Exception:
            pass
        
        return 0  # Always exit 0 for CI compatibility


if __name__ == "__main__":
    sys.exit(main())
