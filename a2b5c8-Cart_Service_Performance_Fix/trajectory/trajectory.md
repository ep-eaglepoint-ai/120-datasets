## 1. Audit the Original Code / Problem

**Before (`repository_before/cartService.js`):**
- `getCart` uses `populate()` to enrich nested relations, which creates an N+1-style fanout risk and extra document allocations.
- Read path does not use `lean()`, so it allocates full Mongoose documents for read-only operations.
- Pricing conversion (`Decimal128.toString()` → `parseFloat`) is repeated across multiple loops and multiple passes.
- `addToCart` fetches menu item first, then cart (sequential I/O), and compares ObjectIds using `toString()`.
- Discount checks construct multiple `new Date()` instances inside a single operation.

**After / Implemented Solution (`repository_after/cartService.js`):**
- `getCart` is rewritten into a bulk-fetch pipeline:
  - `Cart.findOne(...).select(...).lean()`
  - bulk `MenuItem.find({ _id: { $in: [...] } }).select(...).lean()`
  - bulk `Merchant.find({ _id: { $in: [...] } }).select(...).lean()`
  - join in-memory (maps) instead of `populate()`.
- `addToCart` parallelizes independent reads with `Promise.all` (menu item + cart).
- Introduces small helpers (`decimalToNumber`, `getPrimaryImageUrl`, `normalizeAddOns`) and recomputes pricing in a single pass.
- Uses a single captured `now` in discount logic and prefers ObjectId semantics (`equals`) instead of stringification.

---

## 2. Define the Contract (Correctness + Constraints)

Contract is enforced by the Node test harness in `tests/cartService.test.js`:
- **No populate / N+1**: `getCart` must not call `populate()` and must use bulk `$in` queries.
- **Lean reads**: `getCart` must call `lean()` on read-only queries.
- **Projection**: `select()` must be used to avoid over-fetching.
- **Parallel I/O**: `addToCart` must invoke `Cart.findOne` without waiting for menu item resolution (parallel fetch behavior).
- **Correct ObjectId semantics**: comparisons must not rely on `toString()` allocations; must use `equals()`.
- **Single save**: write operations should perform one persistence call (`save()` once).
- **Single time reference**: discount logic should construct `Date()` only once per operation.
- **Decimal conversions**: Decimal-like values should be converted once per field (no repeated `toString()` calls in loops).

---

## 3. Design & Implementation

**Design choices:**
- **Bulk join instead of populate**: fetch all menu items and merchants via `$in` and stitch results with `Map` lookups.
- **Lean + select**: treat the read path as projection-first and allocation-light by default.
- **Centralized numeric conversions**: `decimalToNumber()` converts Decimal128-like objects/strings once and the value is reused.
- **Single-pass pricing**: `recalculatePricing()` computes `subtotal` and `totalItems` together.
- **Deterministic discount checks**: `isDiscountActive(discount, now)` uses one `now` timestamp per operation.

---

## 4. Testing Review

Tests in `tests/cartService.test.js` use stubs/spies to validate both behavior and performance-oriented constraints:
- Stubs Mongoose model methods (`findOne`, `find`, `findById`) and records calls to `select()`, `lean()`, `populate()`.
- Verifies `$in` queries are used for bulk fetches.
- Uses a custom `Date` patch to fail if `new Date()` is constructed more than once in a code path.
- Uses Decimal-like objects that count `toString()` calls to ensure conversions are not repeated.
- Uses “evil” ObjectIds that throw on `toString()` to enforce `equals()` usage.

`tests/test_all.js` runs the suite against either `repository_before` or `repository_after` via `TEST_REPO_PATH`.

---

## 5. Result / Measurable Improvements

- Solution correctly implements the performance requirements: no populate-based fanout, lean reads, bulk joins, fewer conversions, single-pass pricing, and parallel I/O where appropriate.
- Tests confirm correctness and performance constraints with deterministic signals (before expected to fail constraints, after expected to pass).
- Good practices maintained: small pure helpers, modularized hot-path logic, and a reproducible evaluation harness (`evaluation/evaluation.js`) that generates standard reports.
