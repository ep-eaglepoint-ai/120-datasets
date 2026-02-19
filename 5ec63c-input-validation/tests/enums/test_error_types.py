import pytest
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity

# Requirement 1: Error Categories - MANDATORY exact match
def test_error_category_all_required_members():
    """Test that ALL required error categories exist with exact names"""
    required_categories = {
        "VALIDATION", "TYPE", "RANGE", "NETWORK", "DATABASE", 
        "FILE_SYSTEM", "AUTH", "BUSINESS_LOGIC", "SYSTEM", "UNKNOWN"
    }
    
    # Verify all required categories exist
    actual_categories = {cat.value for cat in ErrorCategory}
    assert actual_categories == required_categories, f"Missing or extra categories: {actual_categories.symmetric_difference(required_categories)}"
    
    # Verify individual access (case-sensitive)
    assert ErrorCategory.VALIDATION == "VALIDATION"
    assert ErrorCategory.TYPE == "TYPE"
    assert ErrorCategory.RANGE == "RANGE"
    assert ErrorCategory.NETWORK == "NETWORK"
    assert ErrorCategory.DATABASE == "DATABASE"
    assert ErrorCategory.FILE_SYSTEM == "FILE_SYSTEM"
    assert ErrorCategory.AUTH == "AUTH"
    assert ErrorCategory.BUSINESS_LOGIC == "BUSINESS_LOGIC"
    assert ErrorCategory.SYSTEM == "SYSTEM"
    assert ErrorCategory.UNKNOWN == "UNKNOWN"

# Requirement 2: Error Severity - MANDATORY exact match
def test_error_severity_all_required_members():
    """Test that ALL required severity levels exist with exact names"""
    required_severities = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    
    # Verify all required severities exist
    actual_severities = {sev.value for sev in ErrorSeverity}
    assert actual_severities == required_severities, f"Missing or extra severities: {actual_severities.symmetric_difference(required_severities)}"
    
    # Verify individual access (case-sensitive)
    assert ErrorSeverity.LOW == "LOW"
    assert ErrorSeverity.MEDIUM == "MEDIUM"
    assert ErrorSeverity.HIGH == "HIGH"
    assert ErrorSeverity.CRITICAL == "CRITICAL"

def test_enum_consistency():
    """Test that enums are used consistently throughout the system"""
    # Verify enums are string-based for serialization
    assert isinstance(ErrorCategory.VALIDATION.value, str)
    assert isinstance(ErrorSeverity.LOW.value, str)
    
    # Verify enum inheritance
    assert issubclass(ErrorCategory, str)
    assert issubclass(ErrorSeverity, str)
