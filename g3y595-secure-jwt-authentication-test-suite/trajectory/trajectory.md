# Trajectory: how I approached the JWT auth testing work

## 1) I started by investigating the current implementation

I didn’t begin by writing tests immediately — I first read through the auth implementation to understand what behavior actually exists and where the risk is.

While reviewing, I focused on the “security-critical” mechanics that tend to break in production:

- how refresh tokens rotate (and how refresh token “families” are tracked)
- how concurrent requests behave during refresh (promise sharing)
- how 401s are handled (queueing + retry)
- how refresh token reuse/theft is detected and enforced
- how proactive refresh works (time-to-expiry thresholds)

During this pass, I also found a real correctness bug in the refresh queue drain path (an undefined `reject` being referenced), plus dead code at the end of the file. Those issues mattered because they could crash the app mid-refresh and make tests look flaky even when they were actually catching a real defect.

## 2) I wrote down the acceptance criteria as testable behaviors

I translated the requirements into concrete assertions I could enforce, instead of vague “it should be secure” statements.

For the security flows, I ensured I had coverage for:

- a single refresh being shared across concurrent requests
- 401 → request queue → refresh → retry (exactly once)
- proactive refresh triggering when there is <60 seconds remaining
- theft detection: reuse of a revoked refresh token invalidates the entire token family
- refresh failure: tokens are cleared and the session is treated as expired

For the UI/state behaviors, I ensured I had coverage for:

- login success updates UI state
- login failure surfaces a user-visible error
- protected routes gate unauthenticated access
- logout clears tokens and returns to the login view
- loading states disable buttons to prevent duplicate operations

## 3) I intentionally tested at two layers (logic + UI)

I avoided relying only on DOM assertions for the security rules. UI-level tests are great for validating flows, but they’re usually the wrong tool for verifying internal invariants like “only one refresh call happened” or “the refresh token family was revoked.”

So I split the suite into:

- logic-level tests that exercise the auth client/backend directly (to validate refresh/queueing/theft detection deterministically)
- UI-level tests that render the app and validate the login/logout/protected route experience

## 4) I made the async tests deterministic

Auth flows are heavily time- and promise-driven, so I leaned on deterministic timer control:

- I used fake timers when expiry/proactive refresh timing mattered.
- I advanced time inside `act()` to keep React state updates consistent.
- I reset singleton state between tests (tokens, in-flight refresh promise, request queue) so tests don’t contaminate each other.

One key lesson here was to avoid patterns that create “unhandled rejection” noise. For queued-request failure scenarios, I used `Promise.allSettled()` to ensure every rejection is observed and asserted.

## 5) I treated Docker failures as test/runtime failures first

When Docker runs started failing, I didn’t assume it was a Docker problem. I checked whether:

- the image being run actually contained the latest test changes
- the failing errors were runtime/test issues (React hook errors, nested RTL imports) rather than missing services

The “Invalid hook call” errors and the “Hooks cannot be defined inside tests” errors were classic symptoms of test harness issues:

- multiple copies of React getting loaded (usually from module reset / require patterns)
- requiring RTL inside a test (which re-registers hooks like `beforeAll`/`afterEach` in the wrong place)

I fixed this by keeping Testing Library imports at module scope and avoiding module-loading patterns that can cause duplicate React instances.

## 6) I validated robustness using mutation-style meta tests

I didn’t want the suite to pass only on the happy path; I wanted evidence that it would fail if security behaviors were “accidentally” removed.

So I relied on mutation-style meta tests that intentionally break key guarantees (like disabling theft detection, disabling proactive refresh, bypassing protected routes) and then assert that the real Jest suite fails when those regressions are introduced.

This gave me confidence the tests weren’t simply mirroring implementation details — they were enforcing outcomes.

## 7) I verified the full evaluator-style workflow at the end

Once the suite was stable locally, I verified it end-to-end the way an evaluator would:

- run the main Jest suite inside Docker
- run the meta suite inside Docker

At that point, both suites passed cleanly.
