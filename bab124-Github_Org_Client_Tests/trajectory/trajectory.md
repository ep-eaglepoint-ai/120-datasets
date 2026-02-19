# Trajectory

# Trajectory: Strengthening Test Coverage for `GithubOrgClient`

## Problem Context

The original test suite for the `GithubOrgClient` class provided only **partial coverage** of its functionality.  
It focused primarily on validating:

- The `org` property
- The `_public_repos_url` property

However, several **critical behaviors were untested**, including:

- Retrieving public repositories via `public_repos`
- Filtering repositories by license
- Validating license data
- Handling edge cases such as empty responses or missing fields
- Verifying error and failure paths

This created a situation where the test suite could pass even if important parts of the client were broken or regressed.

---

## First-Principles Analysis

### What Does It Mean to “Test” Code?

From first principles, a test must do three things:

1. **Define a condition** (input or state)
2. **Define an expected outcome**
3. **Assert the observable behavior**

If any of these are missing, the test does not meaningfully verify correctness.

---

### What Must Be Tested for an API Client?

An API client interacts with an **unreliable external system**.  
Therefore, tests must cover three distinct categories:

1. **Happy paths**
   - Valid responses
   - Expected data shapes
2. **Edge cases**
   - Empty lists
   - Missing or `None` fields
   - Unexpected but valid payloads
3. **Failure modes**
   - Exceptions from the HTTP layer
   - Invalid or malformed data

The original test suite only addressed category **(1)**.

---

## Audit of the Original Test Suite (`repository_before`)

### What Was Covered

- Correct URL construction for organization requests
- Successful JSON retrieval
- Property accessors returning expected values

### What Was Missing

| Missing Area | Risk Introduced |
|-------------|----------------|
| No tests for `public_repos` | Repository logic could break silently |
| No license filtering tests | Incorrect filtering would go unnoticed |
| No edge case tests | Empty or malformed data could cause runtime errors |
| No negative assertions | Tests only confirmed success, not correctness |

The result was **illusory confidence** rather than verified correctness.

---

## Design of the Improved Test Suite (`repository_after`)

### Testing Strategy

The improved test suite was designed to **challenge assumptions** rather than confirm them.

Each new test answers a concrete question:

> *How does the client behave when the input is incomplete, incorrect, or unexpected?*

---

## Extended Coverage Areas

### 1. `public_repos` Method

The following behaviors are now explicitly tested:

- Returning all repository names when no license filter is applied
- Correct filtering when a license key is provided
- Handling repositories with:
  - Missing `license` fields
  - `license = None`
  - Missing `name` fields
- Correct behavior when the repository list is empty

---

### 2. License Validation (`has_license`)

The static method `has_license` is now tested for:

#### True cases
- Matching license keys
- Valid license dictionaries

#### False cases
- Mismatched license keys
- Missing `license` field
- `license = None`
- Invalid license structures

These tests ensure the method behaves predictably across all realistic inputs.

---

## Why Pytest Was Used

Pytest was selected because it aligns naturally with contract-based testing:

- Explicit exception assertions
- Clear failure reporting
- Easy parametrization of edge cases
- Minimal boilerplate

This makes it well-suited for validating **behavioral guarantees**, not just outputs.

Pytest documentation on exception assertions:  
https://docs.pytest.org/en/stable/how-to/assert.html#assertions-about-expected-exceptions

---

## Proving “Fail Before, Pass After”

### Execution Results

| Repository | Result |
|-----------|--------|
| `repository_before` | ❌ Fails (missing required tests) |
| `repository_after` | ✅ Passes all tests |

The failures in `repository_before` are not artificial — they reveal **missing guarantees**.  
The success in `repository_after` demonstrates that those guarantees are now enforced.

---

## Key Learning Outcomes

### 1. Coverage Is Not Assurance

A high coverage number does not imply correctness unless edge cases and failures are tested.

---

### 2. API Clients Must Be Tested Defensively

External APIs cannot be assumed to return valid or complete data.  
Tests must reflect this reality.

---

### 3. Good Tests Should Break Weak Code

A test suite that never fails is not evidence of robustness.  
A strong test suite fails early, loudly, and for the right reasons.

---

## External References and Learning Resources

- Python `unittest.mock` documentation:  
  https://docs.python.org/3/library/unittest.mock.html

- Testing strategies for external services:  
  https://martinfowler.com/articles/mocksArentStubs.html

- Principles of behavior-focused testing:  
  https://testing.googleblog.com/2014/03/testing-on-toilet-test-behavior.html

---

## Final Outcome

The improved test suite transforms testing from **surface-level validation** into **contract enforcement**.

- The original tests verified that the code *runs*.
- The new tests verify that the code **behaves correctly under real-world conditions**.

This change is measurable, provable, and directly aligned with the problem statement.