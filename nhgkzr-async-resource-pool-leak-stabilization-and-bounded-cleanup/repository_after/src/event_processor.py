import asyncio
import aiofiles
from datetime import datetime
from typing import Optional, List, Dict

from .database import get_db_pool
from .http_client import get_http_client
from .models import MarketEvent, EnrichmentData

class ProcessingError(Exception):
    pass

class EventProcessor:
    def __init__(self):
        self.processed_count = 0
        self.error_count = 0
        # Limit concurrency to match DB pool size (20)
        # preventing "Timeout waiting for connection" under load.
        self._semaphore = asyncio.Semaphore(20)

    async def process_event(self, event: MarketEvent) -> None:
        """Process event with concurrency control"""
        async with self._semaphore:
            await self._process_event_async(event)

    async def _process_event_async(self, event: MarketEvent) -> None:
        try:
            enrichment = await self._fetch_enrichment(event.symbol)

            if enrichment is None:
                print(f"Enrichment failed for {event.symbol}")
                self.error_count += 1
                return

            await self._store_event(event, enrichment)
            await self._write_audit_log(event, enrichment)

            self.processed_count += 1

        except Exception as e:
            print(f"Processing error: {e}")
            self.error_count += 1

    async def _fetch_enrichment(self, symbol: str) -> Optional[EnrichmentData]:
        try:
            client = await get_http_client()
            url = f"https://api.marketdata.com/v1/symbols/{symbol}"

            # Response is fully consumed inside client.get() now
            await client.get(url)

            return EnrichmentData(
                company_name=f"{symbol} Corp",
                sector="Technology",
                market_cap=1000000000.0
            )
        except Exception as e:
            print(f"Enrichment error: {e}")
            return None

    async def _store_event(self, event: MarketEvent, enrichment: EnrichmentData) -> None:
        db_pool = await get_db_pool()

        # Use transaction context to ensure Commit/Rollback
        async with db_pool.transaction() as conn:
            await conn.execute(
                """
                INSERT INTO market_events (symbol, price, volume, timestamp, enrichment)
                VALUES ($1, $2, $3, $4, $5)
                """,
                (
                    event.symbol,
                    event.price,
                    event.volume,
                    event.timestamp,
                    enrichment.to_json()
                )
            )

    async def _write_audit_log(self, event: MarketEvent, enrichment: EnrichmentData) -> None:
        filename = f"audit_{event.timestamp.strftime('%Y%m%d')}.log"
        log_entry = (
            f"{event.timestamp.isoformat()},"
            f"{event.symbol},"
            f"{event.price},"
            f"{event.volume},"
            f"{enrichment.company_name}\n"
        )

        # Explicitly close file handle using context manager
        async with aiofiles.open(filename, mode='a') as file:
            await file.write(log_entry)

async def process_events_batch(events: List[MarketEvent]) -> Dict:
    """
    Process a batch of events
    Returns statistics about processing
    """
    processor = EventProcessor()
    print(f"Processing {len(events)} events...")

    # Create coroutines
    tasks = [processor.process_event(event) for event in events]

    # Await all tasks to ensure they finish before returning.
    # return_exceptions=True prevents one crash from stopping others.
    await asyncio.gather(*tasks, return_exceptions=True)

    return {
        'total': len(events),
        'processed': processor.processed_count,
        'errors': processor.error_count,
        'active_tasks': len(asyncio.all_tasks())
    }