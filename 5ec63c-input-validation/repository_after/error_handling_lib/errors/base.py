import datetime
from typing import Optional, Dict, Any
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity

class CategorizedError(Exception):
    """
    Base class for all categorized errors in the library.
    
    This is the foundation class that all specialized errors inherit from.
    It provides:
    - Consistent error structure across the system
    - Automatic timestamp generation
    - JSON serialization via to_dict()
    - Integration with ErrorHandler
    
    CRITICAL: All specialized errors MUST inherit from this class.
    """
    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        severity: ErrorSeverity,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.severity = severity
        self.details = details or {}  # Additional context information
        # ISO format timestamp for consistent serialization
        self.timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        """
        Returns a dictionary representation of the error, suitable for JSON serialization.
        
        This method is REQUIRED for:
        - Logging and monitoring systems
        - API error responses
        - Error history tracking
        - Statistics and reporting
        
        Returns:
            Dict containing all error information in serializable format
        """
        return {
            "message": self.message,
            "category": self.category.value,  # Convert enum to string
            "severity": self.severity.value,  # Convert enum to string
            "details": self.details,
            "timestamp": self.timestamp
        }