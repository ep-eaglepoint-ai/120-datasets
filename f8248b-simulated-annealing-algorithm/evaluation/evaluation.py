#!/usr/bin/env python3
"""
Evaluation runner for Simulated Annealing Algorithm.

This evaluation script:
- Runs pytest tests on the tests/ folder for the simulated annealing implementation
- Collects individual test results with pass/fail status
- Generates structured reports with environment metadata

Run with:
    docker compose run --rm app python evaluation/evaluation.py [options]
    
    OR locally:
    python evaluation/evaluation.py
"""
import os
import sys
import json
import uuid
import platform
import subprocess
from datetime import datetime
from pathlib import Path


def generate_run_id():
    """Generate a short unique run ID."""
    return uuid.uuid4().hex[:8]


def get_git_info():
    """Get git commit and branch information."""
    git_info = {"git_commit": "unknown", "git_branch": "unknown"}
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info["git_commit"] = result.stdout.strip()[:8]
    except Exception:
        pass
    
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info["git_branch"] = result.stdout.strip()
    except Exception:
        pass
    
    return git_info


def get_environment_info():
    """Collect environment information for the report."""
    git_info = get_git_info()
    
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "os": platform.system(),
        "os_release": platform.release(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "git_commit": git_info["git_commit"],
        "git_branch": git_info["git_branch"],
    }


def run_pytest_tests(tests_dir, test_file, label):
    """
    Run pytest on a specific test file.
    
    Args:
        tests_dir: Path to the tests directory
        test_file: Name of the test file (e.g., "test_simulation.py")
        label: Label for this test run
    
    Returns:
        dict with test results
    """
    print(f"\n{'=' * 60}")
    print(f"RUNNING TESTS: {label.upper()}")
    print(f"{'=' * 60}")
    print(f"Test file: {test_file}")
    
    test_path = Path(tests_dir) / test_file
    
    # Build pytest command
    cmd = [
        sys.executable, "-m", "pytest",
        str(test_path),
        "-v",
        "--tb=short",
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(Path(tests_dir).parent),
            timeout=120
        )
        
        stdout = result.stdout
        stderr = result.stderr
        
        # Parse verbose output to get test results
        tests = parse_pytest_verbose_output(stdout)
        
        # Count results
        passed = sum(1 for t in tests if t.get("outcome") == "passed")
        failed = sum(1 for t in tests if t.get("outcome") == "failed")
        errors = sum(1 for t in tests if t.get("outcome") == "error")
        skipped = sum(1 for t in tests if t.get("outcome") == "skipped")
        total = len(tests)
        
        print(f"\nResults: {passed} passed, {failed} failed, {errors} errors, {skipped} skipped (total: {total})")
        
        # Print individual test results
        for test in tests:
            status_icon = {
                "passed": "✅",
                "failed": "❌",
                "error": "💥",
                "skipped": "⏭️"
            }.get(test.get("outcome"), "❓")
            print(f"  {status_icon} {test.get('nodeid', 'unknown')}: {test.get('outcome', 'unknown')}")
        
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
        print("❌ Test execution timed out")
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"error": "Test execution timed out"},
            "stdout": "",
            "stderr": "",
        }
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return {
            "success": False,
            "exit_code": -1,
            "tests": [],
            "summary": {"error": str(e)},
            "stdout": "",
            "stderr": "",
        }


def parse_pytest_verbose_output(output):
    """Parse pytest verbose output to extract test results."""
    tests = []
    lines = output.split('\n')
    
    for line in lines:
        line_stripped = line.strip()
        
        # Match lines like: tests/test_simulation.py::TestClass::test_name PASSED
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
                # Extract nodeid (everything before the status)
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


def run_algorithm_validation():
    """
    Run algorithm validation to ensure simulated annealing converges correctly.
    
    Returns:
        dict with validation results
    """
    print(f"\n{'=' * 60}")
    print("ALGORITHM VALIDATION")
    print(f"{'=' * 60}")
    
    try:
        # Add repository_after to path
        project_root = Path(__file__).parent.parent
        sys.path.insert(0, str(project_root / "repository_after"))
        
        import numpy as np
        from simulation import objective_function, simulated_annealing
        
        # Run simulated annealing multiple times and check convergence
        validation_runs = []
        np.random.seed(42)
        
        for i in range(5):
            best_state, best_energy = simulated_annealing(
                objective_function,
                bounds=(-5.12, 5.12),
                n_iterations=1000,
                initial_temp=100.0,
                cooling_rate=0.995,
                step_size=0.3
            )
            
            validation_runs.append({
                "run": i + 1,
                "best_state": best_state.tolist(),
                "best_energy": float(best_energy),
                "converged_near_optimum": bool(best_energy < 20.0)  # Explicitly convert to Python bool
            })
            
            status = "✅" if best_energy < 20.0 else "⚠️"
            print(f"  {status} Run {i+1}: best_energy = {best_energy:.4f}")
        
        # Calculate statistics
        energies = [r["best_energy"] for r in validation_runs]
        convergence_rate = sum(1 for r in validation_runs if r["converged_near_optimum"]) / len(validation_runs)
        
        validation_passed = convergence_rate >= 0.8  # At least 80% should converge
        
        print(f"\nConvergence rate: {convergence_rate * 100:.1f}%")
        print(f"Mean best energy: {np.mean(energies):.4f}")
        print(f"Min best energy: {np.min(energies):.4f}")
        print(f"Validation: {'✅ PASSED' if validation_passed else '❌ FAILED'}")
        
        return {
            "success": validation_passed,
            "runs": validation_runs,
            "statistics": {
                "convergence_rate": convergence_rate,
                "mean_energy": float(np.mean(energies)),
                "min_energy": float(np.min(energies)),
                "max_energy": float(np.max(energies)),
                "std_energy": float(np.std(energies)),
            }
        }
        
    except Exception as e:
        import traceback
        print(f"❌ Validation error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "runs": [],
            "statistics": {}
        }


def run_evaluation():
    """
    Run complete evaluation for simulated annealing implementation.
    
    The evaluation includes:
    - Unit tests for all components (objective function, neighbor generation, 
      acceptance probability, main algorithm)
    - Algorithm validation runs to verify convergence behavior
    
    Returns dict with test results.
    """
    print(f"\n{'=' * 60}")
    print("SIMULATED ANNEALING ALGORITHM EVALUATION")
    print(f"{'=' * 60}")
    
    project_root = Path(__file__).parent.parent
    tests_dir = project_root / "tests"
    
    # Run unit tests
    test_results = run_pytest_tests(
        tests_dir,
        "test_simulation.py",
        "Unit Tests for Simulated Annealing"
    )
    
    # Run algorithm validation
    validation_results = run_algorithm_validation()
    
    # Build summary
    tests_passed = test_results.get("success", False)
    validation_passed = validation_results.get("success", False)
    
    # Print summary
    print(f"\n{'=' * 60}")
    print("EVALUATION SUMMARY")
    print(f"{'=' * 60}")
    
    print(f"\nUnit Tests:")
    print(f"  Overall: {'✅ PASSED' if tests_passed else '❌ FAILED'}")
    summary = test_results.get("summary", {})
    print(f"  Tests: {summary.get('passed', 0)}/{summary.get('total', 0)} passed")
    
    print(f"\nAlgorithm Validation:")
    print(f"  Overall: {'✅ PASSED' if validation_passed else '❌ FAILED'}")
    stats = validation_results.get("statistics", {})
    print(f"  Convergence Rate: {stats.get('convergence_rate', 0) * 100:.1f}%")
    print(f"  Mean Best Energy: {stats.get('mean_energy', 'N/A')}")
    
    overall_passed = tests_passed and validation_passed
    
    print(f"\n{'=' * 60}")
    print(f"OVERALL: {'✅ EVALUATION PASSED' if overall_passed else '❌ EVALUATION FAILED'}")
    print(f"{'=' * 60}")
    
    return {
        "unit_tests": test_results,
        "algorithm_validation": validation_results,
        "summary": {
            "unit_tests_passed": tests_passed,
            "validation_passed": validation_passed,
            "overall_passed": overall_passed,
            "total_tests": summary.get("total", 0),
            "tests_passed": summary.get("passed", 0),
            "tests_failed": summary.get("failed", 0),
            "convergence_rate": stats.get("convergence_rate", 0),
        },
        "evaluation_passed": overall_passed,
    }


def generate_output_path():
    """Generate output path in format: evaluation/YYYY-MM-DD/HH-MM-SS/report.json"""
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H-%M-%S")
    
    project_root = Path(__file__).parent.parent
    output_dir = project_root / "evaluation" / date_str / time_str
    output_dir.mkdir(parents=True, exist_ok=True)
    
    return output_dir / "report.json"


def main():
    """Main entry point for evaluation."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run simulated annealing algorithm evaluation")
    parser.add_argument(
        "--output", 
        type=str, 
        default=None, 
        help="Output JSON file path (default: evaluation/YYYY-MM-DD/HH-MM-SS/report.json)"
    )
    
    args = parser.parse_args()
    
    # Generate run ID and timestamps
    run_id = generate_run_id()
    started_at = datetime.now()
    
    print(f"Run ID: {run_id}")
    print(f"Started at: {started_at.isoformat()}")
    
    try:
        results = run_evaluation()
        
        success = results.get("evaluation_passed", False)
        error_message = None if success else "Evaluation did not pass all checks"
        
    except Exception as e:
        import traceback
        print(f"\nERROR: {str(e)}")
        traceback.print_exc()
        results = None
        success = False
        error_message = str(e)
    
    finished_at = datetime.now()
    duration = (finished_at - started_at).total_seconds()
    
    # Collect environment information
    environment = get_environment_info()
    
    # Build report
    report = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round(duration, 6),
        "success": success,
        "error": error_message,
        "environment": environment,
        "results": results,
    }
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = generate_output_path()
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n✅ Report saved to: {output_path}")
    
    print(f"\n{'=' * 60}")
    print(f"EVALUATION COMPLETE")
    print(f"{'=' * 60}")
    print(f"Run ID: {run_id}")
    print(f"Duration: {duration:.2f}s")
    print(f"Success: {'✅ YES' if success else '❌ NO'}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
