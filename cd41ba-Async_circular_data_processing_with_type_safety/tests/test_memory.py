import pytest
import asyncio
import collections
from circular_data_processor import DataProcessor

def test_memory_bounded_storage():

    async def run_test():
        p = DataProcessor("Worker-Mem")
        
        # Inspect storage type
        if hasattr(p, 'storage'):
            assert isinstance(p.storage, collections.deque), "Storage must be a collections.deque"
            assert p.storage.maxlen is not None, "Deque must have a maxlen set (memory bounded)"
            # Verify storage limits by attempting to overflow the deque.
            limit = p.storage.maxlen
            for i in range(limit + 5):
                p.storage.append(i)
            
            assert len(p.storage) <= limit, "Storage grew beyond maxlen!"
        else:
            # Fallback for legacy checking
            import circular_data_processor
            if hasattr(circular_data_processor, 'DATA_STORE'):
                # Legacy logic
                store = circular_data_processor.DATA_STORE
                if isinstance(store, list):
                    pytest.fail("Storage is a standard list (unbounded). Expected collections.deque with maxlen.")

    asyncio.run(run_test())
