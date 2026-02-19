#!/usr/bin/env python3

"""
Test suite for async_generator module.
Tests verify async generator behavior without real time delays or randomness.
"""

import pytest
import asyncio
import sys
import os

# Determine which module to test based on PYTHONPATH
pythonpath = os.environ.get('PYTHONPATH', '')
if 'repository_before' in pythonpath:
    try:
        from async_generator import async_generator
    except ImportError:
        import importlib
        module = importlib.import_module('async-generator')
        async_generator = getattr(module, 'async_generator')
else:
    from async_generator import async_generator


@pytest.mark.asyncio
async def test_generator_exists():
    """Test that async_generator function exists"""
    assert callable(async_generator)


@pytest.mark.asyncio
async def test_generator_is_async():
    """Test that async_generator is an async function"""
    import inspect
    assert inspect.isasyncgenfunction(async_generator)


@pytest.mark.asyncio
async def test_generator_yields_correct_count():
    """Test that generator yields exactly 10 values"""
    # Mock sleep and random to avoid delays
    async def mock_sleep(delay):
        pass
    
    def mock_random():
        return 0.5
    
    values = []
    try:
        async for value in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            values.append(value)
    except TypeError:
        # repository_before doesn't support these parameters
        pytest.fail("Generator does not support dependency injection parameters")
    
    assert len(values) == 10, f"Expected 10 values, got {len(values)}"


@pytest.mark.asyncio
async def test_generator_yields_floats():
    """Test that all yielded values are floats"""
    async def mock_sleep(delay):
        pass
    
    def mock_random():
        return 0.5
    
    try:
        async for value in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            assert isinstance(value, float), f"Expected float, got {type(value)}"
    except TypeError:
        pytest.fail("Generator does not support dependency injection parameters")


@pytest.mark.asyncio
async def test_generator_values_in_range():
    """Test that values are between 0 and 10"""
    async def mock_sleep(delay):
        pass
    
    def mock_random():
        return 0.5
    
    try:
        async for value in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            assert 0 <= value <= 10, f"Value {value} out of range [0, 10]"
    except TypeError:
        pytest.fail("Generator does not support dependency injection parameters")


@pytest.mark.asyncio
async def test_generator_respects_delay():
    """Test that generator waits for specified delay"""
    sleep_calls = []
    
    async def mock_sleep(delay):
        sleep_calls.append(delay)
    
    def mock_random():
        return 0.5
    
    try:
        async for _ in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            pass
        
        assert len(sleep_calls) == 10, f"Expected 10 sleep calls, got {len(sleep_calls)}"
        assert all(delay == 1.0 for delay in sleep_calls), "All delays should be 1.0 second"
    except TypeError:
        pytest.fail("Generator does not support dependency injection parameters")


@pytest.mark.asyncio
async def test_generator_uses_random_function():
    """Test that generator uses provided random function"""
    async def mock_sleep(delay):
        pass
    
    call_count = [0]
    
    def mock_random():
        call_count[0] += 1
        return 0.5
    
    try:
        async for _ in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            pass
        
        assert call_count[0] == 10, f"Expected 10 random calls, got {call_count[0]}"
    except TypeError:
        pytest.fail("Generator does not support dependency injection parameters")


@pytest.mark.asyncio
async def test_generator_custom_count():
    """Test that generator respects custom count parameter"""
    async def mock_sleep(delay):
        pass
    
    def mock_random():
        return 0.5
    
    values = []
    try:
        async for value in async_generator(
            sleep_func=mock_sleep,
            random_func=mock_random,
            count=5
        ):
            values.append(value)
        
        assert len(values) == 5, f"Expected 5 values, got {len(values)}"
    except TypeError:
        pytest.fail("Generator does not support configurable count parameter")


@pytest.mark.asyncio
async def test_generator_custom_delay():
    """Test that generator respects custom delay parameter"""
    sleep_calls = []
    
    async def mock_sleep(delay):
        sleep_calls.append(delay)
    
    def mock_random():
        return 0.5
    
    try:
        async for _ in async_generator(
            sleep_func=mock_sleep,
            random_func=mock_random,
            delay=0.5
        ):
            pass
        
        assert all(delay == 0.5 for delay in sleep_calls), "All delays should be 0.5 seconds"
    except TypeError:
        pytest.fail("Generator does not support configurable delay parameter")


@pytest.mark.asyncio
async def test_generator_custom_range():
    """Test that generator respects custom min/max values"""
    async def mock_sleep(delay):
        pass
    
    def mock_random():
        return 0.5  # Will be scaled to range
    
    try:
        async for value in async_generator(
            sleep_func=mock_sleep,
            random_func=mock_random,
            min_val=5.0,
            max_val=15.0
        ):
            assert 5.0 <= value <= 15.0, f"Value {value} out of range [5.0, 15.0]"
    except TypeError:
        pytest.fail("Generator does not support configurable range parameters")


@pytest.mark.asyncio
async def test_generator_works_with_asyncio_loop():
    """Test that generator is compatible with asyncio event loops"""
    async def mock_sleep(delay):
        await asyncio.sleep(0)  # Yield control to event loop
    
    def mock_random():
        return 0.5
    
    # This should not raise any exceptions
    values = []
    try:
        async for value in async_generator(sleep_func=mock_sleep, random_func=mock_random):
            values.append(value)
        
        assert len(values) == 10
    except TypeError:
        pytest.fail("Generator does not support dependency injection parameters")
