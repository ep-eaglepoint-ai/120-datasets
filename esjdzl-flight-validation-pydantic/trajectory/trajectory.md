# Trajectory: Flight Model Refactor to Pydantic v2

## Problem

The existing flight models in `repository_before` use Python dataclasses with manual validation. This causes several issues:

1. **Silent failures** - `FlightSearchRequestDC.__post_init__` silently ignores invalid return dates (`pass` on error)
2. **No type coercion** - String inputs like `"299.99"` stay as strings, causing downstream TypeErrors
3. **Mutable state** - Models can be modified after creation, risky in async pipelines
4. **Weak format checks** - Airport codes only check length, not content (allows `"123"` or `"jfk"`)

## Solution

Migrate to Pydantic v2 BaseModel with declarative validation:

- `Field(gt=0)` for numeric bounds
- `Field(pattern=...)` for regex validation (flight numbers, duration format)
- `@field_validator` for IATA code normalization (uppercase coercion + format check)
- `@model_validator` for cross-field logic (distinct airports, return_date >= departure_date)
- `ConfigDict(frozen=True)` for immutability

## Changes

All changes in `repository_after/flight_model.py`:

| Before | After |
|--------|-------|
| `@dataclass` | `BaseModel` with `frozen=True` |
| Manual `__post_init__` | Declarative `Field()` + validators |
| Silent error bypass | Explicit `ValidationError` |
| No type coercion | Automatic coercion (e.g., `"300.50"` → `300.5`) |
| Length-only IATA check | Regex + uppercase coercion |

## Test Coverage

Tests in `tests/test_pydantic_models.py` verify the transformation:

- `test_flight_details_type_coercion` - string-to-float coercion works
- `test_search_request_cross_field_dates` - invalid return dates raise errors
- `test_immutability` - frozen models reject mutation
- `test_search_request_iata_validation_and_coercion` - IATA format enforced

## Trade-offs

- **Added dependency**: Pydantic v2
- **Slight overhead**: Negligible for I/O-bound flight scraping; Pydantic v2's Rust core is fast

## References

- [Pydantic v2 Validators](https://docs.pydantic.dev/latest/concepts/validators/)
