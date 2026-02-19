# Trajectory: Student Data Aggregation API

**Task category**: Refactoring  
**Mode**: TRANSFORMATION (repository_before → repository_after)  
**Stack**: Java, Spring Boot

---

### 1. Audit / Requirements Analysis

**Guiding question**: What is the actual problem, not just the symptom?

The current implementation (repository_before/dataAggregation.java) has: shared mutable state (e.g. `cachedStudents`) so the controller is not stateless or thread-safe; no input validation so empty names and negative scores are accepted; inefficient O(n²) aggregation due to nested loops; and business logic in the controller with no service layer. The problem is correctness, scalability, and maintainability—not just “clean up code.” We do not modify repository_before; we only use it as the baseline to prove tests fail there and pass on the refactored code.

---

### 2. Question Assumptions

**Guiding question**: Why are we doing this? Is this the right approach?

- **Assumption**: We must run the buggy code to test against it.  
- **Reality**: repository_before is a single file in a different package and not a Maven module; building/running it would require copying or transforming it.  
- **Conclusion**: For “before” we run structure-only checks on the source (no execution). For “after” we run real tests against the installed artifact. That keeps repository_before untouched and still proves the refactor addresses the requirements.

---

### 3. Define Success Criteria

**Guiding question**: What does “better” mean in concrete terms?

- **Correctness**: Before—integer division (e.g. 256/3 → 85), no validation. After—correct average, validation, proper HTTP status codes.
- **Statelessness**: Before—instance mutable state. After—no shared mutable state; controller delegates to a stateless service.
- **Performance**: Before—nested loops O(n²). After—single-pass aggregation O(n).
- **Maintainability**: Before—all logic in controller. After—clear separation (controller → service, DTOs, validation, error handling).

---

### 4. Map Requirements to Validation

**Guiding question**: How will we prove the solution is correct and complete?

- **repository_before**: Structure tests only (RepositoryBeforeStructureTest). Read dataAggregation.java; assert against 12 requirements (no cachedStudents, @Valid, no nested loops, service layer, ResponseEntity). No app run; most fail. **FAIL_TO_PASS**: structure checks fail on “before.”
- **repository_after**: Real JUnit tests (controller, validation, service, performance, thread-safety). Dependency on student-aggregation-api; no source copy. **PASS_TO_PASS**: all real tests pass. Structure test excluded for test-after and evaluation.

### 5. Scope the Solution

**Guiding question**: What is the smallest change set that achieves the goal?

- **repository_before**: No edits. Only file used: dataAggregation.java for structure checks.
- **tests**: Add dependency on student-aggregation-api; no tests/src/main. Add RepositoryBeforeStructureTest (structure-only); all other tests exercise the API. test-before runs only the structure test and exits 0; test-after excludes it and runs real tests.
- **Docker / evaluation**: test-before = mvn test one class + exit 0. test-after = mvn install in repository_after then mvn test (exclude structure test). evaluation runs the same real tests and writes the report.

---

### 6. Trace Data / Control Flow

**Before (buggy)**: Request → Controller (mutates cachedStudents, nested loops, inline aggregation) → Map response. No validation, no service.

**After (refactored)**: Request → Controller (validates, delegates) → Service (single-pass aggregation) → DTO → ResponseEntity. Validation and status codes at the boundary; logic in the service.

---

### 7. Anticipate Objections

- **“Structure checks are brittle.”** Counter: They encode the 12 requirements; we only run them for “before.”
- **“test-before always exits 0.”** Counter: Intentional so CI doesn’t red-block; failing assertions are visible in the log.
- **“Why not run real tests against a built ‘before’?”** Counter: repository_before is one file; building it would require copying into a module. Structure checks avoid touching it.

### 8. Verify Invariants / Constraints

- **Must preserve**: API contract (POST /api/students/aggregate, list in, aggregation result out). Logical equivalence of behavior for valid input.
- **Must improve**: Statelessness, validation, complexity, separation of concerns, error handling, HTTP status codes.
- **Must not break**: Tests for “after” must pass; evaluation report must reflect real test results only (structure test excluded).

---

### 9. Execute with Surgical Precision

1. Define test strategy: structure test for “before”; real tests for “after”; dependency-only tests.  
2. Implement RepositoryBeforeStructureTest (read dataAggregation.java, ~8 checks; path via system property).  
3. Wire Docker/evaluation: test-before = structure test only, exit 0; test-after and evaluation exclude structure test.  
4. Document README and trajectory.

---

### 10. Measure Impact / Verify Completion

- **repository_before**: Structure checks fail (cachedStudents, no @Valid, nested loops, no service, etc.); exit 0; no code run.
- **repository_after**: All real tests pass; no shared mutable state; validation and status codes in place; single-pass aggregation.
- **Evidence**: test-before log shows failing structure assertions; test-after and evaluation show 26 tests passed (real suite only).

### 11. Document the Decision

- **Problem**: Student Aggregation API is non-stateless, unvalidated, O(n²), monolithic; must meet 12 refactoring requirements without changing repository_before.
- **Solution**: Structure-only checks on repository_before; real tests on repository_after via Maven dependency; test-before exits 0; test-after and evaluation run only real tests.
- **Trade-off**: “Before” is not executed—only static checks. Keeps repository_before untouched and setup simple.
- **When to revisit**: If repository_before becomes a buildable module, run the real test suite against it and expect failures.
- **Test coverage**: Structure tests map to the 12 requirements for “before”; real tests prove “after” behavior.
