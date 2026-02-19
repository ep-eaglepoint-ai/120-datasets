import sys
import os
import pytest
from pathlib import Path

# Remove hardcoded sys.path modifications to rely on evaluation.py's PYTHONPATH setting
import circular_data_processor
import pytest

@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset the global DATA_STORE before and after each test if it exists."""
    if hasattr(circular_data_processor, 'DATA_STORE'):
        circular_data_processor.DATA_STORE.clear()
    yield
    if hasattr(circular_data_processor, 'DATA_STORE'):
        circular_data_processor.DATA_STORE.clear()

def test_data_processor_initialization():
    """
    Test correct initialization.
    Both versions should allow creating a processor with a name.
    """
    processor = circular_data_processor.DataProcessor("TestWorker")
    assert processor.name == "TestWorker"

def test_sync_blocking_task_behavior():
    """
    Test legacy blocking task behavior.
    
    Repository Before: Should have sync_blocking_task and use DATA_STORE.
    Repository After: Should NOT have sync_blocking_task and NOT use DATA_STORE.
    """
    processor = circular_data_processor.DataProcessor("Worker1")
    data = 42
    
    if hasattr(processor, 'sync_blocking_task'):
        # Legacy checks
        assert hasattr(circular_data_processor, 'DATA_STORE'), "Legacy processor implies DATA_STORE exists"
        
        # This is blocking, but we run it
        result = processor.sync_blocking_task(data)
        assert result == f"Finished {data}"
        
        # Assert side effect
        assert len(circular_data_processor.DATA_STORE) == 1
        assert circular_data_processor.DATA_STORE[0] == data
    else:
        # Refactored checks
        # Assert that we DO NOT have the legacy methods or state
        assert not hasattr(circular_data_processor, 'DATA_STORE'), "Refactored code should not have global DATA_STORE"

def test_multiple_blocking_tasks_accumulate_state():
    processor = circular_data_processor.DataProcessor("Worker1")
    
    if hasattr(processor, 'sync_blocking_task'):
        # Legacy checks
        processor.sync_blocking_task(1)
        processor.sync_blocking_task(2)
        processor.sync_blocking_task(3)
        
        assert len(circular_data_processor.DATA_STORE) == 3
        assert circular_data_processor.DATA_STORE == [1, 2, 3]
    else:
        # Refactored checks
        assert not hasattr(processor, 'sync_blocking_task'), "Refactored code should not have sync_blocking_task"
