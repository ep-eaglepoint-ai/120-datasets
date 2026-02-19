# Nexus Warehouse Database Optimizer — Trajectory

## 1. Audit the Original Implementation (Identify Scaling Failures)

I audited the baseline SQLAlchemy inventory service under a realistic workload (5M+ pallet rows). The service exhibited clear non-scalable behaviors:

- SKU lookups triggered **full table scans** due to missing indexes
- Zone listings materialized **entire result sets in memory**
- Pagination was absent, causing **OOM risk** on large zones
- No visibility into query plans (no EXPLAIN validation)
- Edge cases (negative limits, large offsets) were unchecked

These characteristics made the service unsuitable for production-scale PostgreSQL workloads.

---

## 2. Define a Performance Contract (Before Writing Code)

Before refactoring, I defined explicit performance and correctness guarantees:

- All SKU and zone lookups must be **index-backed (O(log N))**
- No API call may load unbounded result sets into memory
- Pagination must be enforced **at the query level**
- Responses must expose **total_count, limit, offset** for clients
- Invalid pagination inputs must fail safely
- Index usage must be **verifiable via EXPLAIN**
- Improvements must be **measurable** (latency + memory)

This contract governed every subsequent change.

---

## 3. Rework the Data Model for Query Efficiency

To satisfy the lookup guarantees, I modified the schema to make PostgreSQL’s planner effective.

**Schema changes (`repository_after/src/db/models.py`):**
- Added B-Tree indexes on `sku` and `zone_code`
- Created explicitly named indexes:
  - `ix_pallets_sku_btree`
  - `ix_pallets_zone_code_btree`

---

## 4. Rebuild the Service Layer Around Pagination-First Access

I redesigned the inventory read path to be **pagination-first**, not list-first.

**Service changes (`inventory_service.py`):**
- Introduced a `PaginatedResponse` abstraction:
  - `data`
  - `total_count`
  - `limit`
  - `offset`
- Added `to_dict()` for serialization
- Refactored `list_pallets_in_zone()` to push filtering, limiting, and offsetting directly into SQL

This prevents ORM-level materialization of large datasets.

---

## 5. Enforce Boundary Safety and Input Normalization

To prevent abuse and accidental overloads, strict boundary rules were added:

- `limit <= 0` → defaults to `DEFAULT_LIMIT = 100`
- `limit > MAX_LIMIT` → capped at `1000`
- `offset < 0` → normalized to `0`
- `offset >= total_count` → returns empty data with valid metadata

This guarantees predictable behavior under all client inputs.

---

## 6. Verify Index Usage Explicitly (Planner-Level Validation)

To avoid “index exists but unused” failures, I added planner verification:

- Implemented `verify_index_usage()` using `EXPLAIN`
- Confirms **Index Scan** is used for SKU and zone-based queries

This elevates correctness from *assumed* to **provable**.

---

## 7. Benchmark and Validate Under Load

A comprehensive test suite validates both correctness and performance.

**Tests include:**
- Index existence and naming validation
- Pagination correctness and record limits
- Accurate `total_count` reporting
- Boundary condition handling
- 5,000-lookup benchmarking tests
- Memory footprint validation across paginated iteration

---

## 8. Evaluation System and Reproducibility

An automated evaluation harness ensures objective comparison:

- Executes tests against:
  - `repository_before` (baseline)
  - `repository_after` (optimized)
- Produces structured JSON output
- Prints human-readable summaries matching the specification

---

## 9. Result: Predictable Performance and Memory Safety

| Capability | Before | After |
|----------|--------|-------|
| SKU Lookup | Full scan | B-Tree index |
| Zone Query | Full load | Paginated |
| Memory Safety | Unbounded | Enforced |
| Metadata | None | `total_count`, `limit`, `offset` |
| EXPLAIN Validation | None | Explicit |
| Edge Case Handling | None | Defensive defaults |

**Outcome:**
- **Before**: ❌ Tests fail
- **After**: ✅ All tests pass, memory-safe, index-backed, verifiable

---

## 10. Execution Commands

```bash
docker compose run --rm -e PYTHONPATH=/app/repository_before app pytest -v tests/ --tb=short   # Expected: failures
docker compose run --rm -e PYTHONPATH=/app/repository_after app pytest -v tests/ --tb=short    # Expected: all pass
docker compose run --rm app python evaluation/evaluation.py    # Full evaluation report
