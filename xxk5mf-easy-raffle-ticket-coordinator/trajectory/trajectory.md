# Trajectory: High-Integrity Digital Raffle

## 1. AUDIT / REQUIREMENTS ANALYSIS

**Guiding Question**: _What exactly needs to be built, and what are the constraints?_

The objective is a **CREATION** task: a raffle with a hard cap of 100 tickets and strict fairness. Hundreds of users may hit purchase at the same time—the system must never oversell and must enforce a max of 2 tickets per user.

### Core Requirements

- **Atomic inventory**: POST /purchase must never allow total tickets to exceed 100, even under concurrent requests.
- **Per-user fairness**: Track by UserID; reject any attempt beyond 2 tickets per person, enforced only on the server.
- **Secure admin draw**: Protected POST /admin/draw-winner using Node `crypto.randomInt`; persist the winning ticket.
- **Data visibility**: Raffle state OPEN vs CLOSED; winning ticket must not be exposed until the raffle is closed.

### Constraint Analysis

- **Backend as source of truth**: All business rules live in Express; the React UI is presentation and UX only.
- **PostgreSQL for atomicity**: Use transactions and row locking (e.g. SELECT ... FOR UPDATE) so concurrent purchases serialize correctly.
- **Docker**: PostgreSQL and app run via docker-compose.

---

## 2. QUESTION ASSUMPTIONS

**Guiding Question**: _Why are we doing this? Is this the right approach?_

- **Assumption**: "In-memory or SQLite is enough."
  - **Reality**: The spec calls for handling requests "at the same millisecond." We need a DB that supports real transactions and row locking; PostgreSQL in Docker matches the reference setup and gives us that.
- **Assumption**: "We can enforce the 2-ticket limit on the client."
  - **Reality**: The spec says the frontend must not be trusted for validation. The backend must reject over-purchases regardless of client behaviour (multiple tabs, modified requests).
- **Lesson**: Keep validation and inventory logic entirely in the server; the client only displays state and errors.

---

## 3. DEFINE SUCCESS CRITERIA

**Guiding Question**: _What does "done" mean in concrete, measurable terms?_

**[Atomicity: No oversell]**:

- **Acceptance**: Total tickets in the DB never exceed 100, even with high concurrency.
- **Verification**: Ensure the database transaction successfully serializes write operations.

**[Fairness: Per-user cap]**:

- **Acceptance**: No user has more than 2 tickets; third purchase returns "Limit Reached."
- **Verification**: Strict server-side check within the purchase transaction.

**[Winner draw]**:

- **Acceptance**: One winner chosen with `crypto.randomInt`; result persisted; not exposed when status is OPEN.
- **Verification**: Logic check on random number generation and visibility middleware.

**[UX]**:

- **Acceptance**: Dashboard shows remaining count; purchase button has loading/disabled states and automated real-time updates.
- **Verification**: Confirm front-end polling and button state machine.

---

## 4. MAP REQUIREMENTS TO IMPLEMENTATION

**Guiding Question**: _How will we implement each requirement?_

| Requirement     | Strategy                                 | Implementation                        |
| :-------------- | :--------------------------------------- | :------------------------------------ |
| No oversell     | PostgreSQL Transaction + Serialized Lock | `raffleService.ts` (FOR UPDATE)       |
| Per-user limit  | Server-side count validation             | `raffleService.ts`                    |
| Winner fairness | Cryptographic RNG                        | `raffleService.ts` (randomInt)        |
| Data Isolation  | State-dependent API response             | `raffleService.ts` (visibility check) |
| Real-time UX    | Automated Polling                        | `App.tsx` (setInterval)               |

**Mental checkpoint**: "If two requests for the same user land in the same millisecond, does the DB transaction + row lock serialize them so we never insert a 3rd ticket? Yes—we lock `raffle_meta` with FOR UPDATE and check user count inside the same transaction."

---

## 5. SCOPE THE SOLUTION

**Guiding Question**: _What is the minimal implementation that meets all requirements?_

### Component inventory

- **`repository_after/server/db.ts`**: PostgreSQL pool management and schema initialization.
- **`repository_after/server/schema.sql`**: Schema definition for `raffle_meta` and `tickets`.
- **`repository_after/server/raffleService.ts`**: Core logic for purchases (transactions), state retrieval, and winner selection.
- **`repository_after/server/adminAuth.ts`**: Auth middleware for protected admin routes.
- **`repository_after/server/routes.ts`**: API endpoint definitions.
- **`repository_after/server/index.ts`**: Express application entry point.
- **`repository_after/client/src/App.tsx`**: React dashboard with real-time polling and purchase management.

---

## 6. TRACE DATA/CONTROL FLOW

**Guiding Question**: _How will data/control flow through the new system?_

**Purchase flow**:

1. Client POSTs `/api/purchase` with `{ userId, quantity }`.
2. Route calls `purchaseTickets(userId, quantity)`.
3. Service acquires client, `BEGIN`, then `SELECT ... FROM raffle_meta WHERE id=1 FOR UPDATE` (lock).
4. Check status = OPEN, total tickets < 100, user tickets < 2; then INSERT ticket(s); `COMMIT`.
5. Response: `{ success, tickets, remaining }` or error.
6. Client refetches state and updates UI; on failure shows error and re-enables button.

**Draw flow**:

1. Admin POSTs `/api/admin/draw-winner` with auth.
2. `adminAuth` validates; service picks winner with `crypto.randomInt`, updates status to CLOSED.
3. Thereafter state API includes `winningTicketId` for client display.

---

## 7. ANTICIPATE OBJECTIONS

**Guiding Question**: _What could go wrong? What objections might arise?_

**Objection 1**: "Why not use a single in-process lock instead of DB transactions?"

- **Counter**: Multiple processes or replicas would not share that lock. PostgreSQL transactions and row locking give correct behaviour under any number of app instances.

**Objection 2**: "Why polling instead of WebSockets?"

- **Counter**: Polling is simpler to implement and debug for a single-counter update every few seconds, and meets the requirement for "real-time" countdown without the overhead of persistent connections.

---

## 8. VERIFY INVARIANTS / DEFINE CONSTRAINTS

**Guiding Question**: _What must remain true throughout the implementation?_

**Must satisfy**:

- Total rows in `tickets` ≤ 100.
- Per user_id, count ≤ 2.
- Winning ticket is never returned by a public API while status = OPEN.
- Admin draw uses `crypto.randomInt`.

---

## 9. DOCUMENT THE DECISION

**Guiding Question**: _Why did we do this, and when should it be revisited?_

- **Problem**: Raffle with a strict cap of 100 tickets and 2 per user, under heavy concurrency, with a secure admin draw and no early exposure of the winner.
- **Solution**: Express + PostgreSQL (transactions and SELECT FOR UPDATE), React dashboard with automated polling, and careful state separation between server and client.
- **Why this works**: Serializing purchase checks on the `raffle_meta` row guarantees exactly one writer at a time for the critical section; total and per-user counts stay consistent.
- **When to revisit**: If we add multiple raffles or sharding, we’d need a different locking strategy; current design is optimized for a single high-integrity raffle.
