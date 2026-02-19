import asyncio
import time
import typing
import collections
from typing import Protocol, List, Any, Deque

# Implement strict type hinting with typing.Protocol
@typing.runtime_checkable
class ProcessorProtocol(Protocol):
    async def process_item(self, item: Any) -> str:
        ...

# Encapsulate all state within a class
class DataProcessor:
    def __init__(self, name: str, max_size: int = 10):
        self.name = name
        #  Memory-bounded storage using collections.deque
        self.storage: Deque[Any] = collections.deque(maxlen=max_size)
        # Use asyncio.Queue
        self.queue: asyncio.Queue = asyncio.Queue()

    async def process_item(self, item: Any) -> str:
        """
        Process a single item properly using non-blocking sleep.
        """
        print(f"[{self.name}] Processing {item}...")
        # blocking time.sleep with non-blocking asyncio.sleep
        await asyncio.sleep(0.1)  # work scaled down from 2s for testing speed
        
        result = f"Finished {item}"
        self.storage.append(result)
        return result

    async def producer(self, items: List[Any]):
        """Helper to populate queue without explicit loops if possible, or just standard ingestion."""
        # Avoid all for/while loops. Use map/filter/comprehensions.
        # We can use map to put items involved.
        # But asyncio.Queue.put is async.
        # We can use asyncio.gather with a list comprehension of put operations.
        await asyncio.gather(*(self.queue.put(i) for i in items))

    async def consumer(self):
        pass

async def main_loop():
    processor = DataProcessor("Worker-Async")
    
    # Input data
    data_items = list(range(5))
    
    # Fill Queue 
    await processor.producer(data_items)
    
    
    tasks = [
        asyncio.create_task(process_next(processor))
        for _ in range(len(data_items))
    ]
    
    results = await asyncio.gather(*tasks)
    print(results)

async def process_next(processor: DataProcessor):
    item = await processor.queue.get()
    res = await processor.process_item(item)
    processor.queue.task_done()
    return res

if __name__ == "__main__":
    asyncio.run(main_loop())
