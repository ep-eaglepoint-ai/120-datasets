# Trajectory — PostgreSQL Order Management Function  
**Trajectory (Thinking Process for Database-Level Order Processing)**

---

## 1. Audit the Problem Space (Identify Failure & Integrity Risks)

I audited the problem requirements for real-world order processing. Key risks included invalid input, duplicate request processing, race conditions on inventory, partial writes across multiple tables, and inconsistent error signaling. I also identified that order creation, inventory updates, and audit logging must succeed or fail together to prevent data corruption.

---

## 2. Define a Consistency & Integrity Contract First

I defined strict behavioral guarantees for the function:

- All validations must occur before mutating state  
- Duplicate requests must be rejected deterministically  
- Inventory checks must be concurrency-safe  
- Order creation, inventory deduction, and audit logging must be atomic  
- Every execution path must return a structured result  
- Errors must map to predictable SQLite-style error codes  

This contract ensures correctness under concurrent production traffic.

---

## 3. Design a Domain-Correct Data Contract

I introduced a structured return type (`order_result`) to standardize outcomes. This return contract includes:

- Success flag  
- Generated order identifier  
- SQLite-style error code  
- Human-readable message  

This avoids reliance on exceptions at the application layer and enables deterministic behavior across services.

---

## 4. Enforce Defensive Input Validation Early

All inputs are validated upfront:

- Null checks for required parameters  
- Quantity must be positive  
- Request ID must be present  

Invalid input paths exit immediately with explicit error codes and audit log entries, preventing wasted computation and side effects.

---

## 5. Prevent Duplicate Processing (Idempotency)

I enforced idempotency by validating `request_id` uniqueness before processing. Duplicate requests are rejected with a constraint-style error code, ensuring the function can safely be retried without producing duplicate orders.

---

## 6. Validate Business State in Correct Sequence

Validation proceeds in a strict order to minimize unnecessary work:

1. Customer existence  
2. Customer active status  
3. Product existence  
4. Product availability  
5. Inventory presence  
6. Inventory sufficiency  

Each failure path records a structured audit entry and exits immediately.

---

## 7. Apply Concurrency-Safe Inventory Control

Inventory is read using `FOR UPDATE` row-level locking to prevent race conditions during concurrent order processing. This guarantees that inventory deduction remains consistent even under high contention.

---

## 8. Execute State Mutations Atomically

Order creation, inventory deduction, and success audit logging are executed as a single atomic unit within the function’s transaction context. Either all changes persist, or none do.

---

## 9. Implement Structured Exception Mapping

PostgreSQL exceptions are mapped to SQLite-style error codes:

- Unique violations → `SQLITE_CONSTRAINT`  
- Check violations → `SQLITE_CONSTRAINT`  
- Foreign key violations → `SQLITE_CONSTRAINT`  
- Insufficient inventory → `SQLITE_BUSY`  
- Invalid input → `SQLITE_MISMATCH`  
- Missing entities → `SQLITE_NOTFOUND`  

Unexpected errors are caught and logged with diagnostic context.

---

## 10. Result: Predictable, Production-Grade Order Processing

The final function:

- Is fully deterministic and idempotent  
- Enforces business rules at the database level  
- Guarantees atomicity and consistency  
- Produces complete audit trails  
- Returns structured, machine-readable results  
- Handles real-world edge cases safely  

This implementation is suitable for production systems requiring strong data integrity and predictable failure behavior.

---

## Trajectory Transferability Notes

The above trajectory is designed for **database-level transactional logic**. The same structure can be reused across other domains by adjusting focus, not structure.

### 🔹 Database Functions → Backend Services
- Input validation becomes API contract validation  
- Transaction boundaries map to service-level units of work  
- Error codes map to HTTP or domain errors  

### 🔹 Database Functions → Distributed Systems
- Idempotency logic maps to request deduplication  
- Audit logging maps to event sourcing or observability  
- Concurrency control maps to optimistic or pessimistic locking  

### 🔹 Database Functions → Financial or Ledger Systems
- Inventory logic maps to balance enforcement  
- Atomic writes map to ledger integrity  
- Audit logs become compliance artifacts  

---

## Core Principle (Applies to All)

- The trajectory structure remains constant  
- Only the problem focus and artifacts change  
- **Audit → Contract → Design → Execute → Verify** remains invariant