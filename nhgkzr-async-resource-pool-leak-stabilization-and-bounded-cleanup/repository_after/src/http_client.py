import aiohttp
from typing import Optional

class HttpClient:
    """Async HTTP client wrapper"""

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None

    async def initialize(self):
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=10),
                connector=aiohttp.TCPConnector(limit=100)
            )

    async def close(self):
        if self._session:
            await self._session.close()
            self._session = None

    async def get(self, url: str) -> str:
        """
        Perform GET request safely inside a context manager.
        """
        if not self._session:
            await self.initialize()

        # FIX: Context manager ensures connection is released back to pool
        async with self._session.get(url) as response:
            response.raise_for_status()
            return await response.text()

# Global HTTP client instance
_http_client: HttpClient | None = None

async def get_http_client() -> HttpClient:
    global _http_client
    if _http_client is None:
        _http_client = HttpClient()
        await _http_client.initialize()
    return _http_client

async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.close()
        _http_client = None