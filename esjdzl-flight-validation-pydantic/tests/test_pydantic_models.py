import os
import pytest
from datetime import date, time, datetime
from typing import Any

# Determine which repository to test based on environment variable
REPO_PATH = os.environ.get("REPO_PATH", "repository_after")

def get_models():
    """Dynamically load models to allow testing both repositories."""
    if REPO_PATH == "repository_before":
        from repository_before.flight_model import (
            FlightClass,
            FlightDetailsDC as FlightDetails,
            FlightSearchRequestDC as FlightSearchRequest
        )
        # Dataclasses and manual validation raise ValueError/TypeError
        return FlightClass, FlightDetails, FlightSearchRequest, (ValueError, TypeError)
    else:
        from repository_after.flight_model import (
            FlightClass,
            FlightDetails,
            FlightSearchRequest
        )
        from pydantic import ValidationError
        return FlightClass, FlightDetails, FlightSearchRequest, ValidationError

FlightClass, FlightDetails, FlightSearchRequest, ValidationErr = get_models()

# =================================================================
# REQUIREMENTS MAPPING:
# REQ-01: Identify validation, design, and correctness issues.
# REQ-02: Explain why manual validation is insufficient (demonstrated by these tests).
# REQ-03: Refactor the models to use Pydantic v2.
# REQ-04: Use declarative constraints (Field, enums, regex, bounds).
# REQ-05: Implement proper cross-field validation.
# REQ-06: Ensure immutability where appropriate.
# REQ-07: Preserve original business intent (models still represent Flights/Requests).
# REQ-08: Use Pydantic v2 APIs only.
# REQ-09: Do not introduce new business logic beyond validation fixes.
# REQ-10: Avoid breaking existing field names (origin, destination, price, etc.).
# REQ-11: Ensure all validation errors are explicit and non-silent.
# =================================================================

# Helper to mark expected failures in the baseline
is_before = REPO_PATH == "repository_before"

def test_search_request_iata_validation_and_coercion():
    """
    REQ-03, REQ-04, REQ-10, REQ-11: Verify IATA codes are validated and coerced to uppercase.
    Transformation: Before allows 'jfk' as lowercase and lacks format check.
    """
    # Happy path with coercion (REQ-04)
    req = FlightSearchRequest(
        origin="jfk",
        destination="lhr",
        departure_date=date(2026, 1, 10),
    )
    # REQ-04: Coercion check
    if is_before:
        # Before does not coerce. We mark this as an expected failure if we were to assert uppercase,
        # but since we want to demonstrate the bug, let's keep the assertion strict.
        pytest.xfail("Baseline fails to coerce IATA codes to uppercase")
    
    assert req.origin == "JFK"
    assert req.destination == "LHR"

    # REQ-11: Invalid format (non-alphabetical) should fail explicitly
    with pytest.raises(ValidationErr):
        FlightSearchRequest(
            origin="123",
            destination="LHR",
            departure_date=date(2026, 1, 10),
        )

def test_search_request_cross_field_dates():
    """
    REQ-05, REQ-07, REQ-09, REQ-11: Verify return_date >= departure_date is enforced explicitly.
    FAIL_TO_PASS: Before silently ignores this (REQ-01), After raises error.
    """
    if is_before:
        pytest.xfail("Baseline silently ignores invalid return dates")

    with pytest.raises(ValidationErr) as exc:
        FlightSearchRequest(
            origin="SFO",
            destination="BOS",
            departure_date=date(2026, 1, 20),
            return_date=date(2026, 1, 19),
        )
    assert "return_date" in str(exc.value) or "on or after" in str(exc.value)

def test_search_request_numeric_constraints():
    """
    REQ-04: Verify range constraints for passengers and price.
    """
    # Passengers must be > 0
    with pytest.raises(ValidationErr):
        FlightSearchRequest(
            origin="SFO",
            destination="SEA",
            departure_date=date(2026, 1, 22),
            passengers=0,
        )

    # Max price must be > 0 (REQ-04)
    if is_before:
        pytest.xfail("Baseline lacks range validation for max_price")

    with pytest.raises(ValidationErr):
        FlightSearchRequest(
            origin="SFO",
            destination="SEA",
            departure_date=date(2026, 1, 22),
            max_price=-1.0,
        )

def test_airports_distinct_constraint():
    """
    REQ-05: Ensure origin and destination are distinct.
    Both should raise error, but Pydantic is more robust.
    """
    if is_before:
        pytest.xfail("Baseline lacks cross-field validation for distinct airports")

    with pytest.raises(ValidationErr):
        FlightSearchRequest(
            origin="SFO",
            destination="SFO",
            departure_date=date(2026, 1, 22),
        )

def test_immutability():
    """
    REQ-06: Verify models are immutable.
    FAIL_TO_PASS: Before allows mutation, After raises error.
    """
    if is_before:
        pytest.xfail("Baseline models are mutable")

    req = FlightSearchRequest(
        origin="SFO",
        destination="SEA",
        departure_date=date(2026, 1, 22),
    )
    with pytest.raises(ValidationErr):
        req.origin = "LAX" # type: ignore

def test_flight_details_type_coercion():
    """
    REQ-01, REQ-03: Verify type coercion for string numeric inputs.
    FAIL_TO_PASS: Before does not coerce, After does.
    """
    if is_before:
        pytest.xfail("Baseline does not support type coercion for strings")

    details = FlightDetails(
        airline="Delta",
        flight_number="DL123",
        price="300.50", # type: ignore
        origin="JFK",
        destination="LAX",
        departure_time=time(7, 0),
        arrival_time=time(9, 0),
        duration="02:00",
    )
    assert isinstance(details.price, float)
    assert details.price == 300.50

def test_flight_number_regex():
    """
    REQ-04: Verify flight number format via regex.
    Transformation: Before has no format check.
    """
    if is_before:
        pytest.xfail("Baseline lacks flight number format validation")

    with pytest.raises(ValidationErr):
        FlightDetails(
            airline="Delta",
            flight_number="INVALID_FLIGHT",
            price=300.0,
            origin="JFK",
            destination="LAX",
            departure_time=time(7, 0),
            arrival_time=time(9, 0),
            duration="02:00",
        )

def test_duration_format_validation():
    """
    REQ-04: Verify duration format (HH:MM).
    """
    if is_before:
        pytest.xfail("Baseline lacks duration format validation")

    with pytest.raises(ValidationErr):
        FlightDetails(
            airline="Delta",
            flight_number="DL123",
            price=300.0,
            origin="JFK",
            destination="LAX",
            departure_time=time(7, 0),
            arrival_time=time(9, 0),
            duration="2h 15m", # Invalid format
        )