import functools
import time
import logging
from typing import Optional, List, Type, Callable, Any
from repository_after.error_handling_lib.errors.base import CategorizedError
from repository_after.error_handling_lib.enums.error_types import ErrorCategory
from repository_after.error_handling_lib.handlers.error_handler import ErrorHandler

logger = logging.getLogger("Decorators")

def safe_execute(error_handler: ErrorHandler, re_raise: bool = False, default_return: Any = None):
    """
    Decorator to safely execute a function, catching CategorizedErrors and
    passing them to the provided ErrorHandler.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except CategorizedError as e:
                error_handler.handle(e)
                if re_raise:
                    raise
                return default_return
            except Exception as e:
                # Let the handler deal with wrapping unknown exceptions if desired,
                # or wrap it here. The handler logic wraps unknown exceptions,
                # so we can just pass it if we want to treat everything safely.
                # However, the requirement says "Catch CategorizedError".
                # To be safe for "production-ready", we should catch all and let handler categorize.
                error_handler.handle(e)
                if re_raise:
                    raise
                return default_return
        return wrapper
    return decorator
