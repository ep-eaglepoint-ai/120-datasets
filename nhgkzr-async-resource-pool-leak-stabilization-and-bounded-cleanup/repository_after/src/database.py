import asyncio
from typing import AsyncContextManager
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool

class DatabasePool:
    """Manages database connection pool"""

    def __init__(self, connection_string: str, max_size: int = 20):
        self.pool = AsyncConnectionPool(
            connection_string,
            min_size=5,
            max_size=max_size,
            timeout=30,
            # Ensure connections are healthy when returned
            kwargs={'autocommit': True}
        )

    async def initialize(self):
        await self.pool.open()

    async def close(self):
        await self.pool.close()

    @asynccontextmanager
    async def connection(self):
        async with self.pool.connection() as conn:
            yield conn

    @asynccontextmanager
    async def transaction(self):
        """
        Get a connection with transaction context safely.
        """
        async with self.pool.connection() as conn:
            # The transaction context manager ensures COMMIT on success
            # and ROLLBACK on exception.
            async with conn.transaction():
                yield conn

# Global database pool instance
_db_pool: DatabasePool | None = None

async def get_db_pool() -> DatabasePool:
    global _db_pool
    if _db_pool is None:
        _db_pool = DatabasePool("postgresql://user:pass@localhost/market_db")
        await _db_pool.initialize()
    return _db_pool

async def close_db_pool():
    """Helper to cleanly shutdown the pool"""
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None