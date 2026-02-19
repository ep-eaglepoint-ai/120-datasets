# PostgreSQL Inventory Allocation Optimization - Trajectory

## 1. Audit the Original Code (Identify Scaling Problems)

I audited the original `allocate_inventory` function in `repository_before/`. The function exhibited several critical performance and concurrency issues:

- **N+1 Query Problem**: For each item in an order, the function executed a separate SELECT query to check inventory availability, followed by an UPDATE query if stock was sufficient. For an order with N items, this resulted in 2N+1 queries (N SELECTs + N UPDATEs + 1 initial SELECT for order items).
- **Partial Updates Risk**: The function updated inventory row-by-row within a loop. If an item failed validation mid-loop, previous items had already been updated, causing partial allocations.
- **Extended Lock Duration**: Each SELECT and UPDATE in the loop held locks sequentially, increasing contention under high concurrency.
- **Unnecessary RAISE NOTICE**: The function included a RAISE NOTICE statement that added overhead without providing value in production.
- **Poor Scalability**: Large orders with many items would execute hundreds of queries, causing severe performance degradation.

## 2. Define a Performance Contract First

I established clear performance and correctness requirements:

- **Query Reduction**: Reduce total queries from 2N+1 to a **single atomic statement** (plus a cheap empty-order check).
- **Atomic Validation**: Check all items for availability and update them in a single transaction step.
- **All-or-Nothing Updates**: Ensure inventory is updated only if all items pass validation.
- **Minimal Lock Duration**: Acquire locks only for the duration of the single complex statement.
- **Concurrency Safety**: Maintain READ COMMITTED isolation level compatibility and prevent race conditions.
- **Signature Preservation**: Keep the function signature unchanged (`p_order_id BIGINT, p_warehouse_id BIGINT`) returning BOOLEAN.
- **No Schema Changes**: Work within existing table structures without adding indexes, columns, or temporary tables.
- **Production Safety**: Ensure the optimized function is safe for high-concurrency production environments.

## 3. Rework the Query Pattern for Efficiency

I redesigned the function to use Common Table Expressions (CTEs) for a single-pass, set-based operation:

- **Atomic Operation**: Combined validation and update into a single SQL statement using CTEs.
- **Set-Based Logic**: Aggregated order requirements and joined with inventory in one step.
- **Deterministic Locking**: Use `ORDER BY` and `FOR UPDATE` within the CTE to prevent deadlocks and race conditions.
- **Conditional Update**: The UPDATE only executes if the CTE validation confirms _all_ items are present and sufficient.

## 4. Eliminate N+1 Queries

The optimized function executes exactly **1 robust query** (after an initial `EXISTS` check):

1. **Short-Circuit Check**: A simple `IF NOT EXISTS` check handles empty orders instantly.
2. **Atomic CTE Statement**: A single complex statement that:
   - Aggregates demand.
   - Locks relevant inventory rows (`FOR UPDATE`).
   - Validates sufficiency for all items.
   - Updates only if validation passes.

This eliminates the N+1 pattern entirely, providing O(1) query complexity instead of O(N).

## 5. Implement All-or-Nothing Semantics

The new implementation guarantees atomicity through CTE chaining:

- **Validation CTE**: Calculates boolean flags `all_items_found` and `all_items_sufficient` based on the locked inventory snapshot.
- **Update CTE**: Only proceeds if both flags are TRUE. If FALSE, zero rows are updated.
- **Transaction Safety**: Since this happens in one statement, the view of data is consistent, preventing race conditions between check and act.

## 6. Minimize Lock Duration

Lock optimization was achieved through:

- **Single Lock Acquisition**: Locks are acquired once, for all relevant rows, at the start of the atomic statement.
- **No Gap**: There is no gap between reading stock levels and writing new values.
- **No Loop Locks**: Eliminated the sequential lock acquisition pattern from the loop-based approach.

## 7. Result: Measurable Performance Gains + Predictable Behavior

The optimized solution delivers:

- **Query Reduction**: From 2N+1 to ~1 query (constant time).
- **Performance**: Large orders (100+ items) complete in <2 seconds.
- **Concurrency**: `FOR UPDATE` ensures correctness without extended transactions.
- **Correctness**: All-or-nothing semantics prevents partial allocations.
- **Maintainability**: Cleaner, declarative SQL logic.
- **Production Ready**: Safe for high-concurrency production workloads.

## Trajectory Transferability

This optimization trajectory follows the universal pattern: **Audit → Contract → Design → Execute → Verify**

The same approach applies to other performance optimization tasks:

- **Audit**: Profile and identify bottlenecks (N+1 queries, sequential operations, lock contention).
- **Contract**: Define performance SLOs, correctness guarantees, and constraints.
- **Design**: Rework data access patterns (batch operations, set-based logic, minimal locking).
- **Execute**: Implement optimizations while preserving behavior.
- **Verify**: Test for correctness, performance, and concurrency safety.
