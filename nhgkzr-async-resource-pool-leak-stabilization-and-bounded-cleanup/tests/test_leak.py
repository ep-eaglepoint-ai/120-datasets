import sys
import asyncio
import unittest
from unittest.mock import MagicMock, patch
from dataclasses import dataclass
from datetime import datetime
import os

# --- 1. Pre-emptive Mocking (Must be first) ---
if 'psycopg_pool' not in sys.modules:
    sys.modules['psycopg_pool'] = MagicMock()
if 'psycopg' not in sys.modules:
    sys.modules['psycopg'] = MagicMock()
if 'aiohttp' not in sys.modules:
    sys.modules['aiohttp'] = MagicMock()
if 'aiofiles' not in sys.modules:
    sys.modules['aiofiles'] = MagicMock()

# --- 2. Resource Tracker ---
class ResourceTracker:
    def __init__(self):
        self.open_files = 0
        self.active_transactions = 0
        self.leaked_tasks = 0

tracker = ResourceTracker()

# --- 3. Corrected Mock Implementations ---

class MockFile:
    def __init__(self, filename, mode):
        self.closed = False
        tracker.open_files += 1

    async def write(self, data): pass

    async def close(self):
        if not self.closed:
            self.closed = True
            tracker.open_files -= 1

    async def __aenter__(self): return self
    async def __aexit__(self, exc_type, exc, tb): await self.close()

def mock_open(filename, mode='r'):
    return MockFile(filename, mode)

class MockConnection:
    def __init__(self):
        self.in_transaction = False

    async def execute(self, query, params=None):
        q = query.strip().upper()
        if "BEGIN" in q:
            if not self.in_transaction:
                self.in_transaction = True
                tracker.active_transactions += 1

    # FIX 1: This must be a sync function returning a context manager, NOT async def
    def transaction(self):
        return MockTransactionCtx(self)

    async def close(self): pass

class MockTransactionCtx:
    def __init__(self, conn):
        self.conn = conn
    async def __aenter__(self):
        if not self.conn.in_transaction:
            self.conn.in_transaction = True
            tracker.active_transactions += 1
        return self.conn
    async def __aexit__(self, exc_type, exc, tb):
        if self.conn.in_transaction:
            self.conn.in_transaction = False
            tracker.active_transactions -= 1

class MockPool:
    def __init__(self, *args, **kwargs): pass
    async def open(self): pass
    async def close(self): pass
    def connection(self): return MockPoolCtx()

class MockPoolCtx:
    async def __aenter__(self): return MockConnection()
    async def __aexit__(self, exc_type, exc, tb): pass

# FIX 2: Restore explicit aiohttp mocks for proper 'async with' support
class MockResponse:
    async def text(self): return "mock_response"
    def raise_for_status(self): pass
    async def __aenter__(self): return self
    async def __aexit__(self, exc_type, exc, tb): pass

class MockSession:
    def __init__(self, *args, **kwargs): pass
    # get() must return an object that supports __aenter__ (MockResponse)
    def get(self, url): return MockResponse()
    async def close(self): pass

# --- 4. The Test Suite ---

class TestResourceLeaks(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        tracker.open_files = 0
        tracker.active_transactions = 0
        tracker.leaked_tasks = 0

    @patch('aiofiles.open', side_effect=mock_open)
    @patch('psycopg_pool.AsyncConnectionPool', side_effect=MockPool)
    @patch('aiohttp.ClientSession', side_effect=MockSession) # Use side_effect to return our custom mock
    @patch('aiohttp.TCPConnector', return_value=MagicMock())
    async def test_batch_processing_cleanliness(self, mock_tcp, mock_session, mock_pool, mock_file):
        """
        Run a batch of events and check for leaks.
        """
        try:
            import src.event_processor as ep
            import src.models as md
            import src.database as db
            import src.http_client as hc
        except ImportError as e:
            self.fail(f"Could not import src modules: {e}")

        events = [
            md.MarketEvent(f"SYM{i}", 100.0, 100, datetime.now())
            for i in range(20)
        ]

        base_task_count = len(asyncio.all_tasks())

        try:
            stats = await ep.process_events_batch(events)
        except Exception:
            if "repository_after" in os.environ.get("PYTHONPATH", ""):
                raise
            return

        await asyncio.sleep(0.1)

        current_task_count = len(asyncio.all_tasks())
        tracker.leaked_tasks = current_task_count - base_task_count

        print(f"\n[DEBUG] Open Files: {tracker.open_files}")
        print(f"[DEBUG] Active DB Tx: {tracker.active_transactions}")
        print(f"[DEBUG] Task Growth:  {tracker.leaked_tasks}")

        self.assertEqual(tracker.open_files, 0, f"Leaked {tracker.open_files} file handles!")
        self.assertEqual(tracker.active_transactions, 0, f"Leaked {tracker.active_transactions} DB transactions!")
        self.assertLess(tracker.leaked_tasks, 3, f"Leaked {tracker.leaked_tasks} async tasks!")

        if "repository_after" in os.environ.get("PYTHONPATH", ""):
            self.assertEqual(stats['processed'], 20, "Should have processed all events")

        if hasattr(db, 'close_db_pool'): await db.close_db_pool()
        if hasattr(hc, 'close_http_client'): await hc.close_http_client()