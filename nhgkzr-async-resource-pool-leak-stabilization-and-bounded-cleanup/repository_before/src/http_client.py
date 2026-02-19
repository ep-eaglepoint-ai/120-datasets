

import aiohttp
from typing import Optional


class HttpClient:
    """Async HTTP client wrapper"""
    
    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def initialize(self):
        """Initialize the HTTP session"""
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
            connector=aiohttp.TCPConnector(limit=100)
        )
    
    async def close(self):
        """Close the HTTP session"""
        if self._session:
            await self._session.close()
    
    async def get(self, url: str) -> str:
        """
        Perform GET request
        
        BUG WARNING: If response is not fully consumed,
        connection may not be returned to pool!
        """
        if not self._session:
            await self.initialize()
        
        async with self._session.get(url) as response:
            return await response.text()


# Global HTTP client instance
_http_client: HttpClient | None = None


async def get_http_client() -> HttpClient:
    """Get the global HTTP client"""
    global _http_client
    if _http_client is None:
        _http_client = HttpClient()
        await _http_client.initialize()
    return _http_client
