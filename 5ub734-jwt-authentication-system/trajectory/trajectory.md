## Trajectory

This document describes the structured thinking process used to design and implement the JWT authentication system.

---

### 1. Audit the Current State

- Since the application started from scratch, there was no legacy system to audit.
- Instead, establish the baseline by researching common, well‑reviewed best practices for:
  - JWT authentication and secure password handling.
  - A clean client/server separation (React client + Express server).
  - Testable layering (routes/controllers/services/middleware) and consistent error handling.
- Translate that research into an initial architecture:
  - Define the server structure (routing, middleware, controllers, services, DB access).
  - Define the client structure (API client, auth context/state, protected routing).
  - Pick conventions early (request/response shapes, auth header format, env configuration).
- Record constraints and assumptions:
  - Security and usability goals implied by the task (e.g., hashed passwords, consistent auth failures).

**Output:** A short list of best‑practice decisions, constraints, and assumptions that drive the initial design.

---

### 2. Define the Contract (Before Building Anything)

- Specify non‑negotiable guarantees for:
  - **Security**: hashed passwords, secret management, token integrity, no leakage of sensitive data in responses or logs.
  - **Correctness**: only valid credentials yield tokens; invalid or expired tokens are consistently rejected.
  - **UX**: clear login errors, smooth redirect to protected pages, no silent failures.
  - **API**: stable request/response formats for `login`, `refresh`, and protected resources.
  - **Style/Consistency**: consistent status codes, error bodies, and type definitions across endpoints.
- Note forbidden patterns:
  - Storing raw refresh tokens, raw passwords, or JWTs in the database.
  - Returning refresh tokens in JSON or exposing them to JavaScript (non‑HTTP‑only storage).
  - Persisting access tokens outside in‑memory runtime state.
  - Infinite/recursive refresh retries when refresh fails.
  - Mixing transport concerns (HTTP) with core auth logic in an untestable way.

**Output:** An explicit, testable contract that all code changes must satisfy.

---

### 3. Redesign the Structure (High‑Leverage Changes)

- Design clear separation of concerns:
  - **Controllers**: translate HTTP requests/responses.
  - **Services**: implement authentication rules and token lifecycle.
  - **Data layer**: user lookup, creation, and persistence.
  - **Middleware**: token verification, rate limiting, error normalization.
- Clarify data and token models:
  - Shape of user entities.
  - JWT payload content (minimal claims needed by the client).
  - Access vs. refresh tokens (if used) and their lifetimes.
- Clarify session and refresh‑token models (to support rotation + theft detection):
  - `session_id` and a “session family” identifier for cascading invalidation.
  - Refresh token persistence as a bcrypt hash (cost factor ≥ 12), never plaintext.
  - Token state needed for rotation (active vs. revoked/used) and audit timestamps.
- Reduce coupling:
  - Keep React components unaware of token internals; they only call an API client and use an auth context.
  - Keep services independent of HTTP so they are easy to test.

**Output:** A conceptual architecture describing responsibilities of each layer and how they interact.

---

### 4. Design a Minimal Execution Pipeline

- Focus on the core flows first:
  - User registration (if in scope).
  - Login with credentials → issue short‑lived access token + set refresh token cookie + persist refresh token hash.
  - Accessing a protected resource → token validation.
  - Refresh flow → rotate refresh token (invalidate old, issue new) and detect reuse.
  - Theft detection → invalidate all tokens in the same session family.
  - Logout / revoke flow → revoke session/family and clear refresh cookie.
- Minimize heavy or redundant operations:
  - Hash and verify passwords efficiently.
  - Only include necessary claims in JWTs.
  - Avoid loading unnecessary data on each request.
- Define a step‑by‑step pipeline for each flow, from HTTP entrypoint through middleware and services to the database and back.

**Output:** A simple, composable execution plan for each core auth/user flow.

---

### 5. Push Work to the Right Layer

- Move logic to the most appropriate layer:
  - Validation of request shapes close to the boundary (controllers or dedicated validators).
  - Authentication rules and token handling in services.
  - Persistence and transactions in the data layer or ORM.
  - UI concerns (redirects, toasts, loading states) in client components and hooks.
- Avoid overloading any single layer:
  - Controllers should remain thin.
  - Middleware should only do cross‑cutting concerns (auth, rate limiting, logging), not business logic.

**Output:** A clear mapping of which layer owns which responsibilities, making future changes predictable.

---

### 6. Eliminate Pathological Patterns

- Remove anti‑patterns in both server and client:
  - N+1 database queries for user or session information.
  - Repeated token parsing or verification where middleware can centralize it.
  - Copy‑pasted error handling instead of shared helpers.
- Replace expensive or fragile logic with:
  - Simple existence checks and indexed lookups.
  - Centralized configuration for token expiry, hashing parameters, and rate limits.
  - Shared utilities for consistent response formatting.

**Output:** Cleaner, more predictable code paths without unnecessary repetition.

---

### 7. Ensure Stability and Predictability

- Make behavior deterministic and testable:
  - Stable error formats and status codes.
  - Predictable redirect behavior on login/logout and expired tokens.
  - Consistent handling of edge cases (missing headers, malformed tokens, revoked users).
- Avoid hidden state:
  - Keep auth state in a single source of truth on the client (e.g., context or store).
  - Use clear token storage and invalidation strategies.
- Avoid refresh storms and infinite loops:
  - Ensure the client performs at most one refresh attempt per failing request.
  - If refresh fails (expired/revoked/reuse detected), clear in‑memory access token and force logout.

**Output:** A system where the same inputs always produce the same observable outputs.

---

### 8. Batch and Aggregate Intelligently

- Avoid per‑request or per‑component work that can be shared:
  - Centralize API client configuration (base URL, interceptors, auth headers).
  - Reuse middleware across routes instead of duplicating checks.
- Where appropriate, aggregate operations:
  - Prefer set‑based database queries over loops of single queries.
  - Group related checks into a single verification step.

**Output:** Reduced operational overhead on both server and client.

---

### 9. Normalize for Efficient Access

- Normalize keys and identifiers:
  - Use consistent casing and formats for usernames/emails.
  - Ensure database indices and lookups align with how users are queried.
- Normalize token and header handling:
  - Single, well‑defined convention for how tokens are sent (e.g., `Authorization: Bearer <token>`).
  - Shared utilities to parse and validate these structures.

**Output:** Fast and consistent access paths that avoid ad‑hoc transformations at runtime.

---

### 10. Verify Against the Contract

- Continuously validate implementation against the contract defined in step 2:
  - Run existing tests and add new ones for new flows and edge cases.
  - Manually exercise critical paths (login, protected access, logout, token expiry) where necessary.
  - Check logs and error responses for leakage or inconsistency.
- Measure improvements where applicable:

  - Reduced complexity or duplication in auth logic.
  - More focused and reliable tests.
  - Clearer UX for authentication‑related interactions.

- Verify all acceptance criteria explicitly:
  - Access token payload contains `user_id`, `role`, `session_id` and expires quickly.
  - Refresh token lives only in a secure, HTTP‑only cookie and is rotated on every refresh.
  - Refresh token hashes are stored with bcrypt cost factor ≥ 12.
  - Reuse/theft detection triggers session family invalidation.
  - Client stores access tokens in memory only, prevents infinite refresh loops, and logs out on refresh expiry/revocation.

**Output:** A verified implementation that meets the original guarantees, with tests and structure that make future changes safe.

---
