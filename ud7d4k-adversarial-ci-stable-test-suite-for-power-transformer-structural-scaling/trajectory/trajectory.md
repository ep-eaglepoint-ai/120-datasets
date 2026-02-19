# Trajectory: Adversarial, CI-Stable Test Suite for Power Transformer Structural Scaling

## 1. AUDIT / REQUIREMENTS ANALYSIS
**Guiding Question**: *What exactly needs to be built, and what are the constraints?*

The objective is an **ADVERSARIAL TESTING** task: building an exhaustive pytest suite for a numerically sensitive scientific Python package. Unlike naive unit tests, this suite must catch silent numerical bugs, statistical misuse, and regression errors that ordinary tests miss.

### Core Requirements
* **Input validation**: Reject NaN, ±inf, empty arrays, non-1D inputs (except (n,1) column vectors); coerce valid inputs to float and preserve shape (n,).
* **Method-specific domain**: Box-Cox must fail loudly for any value ≤ 0 (error message includes min value); Yeo-Johnson must accept mixed-sign data and return finite outputs.
* **Numerical stability**: Deterministic behavior under fixed RNG; stable lambda estimation across repeated fits; invertibility within tight tolerances.
* **Statistical sanity**: Moment-based checks (skew/kurtosis reduction) on log-normal, exponential, chi-square; large-sample (n ≥ 10,000) moment convergence without fragile normality p-values.
* **Structural and evaluation**: Structural tests that validate package layout (modules, dataclasses, exports); evaluation script that runs pytest against repository_before and repository_after and writes a report; exactly three Docker commands.

### Constraint Analysis
* **CI-safe and deterministic**: All tests use fixed RNG seeds and fixtures; no flaky or environment-dependent assertions.
* **Before vs after**: Tests live at project root; PYTHONPATH selects repository_before or repository_after. Most tests fail on before (baseline); all pass on after (optimized).
* **No fragile gates**: Avoid using normality p-values as strict pass/fail; use skew/kurtosis improvement and moment-based criteria instead.

---

## 2. QUESTION ASSUMPTIONS
**Guiding Question**: *Why are we doing this? Is this the right approach?*

* **Initial Assumption**: "We can rely on normality p-values to validate the transform."
    * **Reality**: For large n, normality tests become extremely sensitive; using them as a gate causes false failures. The prompt explicitly requires moment-based validation (skew/kurtosis reduction) and large-sample behavior that avoids p-value thresholds.
* **Initial Assumption**: "Tests can live inside repository_after."
    * **Reality**: The same test suite must run against both repository_before and repository_after. Tests live at project root; PYTHONPATH is set to the chosen repository’s `power_transformer_project/src` so `structural_scaling` resolves to the correct implementation.
* **Lesson**: You are not testing outputs—you are defending mathematical guarantees against numerical, statistical, and usage-related failure modes.

---

## 3. DEFINE SUCCESS CRITERIA
**Guiding Question**: *What does "done" mean in concrete, measurable terms?*

**[Input validation (Requirements 1–4)]**:
- **Acceptance Criteria**: NaN, ±inf, empty arrays, and non-1D (except (n,1)) raise ValueError with clear messages; valid int/float32/float64 inputs are coerced to float64 and output shape is (n,).
- **Verification Method**: Parametrized unit tests in `test_unit_input_validation.py` with requirement comments.

**[Method domain (Requirements 5–7)]**:
- **Acceptance Criteria**: Box-Cox raises ValueError when any value ≤ 0, message includes min value; Yeo-Johnson accepts negative/zero/positive and returns finite output; all valid inputs yield finite transformed output.
- **Verification Method**: Unit tests in `test_unit_power_transform.py`; adversarial tests in `test_adversarial.py`.

**[Invertibility and shape (Requirements 8–9)]**:
- **Acceptance Criteria**: `invertibility_check` returns True for correct (original, transformed, transformer) within atol and False for corrupted data; raises ValueError on shape mismatch.
- **Verification Method**: Unit tests in `test_unit_invertibility.py`.

**[Stability and diagnostics (Requirements 10–11)]**:
- **Acceptance Criteria**: Repeated `fit_transform_power` on same input yields identical `transformer.lambdas_`; `normality_report(test="normaltest")` uses Shapiro-Wilk for n < 20 and sets `test_name` to `"shapiro(fallback)"`.
- **Verification Method**: Unit tests in `test_unit_power_transform.py` and `test_unit_diagnostics.py`.

**[Evaluation and Docker]**:
- **Acceptance Criteria**: `evaluation.py` runs pytest twice (before/after), parses JUnit XML, writes `evaluation/<date>/<time>/report.json`; exactly three Docker commands (test before, test after, generate report).
- **Verification Method**: Run the three commands from README; report contains `results.before`, `results.after`, `comparison`; success = after passed.

---

## 4. MAP REQUIREMENTS TO VALIDATION
**Guiding Question**: *How will we prove the solution is correct and complete?*

| Requirement | Test Strategy | Test Category |
| :--- | :--- | :--- |
| **Input validation (1–4)** | NaN/inf/empty/non-1D/ragged/dtype → ValueError or coercion | Unit (input_validation) |
| **Box-Cox / Yeo-Johnson (5–7)** | Box-Cox rejects ≤0 with min; YJ mixed-sign; finite output | Unit (power_transform) |
| **Invertibility (8–9)** | True for correct triple; False for corrupted; shape mismatch raises | Unit (invertibility) |
| **Lambda / normaltest (10–11)** | Repeated fit → same lambdas_; n<20 → shapiro(fallback) | Unit (power_transform, diagnostics) |
| **Statistical sanity** | Skew/kurtosis reduction on log-normal, exponential, chi-square | Statistical properties |
| **Large sample** | n ≥ 10,000; moment convergence; no p-value gate | Large-sample behavior |
| **Adversarial** | Nearly constant, extremely skewed, large dynamic range | Adversarial |
| **Structure** | Modules, _to_1d_float_array, NormalityMetrics, TransformResult, __all__ | Structural (before_after) |

**Mental Checkpoint**: "If we run the same test file with PYTHONPATH=before vs PYTHONPATH=after, do we get the expected pass/fail split? Structural tests must not hardcode paths—only inspect the imported package."

---

## 5. SCOPE THE SOLUTION
**Guiding Question**: *What is the minimal implementation that meets all requirements?*

### Repository and Test Inventory
* **repository_after/power_transformer_project/src/structural_scaling/**: `__init__.py`, `diagnostics.py` (NormalityMetrics, _to_1d_float_array, normality_report, improved_normality, approx_normal_by_moments), `power_transform.py` (TransformResult, fit_transform_power, invertibility_check).
* **tests/**: `conftest.py` (RNG seed, positive_1d, mixed_sign_1d); `test_unit_input_validation.py`; `test_unit_power_transform.py`; `test_unit_invertibility.py`; `test_unit_diagnostics.py`; `test_statistical_properties.py`; `test_large_sample_behavior.py`; `test_adversarial.py`; `test_integration.py`; `test_structure_before_after.py`.
* **evaluation/evaluation.py**: Run pytest with PYTHONPATH=before then after; parse JUnit XML; build report (run_id, started_at, finished_at, duration_seconds, success, environment, results.before, results.after, comparison); write JSON to evaluation/<date>/<time>/report.json.
* **Docker**: One Dockerfile (Python 3.11, requirements.txt); docker-compose with one service; README lists exactly three commands.

---

## 6. TRACE DATA/CONTROL FLOW
**Guiding Question**: *How will data/control flow through the new system?*

**Test execution flow**:
1. **Select target**: User or CI sets PYTHONPATH to `repository_before/power_transformer_project/src` or `repository_after/power_transformer_project/src`.
2. **Import**: Tests import `structural_scaling`; Python resolves it from PYTHONPATH.
3. **Unit tests**: Input validation, method domain, invertibility, diagnostics—each asserts invariants (ValueError messages, shapes, dtypes, finite output, lambda stability, test_name).
4. **Statistical / large-sample / adversarial**: Same package; RNG-seeded data; moment-based and invertibility assertions; no p-value gates.
5. **Structural tests**: Inspect `structural_scaling`, `diagnostics`, `power_transform` (modules, callables, dataclass fields, __all__); no path hardcoding.

**Evaluation flow**:
1. **Run 1**: evaluation.py sets PYTHONPATH=repository_before/.../src, runs pytest tests/ --junitxml=temp_before.xml.
2. **Run 2**: PYTHONPATH=repository_after/.../src, pytest tests/ --junitxml=temp_after.xml.
3. **Parse**: Read JUnit XML; build TestResult list (nodeid, name, outcome) and TestSummary (total, passed, failed, errors, skipped).
4. **Report**: Build comparison (before_tests_passed, after_tests_passed, counts); write report.json; exit 0 iff after passed.

---

## 7. ANTICIPATE OBJECTIONS
**Guiding Question**: *What could go wrong? What objections might arise?*

**Objection 1**: "Normality tests are the right way to validate that the transform improved the distribution."
- **Counter**: The prompt forbids relying on fragile normality p-values. For large n, everything fails normality tests; we use skew/kurtosis reduction and moment-based criteria (improved_normality, approx_normal_by_moments) instead.

**Objection 2**: "Why run the same tests twice instead of one config that switches implementation?"
- **Counter**: Evaluation must produce a before/after comparison and a single report. Running pytest twice with different PYTHONPATH is the same pattern as the TypeScript reference (Jest run with TEST_TARGET=before then after); it keeps the report shape identical and avoids conditional logic inside tests.

**Objection 3**: "Structural tests will pass on both before and after if they have the same layout."
- **Counter**: Structural tests encode the *expected* layout (e.g. _to_1d_float_array, frozen NormalityMetrics, TransformResult with transformed/transformer). If repository_before is missing these or uses different names, structural tests fail on before. The plan assumes before may lack correct structure so those tests fail there.

---

## 8. VERIFY INVARIANTS / DEFINE CONSTRAINTS
**Guiding Question**: *What must remain true throughout the implementation?*

**Must satisfy**:
- All entry points (fit_transform_power, normality_report, invertibility_check, etc.) validate input via _to_1d_float_array or equivalent; NaN/inf/empty/non-1D raise ValueError. ✓
- Box-Cox path checks for any value ≤ 0 and raises with message including min value. ✓
- invertibility_check returns True only when inverse_transform(transformed) is allclose(original, atol=atol). ✓
- normality_report(test="normaltest") uses n < 20 → Shapiro-Wilk and test_name "shapiro(fallback)". ✓
- evaluation.py writes report to evaluation/<YYYY-MM-DD>/<HH-MM-SS>/report.json and exits 0 iff after passed. ✓

**Must not violate**:
- No tests that depend on repository path; only PYTHONPATH and the imported package. ✓
- No default Docker CMD that runs both test targets and evaluation; only the three documented commands. ✓
- No flaky or environment-dependent assertions; RNG seeds and fixtures are fixed. ✓

---

## 9. EXECUTE WITH SURGICAL PRECISION
**Guiding Question**: *In what order should changes be made to minimize risk?*

1. **Step 1: repository_after**: Create directory tree and copy/refactor structural_scaling (diagnostics, power_transform, __init__) so requirements 1–11 are met.
    * *Rationale*: The test suite and evaluation target this implementation; it must exist first.
2. **Step 2: Root tests**: Add conftest.py and all test modules (unit input validation, power_transform, invertibility, diagnostics; statistical properties; large-sample; adversarial; integration; structure) with requirement-mapping comments on each test.
    * *Rationale*: One suite, two targets; structural tests inspect the imported package only.
3. **Step 3: evaluation.py**: Implement run-twice (before/after), JUnit XML parsing, report dict, and file write; run from project root.
    * *Rationale*: Matches TypeScript evaluation pattern; report shape (results.before, results.after, comparison) is required.
4. **Step 4: Docker and README**: requirements.txt (numpy, scipy, scikit-learn, pytest); Dockerfile without all-in-one CMD; docker-compose with three documented commands; README with title and the three commands only.
    * *Rationale*: Exactly three runnable commands; no hidden default behavior.

---

## 10. MEASURE IMPACT / VERIFY COMPLETION
**Guiding Question**: *Did we build what was required? Can we prove it?*

**Requirements completion**:
- **Input validation (1–4)**: Unit tests reject NaN/inf/empty/non-1D (except (n,1)); dtype coercion and shape (n,) verified. ✓
- **Method domain (5–7)**: Box-Cox error message includes min; Yeo-Johnson mixed-sign and finite output; all valid inputs yield finite output. ✓
- **Invertibility (8–9)**: True for correct triple, False for corrupted; shape mismatch raises. ✓
- **Stability and diagnostics (10–11)**: Lambda stability under repeated fit; normaltest n<20 → shapiro(fallback). ✓
- **Statistical and large-sample**: Moment-based skew/kurtosis reduction; n ≥ 10,000 without p-value gate. ✓
- **Structural**: Module layout, _to_1d_float_array, NormalityMetrics, TransformResult, __all__ asserted. ✓
- **Evaluation**: evaluation.py runs both targets, parses JUnit XML, writes report.json; success = after passed. ✓
- **Docker**: Three commands only (test before, test after, generate report). ✓

**Quality metrics**:
- **Determinism**: All tests use conftest RNG seed and explicit seeds where needed; CI-safe and cross-platform.
- **Traceability**: Each test file and test has requirement comments (e.g. # Requirements: 1 or # Prompt: large-sample).

---

## 11. DOCUMENT THE DECISION
**Guiding Question**: *Why did we do this, and when should it be revisited?*

* **Problem**: Need for a high-integrity, adversarial pytest suite for a power-transformer structural-scaling package used in production; silent numerical or statistical bugs are unacceptable.
* **Solution**: Single test suite at project root; PYTHONPATH selects repository_before or repository_after; exhaustive unit, statistical, large-sample, adversarial, integration, and structural tests; evaluation.py ports the TypeScript evaluation pattern (run twice, parse results, write report); exactly three Docker commands.
* **Trade-offs**: Same test code runs against two implementations, so repository_before must be loadable and have compatible structure for tests to execute (even if many fail). Structural tests are written so that missing or wrong structure in before causes failures.
* **Why this works**: Moment-based validation avoids p-value traps at large n; deterministic RNG and fixtures keep tests stable; JUnit XML is built-in to pytest, so no extra dependency for evaluation.
* **When to revisit**: If repository_before is intentionally stripped down (e.g. missing _to_1d_float_array or NormalityMetrics), structural tests will fail on before as desired; if before is later brought in line with after, consider adding more adversarial or structural checks to preserve the before/after failure/pass split.
