# Trajectory

## 1) Audit / Discovery

- This task was code generation (no `repository_before/` implementation to compare), so the “audit” was:
  - Read the requirements list and convert it into implementable feature groups.
  - Inspect the existing repo harness (Docker + tests expectations) to ensure the solution could be executed and evaluated.
- Key execution constraints that shaped decisions:
  - Vue 3 + Composition API + `<script setup>`.
  - Frontend-only: no backend, no auth, no external APIs.
  - State must persist via LocalStorage with hydration.
  - Duplicate voting prevention is per poll per browser session.
- Early failure learned during iteration:
  - Alpine can be brittle with toolchains that depend on native optional packages (e.g., Rollup/Vitest paths).

## 2) Define the Contract (Rules Before Code)

- Non-negotiable requirements turned into concrete rules:
  - Vue rules: all Vue SFCs must use `<script setup>`.
  - Data rules (poll model): title, optional description, tags, dynamic options, voting mode (single/multi), anonymity (anonymous/named), start/end time.
  - State rules: Pinia is the source of truth; state persisted to LocalStorage and hydrated on reload.
  - Voting rules:
    - Block voting when status is not active (closed/expired).
    - Prevent duplicate voting per poll per browser session.
    - Support anonymous voting or named voting (client-side only).
  - UX rules:
    - Real-time results updates (client-side), percentages, totals, animated progress bars.
    - Sort/filter polls (active/closed/trending/by tag).
    - Validation, empty/error states, confirmation modals.
    - Accessibility (ARIA, keyboard navigation, focus management), responsive layout, light/dark toggle, micro-animations.
  - Operational rules:
    - `npm test` must validate the requirements.
    - Evaluation must run via Docker using `docker compose run --rm app ...`.

## 3) Structural Design / Model Adjustment

- Design choices used to make the requirements predictable to implement:
  - Centralize domain logic in one Pinia store (`repository_after/src/stores/polls.ts`) so:
    - CRUD, voting rules, status calculation, and persistence are consistent across screens.
  - Abstract persistence into storage helpers (`repository_after/src/utils/storage.ts`) so:
    - LocalStorage + SessionStorage usage is uniform and testable.
  - Treat “poll status” as derived data (active/closed/expired) based on time window + manual close timestamp.
  - Use reusable UI primitives + poll-specific components so validation/a11y patterns don’t get duplicated.
  - Keep evaluation deterministic by using Node-based requirement tests (`tests/voting_app_requirements.test.js`) that scan for required behavior.

## 4) Execution Pipeline (How Work Flows)

- Implementation path (requirement → feature → verification):

  - Build the app skeleton first (Vue 3, routing, base UI) so flows could be exercised end-to-end.
  - Implement the poll store next (CRUD + persistence + status), because most UI depends on it.
  - Add voting UI + results UI once store logic was stable.
  - Add validations and empty/error/confirm modals after the main flows existed.
  - Layer in a11y, responsive behavior, theme persistence, and micro-animations last (polish phase).
  - Add/adjust tests continuously so each requirement had a clear signal.

- Runtime behavior (high-level):
  - On startup: hydrate state from LocalStorage.
  - On poll interactions: update Pinia state and persist.
  - On vote:
    - Validate ballot + voting window.
    - Block if already voted this session (SessionStorage marker).
    - Update counts, recompute derived results, persist.

## 5) Eliminate Known Anti-Patterns

- Avoided duplicated business logic:
  - Put voting rules (status checks + duplicate-vote prevention + validation) in the Pinia store so UI components don’t re-implement them inconsistently.
- Avoided persistence scattering:
  - Centralized LocalStorage/SessionStorage access in storage helpers to prevent ad-hoc keys and partial hydration.
- Avoided “papering over” correctness:
  - When strict builds failed (TS/Vue issues), fixed the root cause rather than loosening compiler/lint rules.

## 6) Verification & Signals

- Measurable signals used to prove requirements were met:

  - Deterministic pass/fail checks: `npm test` runs a requirement suite that prints `✓/✗` per requirement.
  - Reproducible evaluation in the required environment:
    - `docker compose run --rm app npm run evaluate`

- Invariants verified by the checks (directly mapped to the task requirements):
  - Vue 3 + `<script setup>` usage, frontend-only (no `fetch`/axios), Pinia + LocalStorage persistence/hydration.
  - Poll CRUD, poll fields (title/description/tags/options/times), voting modes (single/multi), anonymous/named voting.
  - Status handling (active/closed/expired), duplicate-vote prevention per poll per session, results UI signals.

## 7) Result Summary

- Final outcome:
  - A responsive, frontend-only voting app with persistent state and the required voting/lifecycle behavior.
  - A single-command evaluation path:
    - `docker compose run --rm app npm run evaluate`
