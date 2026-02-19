# Trajectory - Enterprise Refactor of Concurrent JWT Authentication Client

The goal was to turn a fragile, stateful JWT demo into a predictable and scalable-by-design implementation, without changing the external behavior of the app.

---

## 1. Audit / Discovery

**Goal:** Understand the current reality, where it breaks, and why it breaks under load.

### What I inspected

- The original “before” implementation: monolithic logic in `repository_before/src/App.tsx`.
- How auth state, refresh logic, and request execution are coupled.
- How concurrency is handled (or not handled) when multiple requests hit 401/refresh conditions.
- Whether any internal data structures can grow without bound.

### What was broken / risky

- **Global unbounded state:** the legacy client used arrays/queues that could accumulate and never shrink (classic memory growth risk).
- **Refresh coordination was not robust:** concurrency could create timing windows where multiple refreshes compete or requests get stuck waiting.
- **Tight coupling:** UI, auth state, and HTTP behavior lived in one place, making it hard to reason about correctness.
- **Hard to test:** internal pieces weren’t exported cleanly, so verifying invariants required brittle approaches.

**Failure points at scale**

- High concurrency + repeated failures could grow in-memory arrays and cause steady memory growth.
- Multiple in-flight refresh attempts can lead to inconsistent states (some requests using old tokens while others update).
- Logout/session termination could leave behind stale state.

**Output: Problem map + failure points**

- Unbounded structures
- Weak refresh coordination
- Insufficient cleanup on session termination
- Monolithic design blocking reliable testing

---

## 2. Define the Contract (Rules Before Code)

**Goal:** lock constraints before changing anything.

### Non‑negotiable constraints

- **No functional regressions** in login, token refresh, request execution, or UI flow.
- **No new external libraries** for the application runtime.
- **Must not modify `MockAuthBackend`** (treated as external dependency).
- **Must not change React component interfaces** (especially `AuthProvider`, `LoginForm`, `Dashboard`).
- **Memory usage must not grow** with request volume / concurrency / runtime.
- **No unbounded data structures**.
- **All internal state must reset on logout/session termination**.
- Identical operation sequences should yield consistent outcomes (as far as the backend allows).

### What was allowed to change

- Internal module boundaries (split monolith into `authCore` + UI components).
- Internal client implementation details (refresh strategy, state tracking), as long as observable behavior stays consistent.
- Add a **test harness** and **Docker execution** to make verification repeatable.

**Output: explicit contract / rules of engagement**
The refactor is successful only if:

1. the UI behavior remains the same,
2. internal state is bounded and reset correctly,
3. concurrency/refresh behavior is coordinated safely,
4. tests prove the invariants.

---

## 3. Structural Design / Model Adjustment

**Goal:** make correctness + scalability properties come from structure, not patches.

### Main structural changes

- **Split responsibilities**
  - `repository_after/src/authCore.tsx`: auth context + `SecureHttpClient` + `MockAuthBackend` (kept identical).
  - `repository_after/src/components/*`: `LoginForm`, `Dashboard`, `ProtectedRoute`.
- **Make refresh coordination a single shared state machine**
  - Use one in-flight promise (`refreshPromise`) to ensure only one refresh runs at a time.
- **Remove global request queuing**
  - Avoid a top-level request queue that can grow; handle retry as “refresh once then retry once”.
- **Bound internal counters/state**
  - Keep bookkeeping bounded (e.g., counters wrap) and reset them on logout.

Why this structure works:

- Fewer moving parts during refresh means fewer inconsistent intermediate states.
- If no global queue exists, there’s no place for memory to accumulate indefinitely.
- Separating UI from auth/client logic makes it testable and reviewable.

**Output: optimized structure aligned with the contract**

- `SecureHttpClient` becomes a small, deterministic state machine.
- Auth state reset is explicit (`setTokens(null)` is the session termination boundary).

---

## 4. Execution Pipeline (How Work Flows)

**Goal:** define the exact step-by-step flow for requests and refresh.

### Request flow (after)

1. `httpClient.request(config)`
2. Pre-check expiry: if token is near expiry, wait for `startRefresh()`
3. Perform request
4. If response indicates 401:
   - refresh once (shared `refreshPromise`)
   - retry once with a `_retry` guard
5. If still failing, surface error (no infinite loops)

### Logout flow (after)

1. `logout()` calls backend logout
2. `httpClient.setTokens(null)` resets all internal state
3. UI state resets (`user = null`)

**Output: clear, efficient execution flow**

- Refresh is centralized and coordinated.
- Retry is bounded (at most one retry per request).
- Session termination has a clear boundary.

---

## 5️⃣ Eliminate Known Anti‑Patterns

**Goal:** remove scalability killers proactively.

### Anti-patterns removed

- **Unbounded arrays/queues** (memory growth): removed global queue accumulation patterns.
- **Multi-refresh race windows**: replaced with a single shared refresh promise.
- **Hidden state across sessions**: enforce reset on logout/session termination.
- **Hard-to-test monolith**: split into modules + exported `httpClient` for invariant testing.

**Output: predictable and scalable behavior**

- Memory usage is stable for the client.
- Refresh behavior is consistent under concurrency.

---

## 6. Verification & Signals

**Goal:** prove the solution works with evidence.

### Signals / invariants verified

Tests were added in `tests/jwt-client-reliability.test.ts` to cover:

- **No unbounded leak scaffolding** in the HTTP client.
- **Logout resets bounded bookkeeping** (queue size stays 0, counters reset).
- **Concurrency safety**: concurrent requests settle; no “stuck queue” behavior.
- **Happy path**: backend login generates a token that can access `/api/protected`.
- **Boundedness under load**: repeated concurrency batches do not accumulate state.
- **Contract enforcement checks**:
  - no new runtime dependency names introduced in the app
  - component interface shape remains stable
  - `MockAuthBackend` is text-identical to the “before” implementation

### Docker + reproducibility

- `docker-compose.yml` provides a single `app` service.
- You can run:
  - `docker compose run --rm -e TARGET_REPO=after app` (tests)
  - `docker compose run --rm app npm run evaluate` (evaluation report)

### Evaluation report

- Added `evaluation/evaluate.js` to run `before` and `after` and generate a JSON report.
- Important detail: normal `npm test` intentionally forces exit code 0; the evaluator uses `vitest run --reporter=json` so it can reliably detect pass/fail.

**Output: evidence-based confidence**

- `repository_after` passes the reliability suite.
- `repository_before` is expected to fail some checks (demonstrates improvement).
- Report JSON provides an auditable record of results.

---

## 7. Result Summary

### What improved

- **Correctness under concurrency:** refresh is coordinated with a single in-flight promise.
- **Memory stability:** removed unbounded accumulation patterns; bounded/reset state on logout.
- **Maintainability:** separated auth core from UI components.
- **Testability:** added direct, requirement-mapped tests plus Docker execution.
- **Repeatability:** evaluator generates structured reports for before/after runs.

### Risks eliminated

- Memory growth from unbounded arrays/queues.
- Multiple refresh race conditions.
- State leakage across sessions.

### Why the system is now predictable

- Clear contract boundaries (session termination resets state).
- Bounded retry behavior (no infinite re-queueing).
- Measurable invariants enforced by tests and reported by the evaluator.
