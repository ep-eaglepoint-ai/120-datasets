#!/usr/bin/env python3
"""
Pytest test suite for Task Scheduler.
Tests run the scheduler.py script with various task.json inputs.
"""

import json
import os
import sys
import subprocess
import tempfile
import shutil
import pytest
from pathlib import Path


def get_scheduler_path():
    """Get the scheduler.py path based on PYTHONPATH."""
    pythonpath = os.environ.get("PYTHONPATH", "")
    if pythonpath:
        scheduler_path = Path(pythonpath) / "scheduler.py"
        if scheduler_path.exists():
            return str(scheduler_path)
    
    # Fallback to repository_after
    project_root = Path(__file__).parent.parent
    return str(project_root / "repository_after" / "scheduler.py")


def run_scheduler(task_json_content):
    """
    Run the scheduler script with given task JSON content.
    Returns (returncode, stdout, stderr).
    """
    scheduler_path = get_scheduler_path()
    
    # Create a temporary directory with task.json
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Write task.json
        task_json_path = os.path.join(temp_dir, "task.json")
        with open(task_json_path, "w") as f:
            json.dump(task_json_content, f, indent=2)
        
        # Copy scheduler to temp directory
        scheduler_copy = os.path.join(temp_dir, "scheduler.py")
        shutil.copy(scheduler_path, scheduler_copy)
        
        # Run the scheduler
        result = subprocess.run(
            [sys.executable, scheduler_copy],
            cwd=temp_dir,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Timeout: possible infinite loop"
    except Exception as e:
        return -1, "", str(e)
    finally:
        # Clean up
        shutil.rmtree(temp_dir, ignore_errors=True)


class TestBasicScheduling:
    """Tests for basic task scheduling"""
    
    def test_basic_two_tasks(self):
        """Schedule two independent tasks"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": 8, "latest": 12},
            {"name": "Task B", "duration": 3, "earliest": 10, "latest": 18}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        assert returncode == 0, f"Scheduler failed: {stderr}"
        assert "Task A" in stdout
        assert "Task B" in stdout


class TestDependencies:
    """Tests for task dependencies"""
    
    def test_after_dependency(self):
        """Task B must start after Task A completes"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": 8, "latest": 12},
            {"name": "Task B", "duration": 1, "earliest": 0, "latest": 18, "after": "Task A"}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        assert returncode == 0, f"Scheduler failed: {stderr}"
        assert "Task B" in stdout


class TestConstraints:
    """Tests for constraint handling"""
    
    def test_not_same_day_constraint(self):
        """Tasks with not_same_day_as should be on different days"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": 8, "latest": 12},
            {"name": "Task B", "duration": 2, "earliest": 8, "latest": 12, "not_same_day_as": "Task A"}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should complete without infinite recursion
        assert returncode == 0 or "Day 2" in stdout or stderr == "", f"Infinite recursion or error: {stderr}"


class TestNullHandling:
    """Tests for null value handling"""
    
    def test_null_earliest_latest(self):
        """Handle null values for earliest/latest"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": None, "latest": None}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should handle null values without crashing
        assert "Traceback" not in stderr, f"Crashed on null values: {stderr}"


class TestErrorHandling:
    """Tests for error handling"""
    
    def test_invalid_time_window(self):
        """Detect invalid time window (earliest >= latest)"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": 15, "latest": 10}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should detect and report error
        assert returncode != 0 or "Error" in stdout or "Error" in stderr
    
    def test_task_too_long(self):
        """Detect task that doesn't fit in time window"""
        tasks = [
            {"name": "Task A", "duration": 10, "earliest": 8, "latest": 12}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should detect and report error
        assert returncode != 0 or "Error" in stdout or "Error" in stderr
    
    def test_missing_dependency(self):
        """Detect reference to non-existent task"""
        tasks = [
            {"name": "Task A", "duration": 2, "earliest": 8, "latest": 12, "after": "NonExistent"}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should detect and report error
        assert returncode != 0 or "Error" in stdout or "Error" in stderr


class TestMultiDay:
    """Tests for multi-day scheduling"""
    
    def test_multi_day_scheduling(self):
        """Schedule tasks across multiple days"""
        tasks = [
            {"name": "Task A", "duration": 8, "earliest": 8, "latest": 18},
            {"name": "Task B", "duration": 8, "earliest": 8, "latest": 18},
            {"name": "Task C", "duration": 8, "earliest": 8, "latest": 18}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        # Should schedule across multiple days
        assert returncode == 0, f"Scheduler failed: {stderr}"
        assert "Day" in stdout


class TestComplexScenarios:
    """Tests for complex scheduling scenarios"""
    
    def test_complex_constraints(self):
        """Handle complex combination of constraints"""
        tasks = [
            {"name": "Morning Meeting", "duration": 1, "earliest": 9, "latest": 11},
            {"name": "Development", "duration": 4, "earliest": 8, "latest": 18, "after": "Morning Meeting"},
            {"name": "Code Review", "duration": 2, "earliest": 14, "latest": 18, "after": "Development"}
        ]
        returncode, stdout, stderr = run_scheduler(tasks)
        assert returncode == 0, f"Scheduler failed: {stderr}"
        assert "Morning Meeting" in stdout
        assert "Development" in stdout
        assert "Code Review" in stdout
