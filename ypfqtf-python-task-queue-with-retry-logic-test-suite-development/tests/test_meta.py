"""
Meta-Tests for Task Queue Test Suite
These tests validate the quality and executability of the primary tests.
"""
import subprocess
import sys
import os
import re


class TestMetaDiscovery:
    """Meta-tests for test discovery."""

    def test_primary_test_file_exists(self):
        """Assert that the primary test files exist."""
        base_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after/tests"
        )
        
        # List of expected test files
        expected_files = [
            "test_successful_execution.py",
            "test_retry_backoff.py",
            "test_dead_letter_queue.py",
            "test_timeout_handling.py",
            "test_priority_ordering.py",
            "test_cancellation.py",
            "test_idempotent_enqueue.py",
            "test_backoff_overflow.py",
            "test_concurrent_processing.py",
            "test_worker_recovery.py",
            "test_graceful_shutdown.py",
            "test_process_one.py"
        ]
        
        missing_files = []
        for filename in expected_files:
            test_file = os.path.join(base_path, filename)
            if not os.path.exists(test_file):
                missing_files.append(test_file)
        
        assert len(missing_files) == 0, f"Missing test files: {missing_files}"

    def test_models_file_exists(self):
        """Assert that models.py exists."""
        models_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after",
            "models.py"
        )
        assert os.path.exists(models_file), f"Models file not found: {models_file}"

    def test_queue_file_exists(self):
        """Assert that queue.py exists."""
        queue_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after",
            "queue.py"
        )
        assert os.path.exists(queue_file), f"Queue file not found: {queue_file}"


class TestMetaExecution:
    """Meta-tests for test execution."""

    def test_primary_tests_execute_successfully(self):
        """Run primary tests and verify they complete without errors."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "-v", "--tb=short"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        assert result.returncode == 0, f"Primary tests failed:\n{result.stdout}\n{result.stderr}"

    def test_primary_tests_exit_code_zero(self):
        """Verify primary tests return exit code 0."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        assert result.returncode == 0, f"Exit code was {result.returncode}, expected 0"


class TestMetaInventory:
    """Meta-tests for test inventory."""

    def test_requirement1_tests_present(self):
        """Assert that Requirement 1 tests exist in output."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_successful_task_marks_completed" in output
        assert "test_successful_task_stores_result" in output
        assert "test_handler_called_exactly_once" in output

    def test_requirement2_tests_present(self):
        """Assert that Requirement 2 (retry/backoff) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_failed_task_increments_retry_count" in output
        assert "test_backoff_calculation_exponential" in output

    def test_requirement3_tests_present(self):
        """Assert that Requirement 3 (dead letter queue) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_max_retries_moves_to_dead_letter" in output
        assert "test_dead_letter_contains_full_retry_history" in output

    def test_requirement4_tests_present(self):
        """Assert that Requirement 4 (timeout) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_timeout_triggers_retry" in output
        assert "test_timeout_error_message" in output

    def test_requirement5_tests_present(self):
        """Assert that Requirement 5 (priority) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_high_priority_before_normal" in output
        assert "test_full_priority_ordering" in output

    def test_requirement6_tests_present(self):
        """Assert that Requirement 6 (cancelled tasks) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_cancel_sets_cancelled_status" in output
        assert "test_cancelled_task_handler_not_called" in output

    def test_requirement7_tests_present(self):
        """Assert that Requirement 7 (idempotent) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_duplicate_enqueue_returns_false" in output
        assert "test_duplicate_does_not_modify_existing" in output

    def test_requirement8_tests_present(self):
        """Assert that Requirement 8 (backoff overflow) tests exist."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        output = result.stdout
        assert "test_backoff_high_retry_count_no_exception" in output
        assert "test_backoff_not_infinity" in output


class TestMetaResults:
    """Meta-tests for test results validation."""

    def test_all_primary_tests_pass(self):
        """Verify all primary tests pass."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "-v"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        assert result.returncode == 0, f"Tests failed with return code {result.returncode}"

    def test_no_tests_skipped(self):
        """Verify no tests are skipped unintentionally."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "-v"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        skip_match = re.search(r"(\d+) skipped", result.stdout)
        if skip_match:
            skipped_count = int(skip_match.group(1))
            assert skipped_count == 0, f"{skipped_count} tests were skipped"

    def test_minimum_test_count(self):
        """Verify minimum number of tests exist (at least 20)."""
        repo_after = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "repository_after"
        )
        
        result = subprocess.run(
            [sys.executable, "-m", "pytest", repo_after, "--collect-only", "-q"],
            capture_output=True,
            text=True,
            cwd=repo_after
        )
        
        test_count_match = re.search(r"(\d+) tests? collected", result.stdout)
        if test_count_match:
            test_count = int(test_count_match.group(1))
            assert test_count >= 20, f"Only {test_count} tests found, expected at least 20"
