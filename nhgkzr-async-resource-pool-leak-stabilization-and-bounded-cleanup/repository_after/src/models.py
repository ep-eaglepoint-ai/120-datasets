from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import json

@dataclass
class MarketEvent:
    """Represents a market data event"""
    symbol: str
    price: float
    volume: int
    timestamp: datetime

    def __str__(self):
        return f"MarketEvent({self.symbol}, ${self.price}, vol={self.volume})"

@dataclass
class EnrichmentData:
    """Enrichment data from external API"""
    company_name: str
    sector: str
    market_cap: Optional[float] = None

    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps({
            'company_name': self.company_name,
            'sector': self.sector,
            'market_cap': self.market_cap
        })