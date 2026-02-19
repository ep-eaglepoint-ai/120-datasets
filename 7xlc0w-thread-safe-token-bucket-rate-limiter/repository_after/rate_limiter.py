"""
Thread-safe Token Bucket Rate Limiter implementation.

This module provides a high-performance, thread-safe rate limiting solution
using the Token Bucket algorithm with lazy refill mechanism.
"""

import threading
import time
from typing import Optional


class RateLimiter:
    """
    A thread-safe rate limiter using the Token Bucket algorithm.
    
    This implementation uses a lazy refill mechanism where tokens are calculated
    on access rather than using background threads. It guarantees O(1) memory
    complexity and handles concurrent requests safely.
    
    Attributes:
        capacity: Maximum number of tokens the bucket can hold.
        refill_rate: Number of tokens added per second.
    """
    
    def __init__(self, capacity: float, refill_rate: float) -> None:
        """
        Initialize the rate limiter.
        
        Args:
            capacity: Maximum number of tokens the bucket can hold (must be > 0).
            refill_rate: Number of tokens added per second (must be > 0).
        
        Raises:
            ValueError: If capacity or refill_rate is not positive.
        """
        if capacity <= 0:
            raise ValueError("Capacity must be positive")
        if refill_rate <= 0:
            raise ValueError("Refill rate must be positive")
        
        self._capacity: float = float(capacity)
        self._refill_rate: float = float(refill_rate)
        self._tokens: float = float(capacity)  # Start with full bucket
        self._last_refill_time: float = time.monotonic()
        self._lock: threading.RLock = threading.RLock()
    
    @property
    def capacity(self) -> float:
        """Return the maximum capacity of the bucket."""
        return self._capacity
    
    @property
    def refill_rate(self) -> float:
        """Return the refill rate (tokens per second)."""
        return self._refill_rate
    
    @property
    def tokens(self) -> float:
        """Return the current number of tokens (after lazy refill)."""
        with self._lock:
            self._refill()
            return self._tokens
    
    def _refill(self) -> None:
        """
        Perform lazy refill of tokens based on elapsed time.
        
        This method calculates how many tokens should be added based on
        the time elapsed since the last refill. It handles clock adjustments
        gracefully by ignoring negative time deltas.
        
        Note: This method assumes the lock is already held.
        """
        current_time = time.monotonic()
        time_delta = current_time - self._last_refill_time
        
        # Handle negative time delta (clock adjustment) gracefully
        # Simply update the timestamp without adding tokens
        if time_delta < 0:
            self._last_refill_time = current_time
            return
        
        # Calculate tokens to add based on elapsed time
        tokens_to_add = time_delta * self._refill_rate
        
        # Add tokens but never exceed capacity
        self._tokens = min(self._capacity, self._tokens + tokens_to_add)
        
        # Update last refill time
        self._last_refill_time = current_time
    
    def allow_request(self, tokens: float = 1.0) -> bool:
        """
        Attempt to consume tokens from the bucket.
        
        This method is thread-safe and non-blocking. It performs a lazy refill
        before checking token availability and atomically consumes tokens if
        available.
        
        Args:
            tokens: Number of tokens to consume (default: 1.0, must be > 0).
        
        Returns:
            True if the request is allowed (tokens consumed), False otherwise.
        
        Raises:
            ValueError: If tokens is not positive.
        """
        if tokens <= 0:
            raise ValueError("Tokens to consume must be positive")
        
        with self._lock:
            # Perform lazy refill
            self._refill()
            
            # Check if enough tokens are available
            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            
            return False
    
    def try_acquire(self, tokens: float = 1.0) -> bool:
        """
        Alias for allow_request for API compatibility.
        
        Args:
            tokens: Number of tokens to consume (default: 1.0).
        
        Returns:
            True if tokens were acquired, False otherwise.
        """
        return self.allow_request(tokens)
    
    def get_state(self) -> dict:
        """
        Return the current state of the rate limiter.
        
        Returns:
            Dictionary containing capacity, refill_rate, and current tokens.
        """
        with self._lock:
            self._refill()
            return {
                "capacity": self._capacity,
                "refill_rate": self._refill_rate,
                "tokens": self._tokens,
            }
    
    def reset(self) -> None:
        """Reset the bucket to full capacity."""
        with self._lock:
            self._tokens = self._capacity
            self._last_refill_time = time.monotonic()
