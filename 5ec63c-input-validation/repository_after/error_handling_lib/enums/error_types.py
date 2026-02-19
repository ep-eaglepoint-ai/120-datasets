from enum import Enum

class ErrorCategory(str, Enum):
    """
    Categorizes errors into specific domains for better filtering and handling.
    
    These categories are used throughout the system for:
    - Error filtering in ErrorHandler
    - Retry logic in decorators
    - Statistics and reporting
    - Logging organization
    
    IMPORTANT: All categories must match exactly as specified in requirements.
    """
    VALIDATION = "VALIDATION"          # Input validation failures
    TYPE = "TYPE"                      # Type checking failures
    RANGE = "RANGE"                    # Value range violations
    NETWORK = "NETWORK"                # Network connectivity issues
    DATABASE = "DATABASE"              # Database operation failures
    FILE_SYSTEM = "FILE_SYSTEM"        # File system access issues
    AUTH = "AUTH"                      # Authentication/authorization failures
    BUSINESS_LOGIC = "BUSINESS_LOGIC"  # Business rule violations
    SYSTEM = "SYSTEM"                  # System-level errors
    UNKNOWN = "UNKNOWN"                # Uncategorized errors

class ErrorSeverity(str, Enum):
    """
    Defines the severity level of an error to determine the urgency of the response.
    Ordered from lowest to highest urgency.
    
    Used by ErrorHandler for:
    - Filtering errors by minimum severity
    - Determining log levels
    - Triggering shutdown on CRITICAL errors
    - Statistics and alerting
    
    IMPORTANT: Severity levels must match exactly as specified in requirements.
    """
    LOW = "LOW"            # Informational, minimal impact
    MEDIUM = "MEDIUM"      # Warning level, moderate impact
    HIGH = "HIGH"          # Error level, significant impact
    CRITICAL = "CRITICAL"  # Critical level, may trigger shutdown
    
