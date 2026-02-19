from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx


async def deliver_webhook(
    webhook_url: str,
    *,
    job_id: str,
    status: str,
    rows_processed: int,
    rows_failed: int,
    completed_at: datetime,
    max_attempts: int = 3,
    base_delay_seconds: float = 0.5,
    max_total_seconds: float = 10.0,
) -> None:
    payload = {
        "job_id": job_id,
        "status": status,
        "rows_processed": rows_processed,
        "rows_failed": rows_failed,
        "completed_at": completed_at.astimezone(timezone.utc).isoformat(),
    }

    # Must be delivered within 10 seconds of job completion (including retries).
    loop = asyncio.get_running_loop()
    deadline = loop.time() + float(max_total_seconds)
    last_exc: Exception | None = None

    for attempt in range(int(max_attempts)):
        remaining = deadline - loop.time()
        if remaining <= 0:
            break

        try:
            # Keep per-attempt timeout small so total delivery stays within budget.
            per_attempt_timeout = min(2.0, remaining)
            timeout = httpx.Timeout(per_attempt_timeout)
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(webhook_url, json=payload)
                resp.raise_for_status()
                return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < (int(max_attempts) - 1):
                # Exponential backoff: 0.5s, 1.0s, 2.0s...
                delay = float(base_delay_seconds) * (2**attempt)
                remaining = deadline - loop.time()
                if remaining <= 0:
                    break
                await asyncio.sleep(min(delay, remaining))

    if last_exc:
        raise last_exc
