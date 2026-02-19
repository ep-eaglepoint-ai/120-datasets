import pytest
import asyncio
from circular_data_processor import DataProcessor

import pytest
import asyncio
from circular_data_processor import DataProcessor

def test_encapsulation():

    async def run_test():
        # Create two processors
        p1 = DataProcessor("P1")
        p2 = DataProcessor("P2")
        
        # Process data in P1
        import circular_data_processor
        if hasattr(circular_data_processor, 'DATA_STORE'):
            # Legacy case: Check if both append to same global list
            initial_len = len(circular_data_processor.DATA_STORE)
            
            # Legacy fallback: Execute blocking task to check for global side effects.
            if asyncio.iscoroutinefunction(p1.sync_blocking_task):
                await p1.sync_blocking_task("test-p1")
            else:
                 pass
            
            # The refactored code must validly remove the global 'DATA_STORE'.
            pytest.fail("Found global variable 'DATA_STORE' in module. State should be encapsulated.")
            
            pytest.fail("Found global variable 'DATA_STORE' in module. State should be encapsulated.")
        
        # Verify instance isolation in refactored code.
        if hasattr(p1, 'storage') and hasattr(p2, 'storage'):
            assert p1.storage is not p2.storage, "Storage objects should be distinct instances"

    asyncio.run(run_test())
