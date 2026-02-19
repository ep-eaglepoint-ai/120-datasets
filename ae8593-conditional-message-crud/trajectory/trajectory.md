# Trajectory (Thinking Process for Testing & Full‑Stack Implementation)

## 1. Audit the Problem Space (Risk & Coverage Gaps)

I started by auditing the problem statement rather than the code. Two distinct risk surfaces were present:

* **Backend client risk**: The existing `GithubOrgClient` test suite only validated surface-level behavior (`org` and `_public_repos_url`) while leaving core behaviors unverified: repository retrieval, license filtering, license validation, and error paths.
* **System-level risk**: The CRUD messaging application combined authentication, authorization, conditional visibility, and state-based unlocking. These dimensions multiply failure modes if not explicitly tested.

From first principles: untested behavior is undefined behavior. Any logic not constrained by tests is unstable under change.

Resources used:

* Why test gaps cause regressions: [https://martinfowler.com/articles/practical-test-pyramid.html](https://martinfowler.com/articles/practical-test-pyramid.html)
* Testing risk analysis overview: [https://www.youtube.com/watch?v=JDD5EEJgpHU](https://www.youtube.com/watch?v=JDD5EEJgpHU)

---

## 2. Define a Test & Behavior Contract

Before writing code or tests, I defined explicit behavioral contracts.

### GithubOrgClient

* Public repositories must be retrieved via the documented GitHub API contract
* License filtering must:

  * Ignore repos without license data
  * Match licenses deterministically
* Network failures and malformed payloads must not silently pass

### Messaging Application

* **Visibility contract**:

  * All Messages → visible to all authenticated users
  * User Messages → visible only to message author
  * Admin Messages → visible only if author has admin role

* **Unlocking contract**:

  1. Time-based: message visible only after timestamp
  2. Dependency-based: message visible only after another message is read
  3. Puzzle-based: message visible only after a correct solution is submitted

Tests must encode these contracts explicitly so violations fail fast.

Resources:

* Test-driven contracts explained: [https://kentcdodds.com/blog/write-tests](https://kentcdodds.com/blog/write-tests)
* Authorization testing strategies: [https://auth0.com/blog/testing-authorization/](https://auth0.com/blog/testing-authorization/)

---

## 3. Decompose the Domain Into Testable Units

I decomposed both problems into minimal, independently verifiable units.

### GithubOrgClient

* HTTP boundary (mocked)
* Data transformation layer
* License predicate logic

This allowed deterministic unit tests using mocked API responses instead of integration calls.

### Messaging App

* User model (roles, identity)
* Message model (ownership, metadata, unlock state)
* Visibility rules as pure functions
* Unlock rules as isolated evaluators

This separation prevents UI or database noise from masking logic defects.

Resources:

* Mocking external APIs properly: [https://realpython.com/python-mock-library/](https://realpython.com/python-mock-library/)
* Domain-driven testing basics: [https://www.youtube.com/watch?v=ezXWn3Zb8aM](https://www.youtube.com/watch?v=ezXWn3Zb8aM)

---

## 4. Preserve Existing Structure While Extending Coverage

A hard constraint was to **preserve all existing tests and structure**.

Instead of refactoring, I extended:

* New test classes mirrored existing ones
* Naming conventions were preserved
* Fixtures were reused rather than replaced

This minimizes reviewer friction and avoids introducing meta-changes unrelated to correctness.

Resource:

* Safe test extension patterns: [https://testing.googleblog.com/2014/04/testing-on-toilet-dont-mock-types.html](https://testing.googleblog.com/2014/04/testing-on-toilet-dont-mock-types.html)

---

## 5. Implement Deterministic Fixtures & Role Matrices

For the CRUD app, I built fixtures that explicitly encode:

* User role (admin vs user)
* Message author
* Unlock condition state

Each CRUD operation (Create, Read, Update, Delete) was tested against a role matrix:

| Role  | Operation                 | Expected Result |
| ----- | ------------------------- | --------------- |
| User  | Read Admin Message        | Denied          |
| Admin | Read User Message         | Allowed         |
| User  | Update Other User Message | Denied          |

This prevents implicit assumptions about permissions.

Resources:

* Role-based access control testing: [https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control](https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control)

---

## 6. Encode Unlock Rules as State Machines

Unlock conditions were treated as state machines rather than UI logic:

* Time-based → `now >= unlock_at`
* Dependency-based → `dependency.read == true`
* Puzzle-based → `hash(solution) == stored_hash`

Each rule was tested independently and then re-tested in combination with visibility rules.

Resource:

* State-based testing explained: [https://www.youtube.com/watch?v=Y9X6z6o7sKw](https://www.youtube.com/watch?v=Y9X6z6o7sKw)

---

## 7. Negative & Edge-Case Testing

I explicitly tested failure paths:

* Missing license data
* Invalid license keys
* Unauthorized CRUD attempts
* Unlock condition partially satisfied
* Replay attempts on puzzle unlocks

Edge cases were prioritized over happy paths because they carry higher regression risk.

Resources:

* Why edge cases matter in testing: [https://blog.cleancoder.com/uncle-bob/2017/05/05/TestDefinitions.html](https://blog.cleancoder.com/uncle-bob/2017/05/05/TestDefinitions.html)

---

## 8. Verification Signals

Correctness was validated through:

* Deterministic test outcomes
* No reliance on real network or clock
* Explicit assertion of visibility and access denial

Success criteria:

* Coverage extended without breaking existing tests
* Role-based visibility provably enforced
* Unlock rules impossible to bypass without satisfying constraints

---

## Result

* GithubOrgClient is now behaviorally constrained beyond surface-level methods
* CRUD messaging system enforces authorization, visibility, and unlocking rules at the domain level
* Tests act as executable specifications rather than incidental coverage

---

## Trajectory Transferability Notes

This trajectory reuses the same invariant structure:

**Audit → Contract → Decompose → Execute → Verify**

It is transferable to:

* Backend testing
* Full‑stack feature development
* Security-sensitive systems
* Client SDK validation

Only the artifacts change; the reasoning path remains stable.
