import pytest
from unittest.mock import Mock, patch
from repository_after.error_handling_lib.handlers.error_handler import ErrorHandler
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity
from repository_after.error_handling_lib.errors.specific_errors import (
    ValidationError, DatabaseError, NetworkError, SystemError, UnknownError
)

# Requirement 5: ErrorHandler comprehensive functionality tests

def test_error_handler_centralized_handling():
    """Test that ErrorHandler provides centralized error handling"""
    handler = ErrorHandler()
    
    # Handle different types of errors
    handler.handle(ValidationError("Invalid input"))
    handler.handle(NetworkError("Connection failed"))
    handler.handle(DatabaseError("DB error"))
    
    # Verify centralized tracking
    assert handler.stats["total"] == 3
    assert handler.stats["by_category"]["VALIDATION"] == 1
    assert handler.stats["by_category"]["NETWORK"] == 1
    assert handler.stats["by_category"]["DATABASE"] == 1

@patch('repository_after.error_handling_lib.handlers.error_handler.logger')
def test_error_handler_logging(mock_logger):
    """Test that ErrorHandler logs errors correctly"""
    handler = ErrorHandler()
    
    # Test different severity levels
    handler.handle(ValidationError("Low priority"))      # MEDIUM -> warning
    handler.handle(NetworkError("High priority"))       # HIGH -> error
    handler.handle(DatabaseError("Critical issue"))     # CRITICAL -> critical
    
    # Verify logging calls
    assert mock_logger.warning.called
    assert mock_logger.error.called
    assert mock_logger.critical.called

def test_error_handler_severity_filtering():
    """Test severity-based filtering"""
    # Only handle HIGH and CRITICAL errors
    handler = ErrorHandler(min_severity=ErrorSeverity.HIGH)
    
    # These should be ignored (below HIGH)
    handler.handle(ValidationError("Medium error"))  # MEDIUM
    handler.handle(UnknownError("Low error"))        # LOW
    assert handler.stats["total"] == 0
    
    # These should be handled (HIGH or above)
    handler.handle(NetworkError("High error"))       # HIGH
    handler.handle(DatabaseError("Critical error"))  # CRITICAL
    assert handler.stats["total"] == 2
    assert handler.stats["by_severity"]["HIGH"] == 1
    assert handler.stats["by_severity"]["CRITICAL"] == 1

def test_error_handler_category_filtering():
    """Test category-based filtering"""
    # Ignore VALIDATION and NETWORK errors
    ignored_categories = [ErrorCategory.VALIDATION, ErrorCategory.NETWORK]
    handler = ErrorHandler(ignored_categories=ignored_categories)
    
    # These should be ignored
    handler.handle(ValidationError("Ignored validation"))
    handler.handle(NetworkError("Ignored network"))
    assert handler.stats["total"] == 0
    
    # This should be handled
    handler.handle(DatabaseError("Not ignored"))
    assert handler.stats["total"] == 1
    assert handler.stats["by_category"]["DATABASE"] == 1

def test_error_handler_combined_filtering():
    """Test combined severity and category filtering"""
    handler = ErrorHandler(
        min_severity=ErrorSeverity.HIGH,
        ignored_categories=[ErrorCategory.NETWORK]
    )
    
    # Should be ignored: wrong severity
    handler.handle(ValidationError("Medium severity"))  # MEDIUM < HIGH
    
    # Should be ignored: wrong category
    handler.handle(NetworkError("High but ignored category"))  # HIGH but NETWORK ignored
    
    # Should be handled: correct severity and not ignored category
    handler.handle(DatabaseError("Critical and allowed"))  # CRITICAL >= HIGH and DATABASE not ignored
    
    assert handler.stats["total"] == 1
    assert handler.stats["by_category"]["DATABASE"] == 1

def test_error_handler_statistics_tracking():
    """Test comprehensive error statistics"""
    handler = ErrorHandler()
    
    # Add various errors
    handler.handle(ValidationError("Error 1"))
    handler.handle(ValidationError("Error 2"))
    handler.handle(NetworkError("Error 3"))
    handler.handle(DatabaseError("Error 4"))
    
    stats = handler.get_stats()
    
    # Verify total count
    assert stats["total"] == 4
    
    # Verify by_severity counts
    assert stats["by_severity"]["MEDIUM"] == 2  # 2 ValidationErrors
    assert stats["by_severity"]["HIGH"] == 1     # 1 NetworkError
    assert stats["by_severity"]["CRITICAL"] == 1 # 1 DatabaseError
    
    # Verify by_category counts
    assert stats["by_category"]["VALIDATION"] == 2
    assert stats["by_category"]["NETWORK"] == 1
    assert stats["by_category"]["DATABASE"] == 1

def test_error_handler_history_tracking():
    """Test error history functionality"""
    handler = ErrorHandler(history_size=3)
    
    # Add errors
    handler.handle(ValidationError("Error 1"))
    handler.handle(NetworkError("Error 2"))
    handler.handle(DatabaseError("Error 3"))
    
    history = handler.get_history()
    assert len(history) == 3
    assert history[0]["message"] == "Error 1"
    assert history[1]["message"] == "Error 2"
    assert history[2]["message"] == "Error 3"
    
    # Add one more (should evict oldest)
    handler.handle(SystemError("Error 4"))
    
    history = handler.get_history()
    assert len(history) == 3  # Still max 3
    assert history[0]["message"] == "Error 2"  # Error 1 evicted
    assert history[2]["message"] == "Error 4"  # New error added

def test_error_handler_graceful_shutdown():
    """Test graceful shutdown on CRITICAL errors"""
    shutdown_called = False
    
    def mock_shutdown():
        nonlocal shutdown_called
        shutdown_called = True
    
    handler = ErrorHandler(shutdown_callback=mock_shutdown)
    
    # Non-critical error should not trigger shutdown
    handler.handle(ValidationError("Not critical"))
    assert shutdown_called is False
    
    # Critical error should trigger shutdown
    handler.handle(DatabaseError("Critical failure"))
    assert shutdown_called is True

def test_error_handler_graceful_shutdown_exception_handling():
    """Test that shutdown callback exceptions are handled gracefully"""
    def failing_shutdown():
        raise Exception("Shutdown failed")
    
    handler = ErrorHandler(shutdown_callback=failing_shutdown)
    
    # Should not raise exception even if shutdown callback fails
    handler.handle(DatabaseError("Critical error"))
    
    # Handler should still function normally
    assert handler.stats["total"] == 1

def test_error_handler_unknown_exception_wrapping():
    """Test that unknown exceptions are wrapped in UnknownError"""
    handler = ErrorHandler()
    
    # Handle a regular Python exception
    regular_exception = ValueError("Regular Python error")
    handler.handle(regular_exception)
    
    # Should be tracked as UNKNOWN category
    assert handler.stats["total"] == 1
    assert handler.stats["by_category"]["UNKNOWN"] == 1
    
    # Check history contains wrapped error
    history = handler.get_history()
    assert "Uncategorized exception" in history[0]["message"]

def test_error_handler_default_instance():
    """Test default handler singleton pattern"""
    # Reset global handler for clean test
    import repository_after.error_handling_lib.handlers.error_handler as eh_module
    eh_module._default_handler = None
    
    handler1 = ErrorHandler.get_default()
    handler2 = ErrorHandler.get_default()
    
    # Should return the same instance
    assert handler1 is handler2
    
    # Should function as normal handler
    handler1.handle(ValidationError("Test error"))
    assert handler2.stats["total"] == 1

def test_error_handler_extra_info_logging():
    """Test that extra_info is included in logging"""
    with patch('repository_after.error_handling_lib.handlers.error_handler.logger') as mock_logger:
        handler = ErrorHandler()
        
        extra_info = {"user_id": "123", "action": "login"}
        handler.handle(ValidationError("Login failed"), extra_info=extra_info)
        
        # Verify extra_info is included in log message
        mock_logger.warning.assert_called_once()
        log_call_args = mock_logger.warning.call_args[0][0]
        assert "Context: {'user_id': '123', 'action': 'login'}" in log_call_args

def test_error_handler_stats_immutability():
    """Test that get_stats() returns a copy, not the original"""
    handler = ErrorHandler()
    handler.handle(ValidationError("Test"))
    
    stats = handler.get_stats()
    original_total = stats["total"]
    
    # Modify returned stats
    stats["total"] = 999
    stats["by_severity"]["FAKE"] = 100
    
    # Original handler stats should be unchanged
    new_stats = handler.get_stats()
    assert new_stats["total"] == original_total
    assert "FAKE" not in new_stats["by_severity"]
