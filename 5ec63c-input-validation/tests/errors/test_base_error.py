import pytest
import json
from datetime import datetime
from repository_after.error_handling_lib.errors.base import CategorizedError
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity

# Requirement 3: Base CategorizedError class tests
def test_categorized_error_init_all_fields():
    """Test CategorizedError initialization with all required fields"""
    details = {"field": "value", "code": 123}
    err = CategorizedError("Test message", ErrorCategory.SYSTEM, ErrorSeverity.HIGH, details)
    
    # Verify all required fields are set
    assert err.message == "Test message"
    assert err.category == ErrorCategory.SYSTEM
    assert err.severity == ErrorSeverity.HIGH
    assert err.details == details
    assert err.timestamp is not None
    
    # Verify timestamp format (ISO format)
    datetime.fromisoformat(err.timestamp.replace('Z', '+00:00'))

def test_categorized_error_init_minimal():
    """Test CategorizedError with minimal required parameters"""
    err = CategorizedError("Simple message", ErrorCategory.VALIDATION, ErrorSeverity.LOW)
    
    assert err.message == "Simple message"
    assert err.category == ErrorCategory.VALIDATION
    assert err.severity == ErrorSeverity.LOW
    assert err.details == {}  # Should default to empty dict
    assert err.timestamp is not None

def test_categorized_error_to_dict_complete():
    """Test to_dict() returns serializable dictionary with all fields"""
    details = {"error_code": "E001", "field": "username"}
    err = CategorizedError("Validation failed", ErrorCategory.VALIDATION, ErrorSeverity.MEDIUM, details)
    
    data = err.to_dict()
    
    # Verify all required fields in dictionary
    assert data["message"] == "Validation failed"
    assert data["category"] == "VALIDATION"  # Should be string value
    assert data["severity"] == "MEDIUM"     # Should be string value
    assert data["details"] == details
    assert "timestamp" in data
    
    # Verify dictionary is JSON serializable
    json_str = json.dumps(data)
    assert isinstance(json_str, str)
    
    # Verify deserialization works
    restored = json.loads(json_str)
    assert restored["message"] == "Validation failed"

def test_categorized_error_inheritance():
    """Test that CategorizedError properly inherits from Exception"""
    err = CategorizedError("Test", ErrorCategory.SYSTEM, ErrorSeverity.LOW)
    
    # Should be an Exception
    assert isinstance(err, Exception)
    
    # Should be raisable
    with pytest.raises(CategorizedError) as exc_info:
        raise err
    
    assert str(exc_info.value) == "Test"

def test_categorized_error_to_dict_empty_details():
    """Test to_dict() with empty details"""
    err = CategorizedError("No details", ErrorCategory.UNKNOWN, ErrorSeverity.LOW)
    data = err.to_dict()
    
    assert data["details"] == {}
    assert len(data) == 5  # message, category, severity, details, timestamp
