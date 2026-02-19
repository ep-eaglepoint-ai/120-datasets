# Error Handling Library
# A production-grade Python library for comprehensive error handling and input validation

__version__ = "1.0.0"
__author__ = "Error Handling Library Team"

# Main exports for easy importing
from .enums.error_types import ErrorCategory, ErrorSeverity
from .errors.base import CategorizedError
from .errors.specific_errors import (
    ValidationError, TypeError, RangeError, NetworkError, DatabaseError,
    FileSystemError, AuthError, BusinessLogicError, SystemError, UnknownError
)
from .validators.input_validator import InputValidator
from .handlers.error_handler import ErrorHandler
from .decorators.safe_execute import safe_execute
from .decorators.retry_on_error import retry_on_error

__all__ = [
    # Enums
    'ErrorCategory', 'ErrorSeverity',
    # Base error
    'CategorizedError',
    # Specialized errors
    'ValidationError', 'TypeError', 'RangeError', 'NetworkError', 'DatabaseError',
    'FileSystemError', 'AuthError', 'BusinessLogicError', 'SystemError', 'UnknownError',
    # Validators
    'InputValidator',
    # Handlers
    'ErrorHandler',
    # Decorators
    'safe_execute', 'retry_on_error'
]