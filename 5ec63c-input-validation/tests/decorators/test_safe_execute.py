import pytest
from unittest.mock import Mock
from repository_after.error_handling_lib.decorators.safe_execute import safe_execute
from repository_after.error_handling_lib.handlers.error_handler import ErrorHandler
from repository_after.error_handling_lib.errors.specific_errors import ValidationError, NetworkError, DatabaseError
from repository_after.error_handling_lib.enums.error_types import ErrorCategory

# Requirement 6: @safe_execute decorator comprehensive tests

def test_safe_execute_catches_categorized_errors():
    """Test that @safe_execute catches CategorizedError and passes to handler"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def failing_function():
        raise ValidationError("Something went wrong")
    
    # Should not raise exception
    result = failing_function()
    
    # Should return default (None)
    assert result is None
    
    # Should pass error to handler
    assert handler.stats["total"] == 1
    assert handler.stats["by_category"]["VALIDATION"] == 1

def test_safe_execute_catches_unknown_exceptions():
    """Test that @safe_execute catches unknown exceptions and passes to handler"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def failing_function():
        raise ValueError("Regular Python exception")
    
    # Should not raise exception
    result = failing_function()
    
    # Should return default (None)
    assert result is None
    
    # Should pass error to handler (wrapped as UnknownError)
    assert handler.stats["total"] == 1
    assert handler.stats["by_category"]["UNKNOWN"] == 1

def test_safe_execute_with_custom_default_return():
    """Test @safe_execute with custom default return value"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler, default_return="FAILED")
    def failing_function():
        raise ValidationError("Error occurred")
    
    result = failing_function()
    assert result == "FAILED"

def test_safe_execute_with_re_raise_true():
    """Test @safe_execute with re_raise=True still passes to handler but re-raises"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler, re_raise=True)
    def failing_function():
        raise ValidationError("Error occurred")
    
    # Should re-raise the exception
    with pytest.raises(ValidationError):
        failing_function()
    
    # But should still pass to handler
    assert handler.stats["total"] == 1

def test_safe_execute_successful_execution():
    """Test @safe_execute with successful function execution"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def successful_function(x, y):
        return x + y
    
    result = successful_function(2, 3)
    
    # Should return actual result
    assert result == 5
    
    # Should not log any errors
    assert handler.stats["total"] == 0

def test_safe_execute_preserves_function_metadata():
    """Test that @safe_execute preserves original function metadata"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def documented_function(param1, param2):
        """This function has documentation."""
        return param1 * param2
    
    # Should preserve function name and docstring
    assert documented_function.__name__ == "documented_function"

def test_safe_execute_with_args_and_kwargs():
    """Test @safe_execute works with functions that have args and kwargs"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def complex_function(*args, **kwargs):
        if kwargs.get("should_fail"):
            raise NetworkError("Intentional failure")
        return sum(args) + len(kwargs)
    
    # Successful case
    result = complex_function(1, 2, 3, extra=True)
    assert result == 7  # sum(1,2,3) + len({"extra": True})
    
    # Failure case
    result = complex_function(1, 2, should_fail=True)
    assert result is None
    assert handler.stats["total"] == 1

def test_safe_execute_does_not_crash_application():
    """Test that @safe_execute prevents application crashes"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def critical_function():
        # Simulate a critical system error
        raise DatabaseError("Database connection lost")
    
    # This should not crash the application
    result = critical_function()
    
    # Should handle gracefully
    assert result is None
    assert handler.stats["total"] == 1
    assert handler.stats["by_severity"]["CRITICAL"] == 1

def test_safe_execute_error_conversion():
    """Test that @safe_execute properly converts errors to categorized errors"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def function_with_various_errors():
        # This will be wrapped as UnknownError by the handler
        raise KeyError("Missing key")
    
    function_with_various_errors()
    
    # Should be categorized as UNKNOWN
    assert handler.stats["by_category"]["UNKNOWN"] == 1
    
    # Check that error details are preserved
    history = handler.get_history()
    assert "Missing key" in history[0]["message"]

def test_safe_execute_multiple_calls():
    """Test @safe_execute behavior across multiple function calls"""
    handler = ErrorHandler()
    
    @safe_execute(error_handler=handler)
    def sometimes_failing_function(should_fail=False):
        if should_fail:
            raise ValidationError("Validation failed")
        return "success"
    
    # First call succeeds
    result1 = sometimes_failing_function(False)
    assert result1 == "success"
    assert handler.stats["total"] == 0
    
    # Second call fails
    result2 = sometimes_failing_function(True)
    assert result2 is None
    assert handler.stats["total"] == 1
    
    # Third call succeeds again
    result3 = sometimes_failing_function(False)
    assert result3 == "success"
    assert handler.stats["total"] == 1  # Still only one error