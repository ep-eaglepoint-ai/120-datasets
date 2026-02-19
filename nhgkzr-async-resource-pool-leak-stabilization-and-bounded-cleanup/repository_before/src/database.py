

import asyncio
from typing import AsyncContextManager
from contextlib import asynccontextmanager
import psycopg
from psycopg_pool import AsyncConnectionPool


class DatabasePool:
    """Manages database connection pool"""
    
    def __init__(self, connection_string: str, max_size: int = 20):
        self.pool = AsyncConnectionPool(
            connection_string,
            min_size=5,
            max_size=max_size,
            timeout=30
        )
    
    async def initialize(self):
        """Initialize the connection pool"""
        await self.pool.open()
    
    async def close(self):
        """Close all connections"""
        await self.pool.close()
    
    @asynccontextmanager
    async def connection(self):
        """Get a connection from the pool"""
        async with self.pool.connection() as conn:
            yield conn
    
    @asynccontextmanager
    async def transaction(self):
        """
        Get a connection with transaction context
        
        BUG WARNING: If this context is not properly used,
        transactions may remain open indefinitely!
        """
        async with self.pool.connection() as conn:
            async with conn.transaction():
                yield conn


# Global database pool instance
_db_pool: DatabasePool | None = None


async def get_db_pool() -> DatabasePool:
    """Get the global database pool"""
    global _db_pool
    if _db_pool is None:
        # Using mock connection string for demonstration
        _db_pool = DatabasePool(
            "postgresql://user:pass@localhost/market_db"
        )
        await _db_pool.initialize()
    return _db_pool
