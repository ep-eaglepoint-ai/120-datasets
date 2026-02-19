
# Trajectory: Expression Parser Calculator Refactor

## 1. Initial Setup
- Created the `repository_after` directory at the start to hold the refactored implementation, keeping the original in `repository_before` for comparison and evaluation.

## 2. Understand and Clarify Requirements
- Carefully read the problem statement and all requirements.
- Identified all core bugs: operator precedence, parentheses, negative numbers, division by zero, decimals, whitespace, and input validation.
- Clarified acceptance criteria and error message expectations.
- Noted constraints: no eval/exec, no external libraries, must handle invalid input gracefully, and maintain the same API.

## 3. Plan and Prepare
- Decided to write comprehensive tests before modifying any code.
- Outlined a plan: test current behavior, identify failures, then fix bugs one by one.

## 4. Write and Validate Tests
- Wrote tests for all acceptance criteria and edge cases, including valid and invalid expressions.
- Ensured tests cover PEMDAS, parentheses, exponents, negative numbers, decimals, whitespace, division by zero, and invalid/empty input.

## 5. Baseline: Test Before Refactoring
- Ran the test suite against the original implementation (`repository_before`) to confirm which cases fail.
- Documented all failing cases as targets for the refactor.

## 6. Refactor Implementation
- Refactored the code step by step in `repository_after`:
  - Improved tokenization to handle unary minus, decimals, and parentheses.
  - Implemented a recursive descent parser for correct operator precedence (PEMDAS).
  - Added error handling for division by zero and invalid input.
  - Ensured all error messages match requirements.

## 7. Run Tests After Refactoring
- Ran the test suite for `repository_after`; encountered and fixed issues (e.g., invalid input handling).
- Re-ran the tests to confirm all cases now pass.

## 8. Validate Test Coverage
- Reviewed all tests to ensure every requirement and edge case is covered.
- Considered if any additional tests are needed for untested scenarios.

## 9. Run All Tests in Docker
- Ensured all tests are run via Docker (no raw runs allowed) to match production and CI environments.
- Verified that all tests pass in the containerized environment for both before and after implementations.

## 10. Create and Run Evaluation Script
- Developed an evaluation script to automate comparison between before and after implementations.
- The script runs only the relevant test files (`test_before.py` and `test_after.py`) for each version.
- Compared results and ensured the report structure matches requirements.

## 11. Verify All Tests Pass on After
- Confirmed that all tests pass for the after implementation, both locally and in Docker.
- Used the evaluation report to verify correctness and completeness of the solution.
