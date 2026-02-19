#!/usr/bin/env python3

"""
Module: async_generator

This module provides an asynchronous generator coroutine with dependency injection
for testability.
"""
import asyncio
import random
from typing import Generator, Callable, Optional


async def async_generator(
    sleep_func: Optional[Callable] = None,
    random_func: Optional[Callable] = None,
    count: int = 10,
    delay: float = 1.0,
    min_val: float = 0.0,
    max_val: float = 10.0
) -> Generator[float, None, None]:
    """
    Coroutine that generates random numbers asynchronously.

    The coroutine loops a specified number of times, each time asynchronously
    waiting for a specified delay, and then yields a random number within a range.

    Args:
        sleep_func: Optional async sleep function for testing (defaults to asyncio.sleep)
        random_func: Optional random function for testing (defaults to random.random)
        count: Number of values to yield (default: 10)
        delay: Delay in seconds between yields (default: 1.0)
        min_val: Minimum value for random numbers (default: 0.0)
        max_val: Maximum value for random numbers (default: 10.0)

    Yields:
        float: A random number between min_val and max_val.

    Usage:
        async def consume_async_generator():
            async for value in async_generator():
                print(value)

        asyncio.run(consume_async_generator())
    """
    # Use default functions if not provided
    if sleep_func is None:
        sleep_func = asyncio.sleep
    if random_func is None:
        random_func = random.random
    
    for _ in range(count):
        await sleep_func(delay)
        yield random_func() * (max_val - min_val) + min_val
