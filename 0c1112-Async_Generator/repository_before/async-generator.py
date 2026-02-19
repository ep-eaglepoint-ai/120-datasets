#!/usr/bin/env python3

"""
Module: 0-async_generator

This module provides an asynchronous generator coroutine.
"""
import asyncio
import random
from typing import Generator


async def async_generator() -> Generator[float, None, None]:
    """
    Coroutine that generates random numbers asynchronously.

    The coroutine loops 10 times, each time asynchronously
    waiting for 1 second, and then yields a random number between 0 and 10.

    Yields:
        float: A random number between 0 and 10.

    Usage:
        async def consume_async_generator():
            async for value in async_generator():
                print(value)

        asyncio.run(consume_async_generator())
    """
    for _ in range(10):
        await asyncio.sleep(1)
        yield random.random() * 10
