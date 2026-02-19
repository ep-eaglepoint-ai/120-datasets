# Trajectory - UrbanCargo Capacity-Safe Package Assignment

The goal was to implement a dispatcher-facing “Package Assignment” feature for UrbanCargo where bike couriers have a strict 25kg max carry capacity, and the backend must prevent over-assignment even under concurrent dispatcher actions.

---

## 1. Audit / Discovery

**Goal:** Identify what could break weight integrity.

**I started by reading the requirements as a failure-story**: two dispatchers click “Assign” at the same time and both assignments succeed, pushing a courier beyond 25kg.

- **I recognized** this is a classic time-of-check/time-of-use race: if two requests compute `currentLoad` concurrently, both can pass the check and both can write.
- **I also noticed** that UI disabling is helpful, but cannot be trusted. The backend must be the final enforcement layer.
- **I clarified for myself** that the system’s “source of truth” for load is the sum of currently `ASSIGNED` packages, not a cached field that can drift.

---

## 2. Define the Contract

**Goal:** Translate requirements into an enforceable backend contract.

- **Atomic capacity check:** In one atomic operation, enforce `currentLoad + newWeight <= 25`.
  - **I decided** this must live in a Prisma transaction so reads and writes are tied together.
- **Single assignment:** A package must never end up assigned to two couriers.
  - **I decided** to enforce this at the DB layer as well (not just in application logic).
- **Data validation:** Negative weights must be rejected so they can’t “create fake capacity”.
- **Server-side security:** The client must not access Prisma directly; only Server Actions perform mutations.
- **Reactive UI:** After assignment, all dashboards should reflect the new remaining capacity immediately.

---

## 3. Structural Design

### Key decisions

- **I modeled** `Courier`, `Package`, and `Assignment` explicitly.
  - **I used** `Assignment.packageId` as `@unique` so even if two transactions race, the database prevents a double-assignment record.
  - **I kept** `Package.status` + `Package.courierId` so the “current load” query is straightforward and indexed.

### Concurrency strategy

This was the core engineering decision.

- **I needed** a way to make concurrent assignments for the _same courier_ serialize.
- **I chose** to acquire a write lock early inside the transaction by performing a no-op logical update (`lockVersion += 1`) on the courier.
  - The intent is: if two assignments target the same courier, one transaction will block until the other commits/rolls back.
  - Once the lock is held, the transaction’s sum-check and the subsequent writes are effectively protected from a second concurrent sum-check.

This avoids relying on “eventual consistency” and makes the failure mode deterministic: the second transaction sees the updated state and fails with `Capacity Exceeded`.

---

## 4. Execution Pipeline

### Assignment flow (backend)

1. **I validate** the courier exists and is active.
2. **I start** a Prisma transaction.
3. **I acquire** the per-courier lock by updating `lockVersion`.
4. **I load** the package and enforce it is `PENDING` and unassigned.
5. **I compute** `currentLoad = sum(weightKg)` for that courier’s `ASSIGNED` packages.
6. **I enforce** the invariant: if `currentLoad + pkg.weightKg > 25`, throw `Capacity Exceeded`.
7. **I atomically claim** the package using `updateMany` with a strict WHERE clause (`PENDING` and `courierId == null`).
8. **I create** the `Assignment` row (DB unique constraint protects double assignment).

### Assignment flow (frontend)

- **I fetch** couriers and their remaining capacity on the server.
- **I pass** that data into a client component that disables “Assign” if the selected package is too heavy.
- **I trigger** the mutation through a Server Action, then call `revalidatePath('/dashboard')` so every open dashboard converges to the correct state.

---

## 5. Verification

**Goal:** Prove correctness under the exact failure modes described.

- **I wrote** a concurrency test that fires two parallel 15kg assignments against the same courier.
  - **I expected** exactly one to succeed.
  - **I expected** the other to fail with `Capacity Exceeded`.
- **I wrote** a happy-path test that assigns 5kg and then re-reads remaining capacity from the database.
  - **I verified** remaining capacity changes from 25 to 20.
- **I tested** integrity rules:
  - inactive couriers cannot receive assignments
  - a package cannot be assigned twice
  - exact 25kg is allowed; >25kg is rejected
  - negative weights are rejected via the server-side creation path

---

## 6. Result

- The system enforces the 25kg rule atomically under concurrency.
- The UI stays responsive and consistent via revalidation, but the backend remains the final authority.
