# Trajectory (Thinking Process for Correcting a Deep Clone Utility)

### 1. Audit the Original Code (Identify Functional Gaps)
I audited the original `deepClone` implementation. The function only handled primitives, arrays, and plain objects. It failed to preserve special JavaScript object types, shared references between original and cloned objects, and crashed on circular references due to unbounded recursion.

To understand why naïve deep cloning fails in JavaScript, I reviewed material on reference types and object identity:
* [JavaScript object references and mutability](developer.mozilla.org)

### 2. Define a Correctness Contract First
Before changing code, I defined a strict correctness contract based on the task requirements:
* Primitives must be returned as-is.
* Each supported object type must preserve its semantic behavior.
* All clones must have independent references.
* Circular references must not crash and must preserve structure.
* Function signature must remain unchanged.
* No additional features beyond required types.

This aligns with defensive programming principles for cloning complex object graphs:
* [Defensive copying and object graph integrity](martinfowler.com)

### 3. Identify JavaScript Types Requiring Explicit Handling
I enumerated which JavaScript values require custom cloning logic:
* **Date** → internal timestamp must be preserved.
* **RegExp** → pattern and flags must be preserved.
* **Map** → keys and values may be reference types.
* **Set** → values may be reference types.
* **Arrays** → ordered collections with possible cycles.
* **Plain objects** → recursive property cloning.

This classification is based on JavaScript’s object model and built-in types:
* [JavaScript built-in objects overview](developer.mozilla.org)

### 4. Introduce Circular Reference Tracking
I identified circular references as the primary cause of crashes. To address this, I introduced a visited-object registry.

I used a `WeakMap` to map original objects to their cloned counterparts. This allows the algorithm to return an existing clone when encountering a previously visited object, preventing infinite recursion and preserving reference structure.

Background reference on weak references and garbage collection:
* [WeakMap and memory-safe object tracking](developer.mozilla.org/WeakMap)

### 5. Design Type-Specific Cloning Strategy
I designed a deterministic, ordered dispatch strategy:
1. Return primitives immediately.
2. Detect previously visited objects.
3. Handle special object types explicitly (Date, RegExp, Map, Set).
4. Handle arrays.
5. Fallback to plain object cloning.

This ordering ensures that specific behaviors are preserved before generic object handling occurs.

Reference on why order matters in type guards:
* [Type checking and instanceof behavior](developer.mozilla.org)

### 6. Execute Changes with Minimal Surface Area
* I implemented the changes inside `repository_after` only, leaving the original repository untouched.
* The function signature was preserved.
* No global state was introduced.
* All recursion passed through the same visited registry.
* Each clone was registered before descending recursively, ensuring circular safety.

This follows standard graph traversal principles:
* [Graph traversal with visited-node tracking](en.wikipedia.org)

### 7. Preserve Determinism and Reproducibility
I ensured the implementation:
* Uses no randomness.
* Uses no time-dependent behavior.
* Iterates collections deterministically.
* Produces identical output for identical input graphs.

This is essential for reproducibility and test reliability:
* [Deterministic behavior in software systems](testing.googleblog.com)

### 8. Validate Against Acceptance Criteria
I validated the implementation against all provided acceptance criteria:
* Primitive values return unchanged.
* Objects return new references.
* Date objects preserve timestamps.
* RegExp objects preserve pattern and flags.
* Map and Set contents are recursively cloned.
* Circular references do not crash and preserve structure.
* Mutating the clone does not affect the original.

I also manually validated circular self-references and nested object graphs.

### 9. Result: Correct, Stable, and Type-Safe Deep Cloning
The final implementation:
* Handles all required JavaScript data types correctly.
* Preserves object semantics and graph structure.
* Avoids shared references.
* Prevents infinite recursion.
* Meets all stated task requirements without adding unsupported behavior.

---

## Trajectory Transferability Notes
This trajectory structure is reusable across multiple task categories:

### 🔹 Utility Function Correction
* **Audit** becomes behavior gap analysis.
* **Contract** becomes explicit type and correctness requirements.
* **Design** focuses on data model semantics.
* **Verification** relies on acceptance tests and invariants.

### 🔹 Refactoring
* **Audit** becomes duplication or complexity analysis.
* **Contract** becomes behavioral equivalence guarantees.
* **Design** focuses on structure preservation.
* **Verification** relies on equivalence testing.

### 🔹 Testing
* **Audit** becomes coverage and risk analysis.
* **Contract** becomes test guarantees.
* **Design** focuses on edge cases and invariants.
* **Verification** uses deterministic assertions.

### Core Principle (Applies to All)
* The trajectory structure remains constant.
* Only the focus and artifacts change.
* The sequence **Audit** → **Contract** → **Design** → **Execute** → **Verify** is preserved.
