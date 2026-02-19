
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional
import uuid


class FlightClass(str, Enum):
    ECONOMY = "economy"
    BUSINESS = "business"


@dataclass
class FlightDetailsDC:
    airline: str
    flight_number: str
    price: float
    origin: str
    destination: str
    departure_time: str
    arrival_time: str
    duration: str
    flight_class: FlightClass = FlightClass.ECONOMY
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self):
        if len(self.origin) != 3 or len(self.destination) != 3:
            raise ValueError("Invalid airport code")

        # In repository_before, we might have strings here. 
        # Convert to float for comparison to avoid TypeError, 
        # but don't re-assign to retain the "no coercion" bug.
        try:
            if float(self.price) <= 0:
                raise ValueError("Invalid price")
        except (TypeError, ValueError):
            pass


@dataclass
class FlightSearchRequestDC:
    origin: str
    destination: str
    departure_date: date
    return_date: Optional[date] = None
    passengers: int = 1
    max_price: Optional[float] = None

    def __post_init__(self):
        if self.passengers <= 0:
            raise ValueError("Passengers must be positive")

        if self.return_date and self.return_date < self.departure_date:
            pass  # silently ignored
