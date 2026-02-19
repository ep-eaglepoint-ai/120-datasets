import pytest
from repository_after.error_handling_lib.errors.specific_errors import (
    ValidationError, TypeError, RangeError, NetworkError, DatabaseError, 
    FileSystemError, AuthError, BusinessLogicError, SystemError, UnknownError
)
from repository_after.error_handling_lib.errors.base import CategorizedError
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity

# Requirement 3: Specialized Error Classes - ALL must exist and inherit correctly
def test_all_specialized_errors_exist():
    """Test that ALL required specialized error classes exist"""
    # This test will fail if any class is missing
    ValidationError("test")
    TypeError("test")
    RangeError("test")
    NetworkError("test")
    DatabaseError("test")
    FileSystemError("test")
    AuthError("test")
    BusinessLogicError("test")
    SystemError("test")
    UnknownError("test")
    
    assert True  # If we reach here, all classes exist

def test_validation_error_inheritance_and_category():
    """Test ValidationError inherits from base and has correct category"""
    err = ValidationError("Invalid input", details={"field": "email"})
    
    # Must inherit from CategorizedError
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.VALIDATION
    assert err.severity == ErrorSeverity.MEDIUM
    assert err.message == "Invalid input"
    
    # Must support to_dict()
    data = err.to_dict()
    assert data["category"] == "VALIDATION"
    assert data["severity"] == "MEDIUM"

def test_type_error_inheritance_and_category():
    """Test custom TypeError (not Python's built-in)"""
    err = TypeError("Wrong type provided")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.TYPE
    assert err.severity == ErrorSeverity.MEDIUM
    
    # Verify it's our custom TypeError, not Python's
    assert err.__class__.__module__ == "repository_after.error_handling_lib.errors.specific_errors"

def test_range_error_inheritance_and_category():
    """Test RangeError inherits from base and has correct category"""
    err = RangeError("Value out of range")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.RANGE
    assert err.severity == ErrorSeverity.MEDIUM

def test_network_error_inheritance_and_category():
    """Test NetworkError inherits from base and has correct category"""
    err = NetworkError("Connection timeout")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.NETWORK
    assert err.severity == ErrorSeverity.HIGH

def test_database_error_inheritance_and_category():
    """Test DatabaseError inherits from base and has correct category"""
    err = DatabaseError("Connection failed")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.DATABASE
    assert err.severity == ErrorSeverity.CRITICAL

def test_filesystem_error_inheritance_and_category():
    """Test FileSystemError inherits from base and has correct category"""
    err = FileSystemError("File not found")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.FILE_SYSTEM
    assert err.severity == ErrorSeverity.HIGH

def test_auth_error_inheritance_and_category():
    """Test AuthError inherits from base and has correct category"""
    err = AuthError("Unauthorized access")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.AUTH
    assert err.severity == ErrorSeverity.CRITICAL

def test_business_logic_error_inheritance_and_category():
    """Test BusinessLogicError inherits from base and has correct category"""
    err = BusinessLogicError("Business rule violation")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.BUSINESS_LOGIC
    assert err.severity == ErrorSeverity.MEDIUM

def test_system_error_inheritance_and_category():
    """Test SystemError inherits from base and has correct category"""
    err = SystemError("System failure")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.SYSTEM
    assert err.severity == ErrorSeverity.CRITICAL

def test_unknown_error_inheritance_and_category():
    """Test UnknownError inherits from base and has correct category"""
    err = UnknownError("Unexpected error")
    
    assert isinstance(err, CategorizedError)
    assert err.category == ErrorCategory.UNKNOWN
    assert err.severity == ErrorSeverity.LOW

def test_all_errors_support_to_dict():
    """Test that ALL specialized errors support to_dict() method"""
    errors = [
        ValidationError("test"),
        TypeError("test"),
        RangeError("test"),
        NetworkError("test"),
        DatabaseError("test"),
        FileSystemError("test"),
        AuthError("test"),
        BusinessLogicError("test"),
        SystemError("test"),
        UnknownError("test")
    ]
    
    for error in errors:
        data = error.to_dict()
        assert "message" in data
        assert "category" in data
        assert "severity" in data
        assert "timestamp" in data
        assert "details" in data

def test_error_category_override_correctness():
    """Test that each error overrides category correctly"""
    category_mapping = {
        ValidationError: ErrorCategory.VALIDATION,
        TypeError: ErrorCategory.TYPE,
        RangeError: ErrorCategory.RANGE,
        NetworkError: ErrorCategory.NETWORK,
        DatabaseError: ErrorCategory.DATABASE,
        FileSystemError: ErrorCategory.FILE_SYSTEM,
        AuthError: ErrorCategory.AUTH,
        BusinessLogicError: ErrorCategory.BUSINESS_LOGIC,
        SystemError: ErrorCategory.SYSTEM,
        UnknownError: ErrorCategory.UNKNOWN
    }
    
    for error_class, expected_category in category_mapping.items():
        error = error_class("test message")
        assert error.category == expected_category, f"{error_class.__name__} has wrong category"
