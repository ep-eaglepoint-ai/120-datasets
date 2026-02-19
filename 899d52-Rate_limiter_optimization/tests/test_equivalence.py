"""
Equivalence tests to verify before and after implementations
have compatible API structure.
"""
import pytest

from repository_before.rate_limiter import RateLimiter as BeforeLimiter
from repository_after.rate_limiter import RateLimiter as AfterLimiter


def test_class_name_matches():
    """Both should be named RateLimiter."""
    assert BeforeLimiter.__name__ == AfterLimiter.__name__ == "RateLimiter"


def test_allow_request_method_exists_on_class():
    """Both classes should have allow_request method."""
    assert hasattr(BeforeLimiter, 'allow_request')
    assert hasattr(AfterLimiter, 'allow_request')
    assert callable(getattr(BeforeLimiter, 'allow_request'))
    assert callable(getattr(AfterLimiter, 'allow_request'))


def test_allow_request_signature_compatible():
    """Both allow_request methods should accept user_id parameter."""
    import inspect
    
    before_sig = inspect.signature(BeforeLimiter.allow_request)
    after_sig = inspect.signature(AfterLimiter.allow_request)
    
    # Both should have at least 'self' and 'user_id' parameters
    before_params = list(before_sig.parameters.keys())
    after_params = list(after_sig.parameters.keys())
    
    assert 'self' in before_params
    assert 'user_id' in before_params
    assert 'self' in after_params
    assert 'user_id' in after_params