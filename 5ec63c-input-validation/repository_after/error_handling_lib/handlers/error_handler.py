import logging
from typing import Optional, List, Dict, Callable, Any, Deque
from collections import deque
from collections import defaultdict
from repository_after.error_handling_lib.enums.error_types import ErrorCategory, ErrorSeverity
from repository_after.error_handling_lib.errors.base import CategorizedError
from repository_after.error_handling_lib.errors.specific_errors import UnknownError

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ErrorHandlingLib")
_default_handler = None

class ErrorHandler:
    """
    Centralized error handler for processing, logging, and tracking errors.
    """
    def __init__(
        self,
        min_severity: ErrorSeverity = ErrorSeverity.LOW,
        ignored_categories: Optional[List[ErrorCategory]] = None,
        history_size: int = 100,
        shutdown_callback: Optional[Callable[[], None]] = None
    ):
        self.min_severity_level = self._severity_to_int(min_severity)
        self.ignored_categories = set(ignored_categories) if ignored_categories else set()
        self.history: Deque[Dict[str, Any]] = deque(maxlen=history_size)
        global _default_handler
        if _default_handler is None:
            _default_handler = self
        self.stats = {
            "by_severity": defaultdict(int),
            "by_category": defaultdict(int),
            "total": 0
        }
        self.shutdown_callback = shutdown_callback

    def _severity_to_int(self, severity: ErrorSeverity) -> int:
        mapping = {
            ErrorSeverity.LOW: 10,
            ErrorSeverity.MEDIUM: 20,
            ErrorSeverity.HIGH: 30,
            ErrorSeverity.CRITICAL: 40
        }
        return mapping.get(severity, 0)

    @staticmethod
    def get_default() -> "ErrorHandler":
        global _default_handler
        if _default_handler is None:
            _default_handler = ErrorHandler()
        return _default_handler

    def handle(self, error: Exception, extra_info: Optional[Dict[str, Any]] = None) -> None:
        """
        Process an error: categorize, filter, log, track, and potentially trigger shutdown.
        """
        if not isinstance(error, CategorizedError):
            # Wrap unknown exceptions
            error = UnknownError(f"Uncategorized exception: {str(error)}", details={"original_error": str(type(error))})

        if error.category in self.ignored_categories:
            return

        error_severity_level = self._severity_to_int(error.severity)
        if error_severity_level < self.min_severity_level:
            return

        # Update stats
        self.stats["total"] += 1
        self.stats["by_severity"][error.severity.value] += 1
        self.stats["by_category"][error.category.value] += 1

        # Add to history
        self.history.append(error.to_dict())

        # Log error
        self._log_error(error, extra_info)

        # Check for Critical Shutdown
        if error.severity == ErrorSeverity.CRITICAL:
            self._trigger_shutdown(error)

    def _log_error(self, error: CategorizedError, extra_info: Optional[Dict[str, Any]] = None) -> None:
        details_str = str(error.details)
        if extra_info:
             details_str += f" | Context: {extra_info}"
        log_msg = f"[{error.category.value}] {error.message} (Details: {details_str})"
        if error.severity == ErrorSeverity.CRITICAL:
            logger.critical(log_msg)
        elif error.severity == ErrorSeverity.HIGH:
            logger.error(log_msg)
        elif error.severity == ErrorSeverity.MEDIUM:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

    def _trigger_shutdown(self, error: CategorizedError) -> None:
        logger.critical("CRITICAL ERROR DETECTED. Initiating graceful shutdown.")
        if self.shutdown_callback:
            try:
                self.shutdown_callback()
            except Exception as e:
                logger.error(f"Error during shutdown callback: {e}")
                
        else:
            logger.critical("No shutdown callback provided. Exiting due to critical error.")
            exit(1)

    def get_stats(self) -> Dict[str, Any]:
        """
        Return a copy of the current error statistics.
        """
        return {
            "total": self.stats["total"],
            "by_severity": dict(self.stats["by_severity"]),
            "by_category": dict(self.stats["by_category"])
        }

    def get_history(self) -> List[Dict[str, Any]]:
        """
        Return a list of recent errors.
        """
        return list(self.history)
    
