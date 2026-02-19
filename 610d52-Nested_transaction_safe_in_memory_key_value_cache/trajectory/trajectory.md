# Trajectory: Thinking Process for Implementing a Nested Transaction-Safe In-Memory Cache

## 1. Audit the Problem Statement
**Goal:** Identify core constraints and failure modes using a First Principles approach.

I began by breaking the system down into its most basic truths: storage, visibility, and mutation. The key challenges identified were:
* **Arbitrarily nested transactions:** Support for infinite depth.
* **Visibility rules:** "Most recent write wins" across various scopes.
* **Shadow Deletions:** Handling removals without polluting the base store or parent scopes.
* **Isolation:** Strict boundaries between transaction layers.
* **Efficiency:** Explicit prohibition of full-store copying (avoiding O(N) state duplication).
* **Invariants:** Only committed data reaches the base store.

**External References:**
* https://en.wikipedia.org/wiki/Database_transaction
* https://jepsen.io/consistency

---

## 2. Define a Behavioral Contract
Before implementation, I defined a clear logic for how each operation interacts with the "truth" of the data:

* **BEGIN:** Create a new isolated transaction scope (a new layer).
* **SET:** Affect only the top-most scope in the current stack.
* **DELETE:** Shadow parent values without removing them (using a marker).
* **GET:** Resolve values using most-recent-visible-write semantics (scanning top-down).
* **COMMIT:** Merge only the current scope into its immediate parent.
* **ROLLBACK:** Discard only the current scope.

**External Reference:**
* https://martinfowler.com/articles/patterns-of-distributed-systems/transactional-outbox.html

---

## 3. Choose a Delta-Based Transaction Model
To satisfy the constraint against full-state copying, I adopted a delta-layer model:

1. **Base Store:** Holds only committed, permanent values.
2. **Write-Set:** Each transaction is represented as a "delta map" (only changes).
3. **The Stack:** Transactions are stored in a stack to support arbitrary nesting.
4. **Resolution:** Reads walk the stack from newest to oldest until a value or delete marker is found.

**External References:**
* https://en.wikipedia.org/wiki/Copy-on-write
* https://www.usenix.org/legacy/publications/library/proceedings/usenix02/tech/freenix/full_papers/mckusick/mckusick.pdf

---

## 4. Represent Deletions Using Explicit Tombstones
A critical design decision was to represent deletions using a unique sentinel (tombstone) instead of `None` or immediate removal.

* **Shadowing:** Deletions can hide values in parent layers without actually deleting them.
* **Rollback Safety:** A rollback simply removes the tombstone, restoring the parent's visibility automatically.
* **Purity:** The base store remains clean of these markers.

**External References:**
* https://cassandra.apache.org/doc/latest/cassandra/architecture/storage_engine.html
* https://rocksdb.org/blog/2017/12/07/delete.html

---

## 5. Enforce Strict Scope Isolation
All mutations (SET, DELETE) are written only to the current transaction layer. Parent scopes are never mutated directly. This guarantees:
* Rollbacks are trivial (drop the top layer).
* Child transactions cannot leak changes upward prematurely.
* Transaction nesting behaves predictably.

**External Reference:**
* https://www.geeksforgeeks.org/static-and-dynamic-scoping/

---

## 6. Implement Commit as a Local Merge Operation
On COMMIT, only the top transaction layer is merged:
* Into its immediate parent if one exists.
* Into the base store if it is the outermost transaction.

This avoids "flattening" the entire stack prematurely and preserves nested semantics.

**External Reference:**
* https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf

---

## 7. Validate Using Black-Box Tests
I validated correctness by running tests inside a Docker environment to ensure:
* Public API compatibility.
* Correct import behavior across modules.
* Consistent results regardless of the host environment.

**External Reference:**
* https://docs.pytest.org/en/stable/how-to/usage.html

---

## 8. Final Result: Correct Semantics with Clean Invariants
The final implementation achieves:
* Arbitrarily nested transactions.
* Strict isolation.
* Correct shadowing of deletions.
* O(1) average-time mutations.
* A base store that only contains final, committed values.

### Trajectory Transferability
This structure (Audit → Contract → Design → Execute → Verify) is highly reusable for:
* State management libraries.
* Compiler symbol tables.
* Undo/redo engines.