# Trajectory

## Trajectory (Thinking Process for Bug Fixing)

### 1. Audit the Original Code (Identify Bug Patterns)

I audited the original `cartService.js` code. The service handles shopping cart operations for a food delivery application with 50K+ daily active users. I identified 6 critical bugs:

- **No input validation** — Quantity values of 0 or negative numbers were accepted, corrupting cart totals
- **Race conditions** — Non-atomic find-then-insert pattern caused duplicate items on rapid clicks
- **Inverted logic** — Discount date range check was backwards, applying discounts OUTSIDE valid range
- **Missing merchant validation** — Items from different merchants could be added to same cart
- **Broken return values** — `removeFromCart()` and `clearCart()` returned `null` instead of updated cart
- **Stale totals** — Cart pricing (subtotal, totalItems) never recalculated after modifications

### 2. Define a Bug Fix Contract First

I defined fix guarantees before writing any code:
- All input data must be validated at method entry
- Atomic operations must prevent race conditions
- Business logic must match documented behavior
- All mutations must return consistent state
- Changes must be minimal and focused

### 3. Design the Fixes Systematically

For each bug, I designed a targeted fix:

| Bug | Root Cause | Fix Strategy |
|-----|------------|--------------|
| Invalid quantities | Missing validation | Add `Number.isInteger(quantity) && quantity > 0` check |
| Duplicate items | Non-atomic pattern | Replace with `findOneAndUpdate` with `$ne` condition |
| Wrong discounts | Inverted date check | Fix to apply when `isWithinDateRange` is true |
| Mixed merchants | No validation | Add `$or` condition in atomic query |
| Null returns | Hardcoded `return null` | Change to `return cart` |
| Stale totals | No recalculation | Add pricing recalculation after all modifications |

### 4. Execute the Fixes

I implemented all fixes in `repository_after/cartService.js`:

- **Lines 67-69**: Added quantity validation with clear error message
- **Lines 101-106**: Fixed discount date range logic
- **Lines 137-177**: Replaced find-then-save with atomic `findOneAndUpdate`
- **Lines 203-205**: Added quantity validation for updates
- **Lines 264-266**: Added pricing recalculation after update
- **Lines 291-296**: Added pricing recalculation and return cart after remove
- **Lines 306-307**: Added pricing reset and return cart after clear

### 5. Verify with Comprehensive Tests

I created 17 test cases covering all 6 bugs plus edge cases:

| Category | Tests |
|----------|-------|
| Quantity validation | 4 tests (zero, negative, non-integer, valid) |
| Duplicate prevention | 1 test (atomic operation) |
| Discount logic | 2 tests (active, inactive) |
| Merchant validation | 2 tests (same, different) |
| Return values | 1 test (returns cart) |
| Pricing recalculation | 3 tests (subtotal, totalItems, after remove) |
| Edge cases | 4 tests (no merchantId, Decimal128, empty cart, zeroed pricing) |

**Results:**
- `repository_before`: 8/17 tests pass, 9 fail (bugs present)
- `repository_after`: 17/17 tests pass (all bugs fixed)

### Core Principle Applied

**Audit → Contract → Design → Execute → Verify**

The trajectory follows the same structure used in refactoring, adapted for bug fixing:
- Code audit becomes bug pattern identification
- Performance contract becomes fix guarantees
- Data model refactor becomes targeted code changes
- Verification becomes test coverage proving fixes work
