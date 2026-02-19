import asyncio
import time

# Legacy Global State
DATA_STORE = []

class DataProcessor:
    def __init__(self, name):
        self.name = name

    def sync_blocking_task(self, data):
        # ERROR: This blocks the entire event loop!
        print(f"Processing {data}...")
        time.sleep(2) 
        DATA_STORE.append(data)
        return f"Finished {data}"

async def main_loop():
    processor = DataProcessor("Worker-1")
    # This looks async but will execute serially because of the block
    tasks = [
        asyncio.create_task(asyncio.to_thread(processor.sync_blocking_task, i)) 
        for i in range(5)
    ]
    results = await asyncio.gather(*tasks)
    print(results)

if __name__ == "__main__":
    asyncio.run(main_loop())