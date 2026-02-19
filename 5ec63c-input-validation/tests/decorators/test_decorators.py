import pytest
import time
from unittest.mock import patch
from repository_after.error_handling_lib.decorators.safe_execute import safe_execute
from repository_after.error_handling_lib.decorators.retry_on_error import retry_on_error
from repository_after.error_handling_lib.handlers.error_handler import ErrorHandler
from repository_after.error_handling_lib.errors.specific_errors import NetworkError, ValidationError, DatabaseError
from repository_after.error_handling_lib.enums.error_types import ErrorCategory

# Requirement 6: Comprehensive decorator tests for both @safe_execute and @retry_on_error

# @safe_execute tests
def test_safe_execute_catches_error():
    """Test @safe_execute catches errors and passes to handler"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def fail_func():
        raise ValidationError("Oops")
    
    # Should not raise
    result = fail_func()
    assert result is None
    assert handler.stats["total"] == 1

def test_safe_execute_reraise():
    """Test @safe_execute with re_raise=True"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler, re_raise=True)
    def fail_func():
        raise ValidationError("Oops")
    
    with pytest.raises(ValidationError):
        fail_func()
    assert handler.stats["total"] == 1

def test_safe_execute_function_does_not_crash_application():
    """Test that @safe_execute prevents application crashes"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def dangerous_function():
        raise DatabaseError("Critical system failure")
    
    # This should not crash the application
    result = dangerous_function()
    assert result is None
    assert handler.stats["by_severity"]["CRITICAL"] == 1

# @retry_on_error tests
def test_retry_on_error_success_after_retry():
    """Test @retry_on_error succeeds after retries"""
    attempts = 0
    
    @retry_on_error(
        max_retries=2, 
        min_wait=0.01,  # Fast for testing
        backoff_factor=0.01, 
        retryable_categories={ErrorCategory.NETWORK}
    )
    def flaky_func():
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise NetworkError("Temporary failure")
        return "Success"
    
    result = flaky_func()
    assert result == "Success"
    assert attempts == 2

def test_retry_on_error_fails_after_max_retries():
    """Test @retry_on_error fails after max retries"""
    attempts = 0
    
    @retry_on_error(
        max_retries=2, 
        min_wait=0.01,
        backoff_factor=0.01, 
        retryable_categories={ErrorCategory.NETWORK}
    )
    def always_fail():
        nonlocal attempts
        attempts += 1
        raise NetworkError("Persistent failure")
    
    with pytest.raises(NetworkError):
        always_fail()
    assert attempts == 3  # Initial + 2 retries

def test_retry_on_error_respects_retry_categories():
    """Test @retry_on_error only retries specified error categories"""
    attempts = 0
    
    # Only retry NETWORK, but we raise VALIDATION
    @retry_on_error(
        max_retries=2, 
        retryable_categories={ErrorCategory.NETWORK}
    )
    def wrong_error():
        nonlocal attempts
        attempts += 1
        raise ValidationError("Not retryable")
    
    with pytest.raises(ValidationError):
        wrong_error()
    assert attempts == 1  # No retry

def test_retry_on_error_retry_count_respected():
    """Test that retry count is respected"""
    attempts = 0
    
    @retry_on_error(
        max_retries=1,  # Only 1 retry
        min_wait=0.01,
        retryable_categories={ErrorCategory.DATABASE}
    )
    def fail_with_limited_retries():
        nonlocal attempts
        attempts += 1
        raise DatabaseError("Always fails")
    
    with pytest.raises(DatabaseError):
        fail_with_limited_retries()
    
    assert attempts == 2  # Initial + 1 retry

def test_retry_on_error_backoff_logic():
    """Test exponential backoff logic"""
    start_times = []
    
    @retry_on_error(
        max_retries=2,
        min_wait=0.1,
        backoff_factor=2.0,
        retryable_categories={ErrorCategory.NETWORK}
    )
    def timed_failure():
        start_times.append(time.time())
        raise NetworkError("Timing test")
    
    with pytest.raises(NetworkError):
        timed_failure()
    
    # Should have 3 attempts (initial + 2 retries)
    assert len(start_times) == 3
    
    # Check that delays increase (allowing some tolerance for timing)
    delay1 = start_times[1] - start_times[0]
    delay2 = start_times[2] - start_times[1]
    
    # Second delay should be longer than first (exponential backoff)
    assert delay2 > delay1

def test_retry_on_error_final_failure_raises_correct_error():
    """Test that final failure raises the correct error type"""
    @retry_on_error(
        max_retries=1,
        min_wait=0.01,
        retryable_categories={ErrorCategory.NETWORK}
    )
    def specific_error():
        raise NetworkError("Specific network error")
    
    with pytest.raises(NetworkError) as exc_info:
        specific_error()
    
    assert "Specific network error" in str(exc_info.value)
    assert exc_info.value.category == ErrorCategory.NETWORK

def test_retry_on_error_with_error_handler_integration():
    """Test @retry_on_error integration with ErrorHandler"""
    handler = ErrorHandler()
    attempts = 0
    
    @retry_on_error(
        max_retries=2,
        min_wait=0.01,
        handler=handler,
        retryable_categories={ErrorCategory.NETWORK}
    )
    def tracked_retries():
        nonlocal attempts
        attempts += 1
        raise NetworkError(f"Attempt {attempts}")
    
    with pytest.raises(NetworkError):
        tracked_retries()
    
    # Should track all retry attempts
    assert handler.stats["total"] == 3  # Initial + 2 retries
    assert handler.stats["by_category"]["NETWORK"] == 3

def test_retry_on_error_raise_final_false():
    """Test @retry_on_error with raise_final=False"""
    @retry_on_error(
        max_retries=1,
        min_wait=0.01,
        raise_final=False,
        retryable_categories={ErrorCategory.NETWORK}
    )
    def no_final_raise():
        raise NetworkError("Should not be raised")
    
    # Should return None instead of raising
    result = no_final_raise()
    assert result is None

def test_retry_on_error_default_retryable_categories():
    """Test @retry_on_error default retryable categories"""
    attempts = 0
    
    @retry_on_error(max_retries=1, min_wait=0.01)
    def default_categories():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise NetworkError("Network should be retryable by default")
        return "Success"
    
    result = default_categories()
    assert result == "Success"
    assert attempts == 2  # Should have retried

def test_combined_decorators():
    """Test combining @safe_execute and @retry_on_error"""
    handler = ErrorHandler()
    attempts = 0
    
    @safe_execute(error_handler=handler)
    @retry_on_error(max_retries=1, min_wait=0.01, retryable_categories={ErrorCategory.NETWORK}, handler=handler)
    def combined_function():
        nonlocal attempts
        attempts += 1
        raise NetworkError("Always fails")
    
    # Should not raise (safe_execute catches it)
    result = combined_function()
    assert result is None
    
    # Should have attempted retries
    assert attempts == 2  # Initial + 1 retry
    
    # Should be tracked by handler: retry logs 2 attempts + safe_execute logs final
    assert handler.stats["total"] == 3
