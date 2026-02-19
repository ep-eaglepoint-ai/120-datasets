from datetime import datetime, date, time, UTC
from enum import Enum
from typing import Optional
import uuid
import re
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class FlightClass(str, Enum):
    """Enumeration for flight seating classes."""
    ECONOMY = "economy"
    BUSINESS = "business"


class FlightDetails(BaseModel):
    """
    Represents the details of a specific flight.
    
    Refactored from dataclass to Pydantic v2 for robust validation, 
    type coercion, and immutability.
    """
    model_config = ConfigDict(frozen=True)

    airline: str = Field(min_length=1)
    flight_number: str = Field(pattern=r"^[A-Z0-9]{2,3}\d{1,4}$")
    price: float = Field(gt=0)
    origin: str
    destination: str
    departure_time: time
    arrival_time: time
    duration: str = Field(pattern=r"^\d{2}:\d{2}$")
    flight_class: FlightClass = FlightClass.ECONOMY
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def validate_and_uppercase_iata(cls, v: str) -> str:
        """Coerce airport codes to uppercase and validate IATA format."""
        if isinstance(v, str):
            v = v.upper()
            if not re.match(r"^[A-Z]{3}$", v):
                raise ValueError("Airport code must be 3 uppercase letters (IATA format)")
            return v
        return v

    @model_validator(mode="after")
    def validate_distinct_airports(self) -> "FlightDetails":
        """Ensure origin and destination are not the same."""
        if self.origin == self.destination:
            raise ValueError("Origin and destination must be different")
        return self


class FlightSearchRequest(BaseModel):
    """
    Represents a request for flight searching.
    
    Refactored from dataclass to Pydantic v2 to ensure explicit validation
    of dates and passenger counts.
    """
    model_config = ConfigDict(frozen=True)

    origin: str
    destination: str
    departure_date: date
    return_date: Optional[date] = None
    passengers: int = Field(default=1, gt=0)
    max_price: Optional[float] = Field(default=None, gt=0)

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def validate_and_uppercase_iata(cls, v: str) -> str:
        """Coerce airport codes to uppercase and validate IATA format."""
        if isinstance(v, str):
            v = v.upper()
            if not re.match(r"^[A-Z]{3}$", v):
                raise ValueError("Airport code must be 3 uppercase letters (IATA format)")
            return v
        return v

    @model_validator(mode="after")
    def validate_request_logic(self) -> "FlightSearchRequest":
        """
        Cross-field validation for search logical consistency.
        1. Origin and destination must be distinct.
        2. Return date must be after or on the departure date.
        """
        if hasattr(self, 'origin') and hasattr(self, 'destination'):
            if self.origin == self.destination:
                raise ValueError("Origin and destination must be distinct")

        if self.return_date and self.return_date < self.departure_date:
            raise ValueError("return_date must be on or after departure_date")
        
        return self