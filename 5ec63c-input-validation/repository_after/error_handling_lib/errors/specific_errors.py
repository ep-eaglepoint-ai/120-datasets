from typing import Optional, Dict, Any
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity
from repository_after.error_handling_lib.errors.base import CategorizedError

# IMPORTANT: All specialized error classes MUST inherit from CategorizedError
# Each class automatically sets its appropriate category and default severity

class ValidationError(CategorizedError):
    """Raised when input validation fails"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.VALIDATION, ErrorSeverity.MEDIUM, details)

class TypeError(CategorizedError):
    """Custom TypeError (not Python's built-in) for type validation failures"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.TYPE, ErrorSeverity.MEDIUM, details)

class RangeError(CategorizedError):
    """Raised when values are outside acceptable ranges"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.RANGE, ErrorSeverity.MEDIUM, details)

class NetworkError(CategorizedError):
    """Raised for network connectivity and communication issues"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.NETWORK, ErrorSeverity.HIGH, details)

class DatabaseError(CategorizedError):
    """Raised for database operation failures - CRITICAL severity triggers shutdown"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.DATABASE, ErrorSeverity.CRITICAL, details)

class FileSystemError(CategorizedError):
    """Raised for file system access and operation issues"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.FILE_SYSTEM, ErrorSeverity.HIGH, details)

class AuthError(CategorizedError):
    """Raised for authentication and authorization failures - CRITICAL severity"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.AUTH, ErrorSeverity.CRITICAL, details)

class BusinessLogicError(CategorizedError):
    """Raised when business rules are violated"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.BUSINESS_LOGIC, ErrorSeverity.MEDIUM, details)

class SystemError(CategorizedError):
    """Raised for system-level failures - CRITICAL severity triggers shutdown"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL, details)

class UnknownError(CategorizedError):
    """Used to wrap uncategorized exceptions - LOW severity by default"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, ErrorCategory.UNKNOWN, ErrorSeverity.LOW, details)