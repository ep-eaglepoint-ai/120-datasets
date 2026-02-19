"""URL format and reachability validation."""

from typing import Optional
from urllib.parse import urlsplit
import httpx

REACHABILITY_TIMEOUT = 5.0
ALLOWED_SCHEMES = {"http", "https"}


def validate_url_format(url: str) -> Optional[str]:
    if not isinstance(url, str) or not url.strip():
        return "target_url must be a non-empty string"
    if any(char.isspace() for char in url):
        return "target_url must not contain spaces"

    parts = urlsplit(url)
    if parts.scheme not in ALLOWED_SCHEMES:
        return "target_url scheme must be http or https"
    if not parts.netloc:
        return "target_url must include a domain"

    return None


async def is_url_reachable(url: str, timeout: float = REACHABILITY_TIMEOUT) -> bool:
    """Check if a URL is reachable via HEAD request with GET fallback."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            response = await client.head(url)
            if response.status_code in (405, 501):
                response = await client.get(url)
            return 200 <= response.status_code < 400
    except Exception:
        return False
