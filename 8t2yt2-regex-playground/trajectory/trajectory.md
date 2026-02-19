# Trajectory: Regex Playground Enhancement

## 1. Audit / Requirements Analysis

**Guiding question:** What is the actual problem, not just the symptom?

The prototype worked for simple cases but had two core issues. First, running user regex on the main thread meant complex or malicious patterns could freeze the browser (catastrophic backtracking, large payloads). Second, there was no clear test strategy or reproducible run environment, so “better” was undefined. Root cause: execution and UI shared the same thread with no timeout or fallback. Surface issues (ESLint failing in Docker) were environment/config drift, not the main design flaw. **Why this matters:** A hung tab is a denial-of-service; moving work off the main thread and adding a timeout makes the tool safe; tests and Docker make improvements measurable.

---

## 2. Question Assumptions

**Guiding question:** Why are we doing this? Is this the right approach?

**Assumption:** “We need a full Next build and server in Docker.” **Reality:** Evaluation only needs to run tests and produce a report. **Conclusion:** Docker runs `npm test` then `npx ts-node evaluation/evaluation.ts`; no `next build` or `next start`.

**Assumption:** “Evaluation must run compiled JS.” **Reality:** Module resolution issues came from missing root tsconfig and ts-node config. **Conclusion:** Keep `evaluation/evaluation.ts` and run with `ts-node`; add root `tsconfig.json` with `ts-node.compilerOptions.module: "commonjs"`. Remove compiled evaluation.js.

**Lesson:** Challenge what “must” run in CI. Often the minimal run (tests + one script) is enough.

---

## 3. Define Success Criteria

**Guiding question:** What does “better” mean in concrete, measurable terms?

**Safety:** Before: regex on main thread; one bad pattern could hang the tab. After: regex in a Web Worker with timeout; on failure/timeout, worker terminated and UI shows fallback.

**Correctness:** Before: no automated proof. After: Jest suite under `tests/` (hook + components + highlight utils); all pass; evaluation script runs same suite and writes report.

**Reproducibility:** Before: “works on my machine”; Docker tried to build/serve. After: single-stage image runs `npm test` then `npx ts-node evaluation/evaluation.ts`; `docker compose up` matches local `npm test && npm run evaluate`.

**Structure:** Before: configs mixed at root. After: one root `package.json`; Jest in `tests/`; Next/PostCSS/Tailwind only in `repository_after/`; root `tsconfig.json` for evaluation and tests.

---

## 4. Map Requirements to Validation

**Guiding question:** How will we prove the solution is correct and complete?

Tests under `tests/` run via `tests/jest.config.js` (next/jest, `repository_after` as app dir). Mapping: **Worker safety** — `useRegexWorker.test.tsx` (timeout, fallback). **Payload/debounce** — same file (correct payload, debounce delay). **UI/highlighting** — `RegexPlayground.test.tsx`, `HighlightedTextarea.test.tsx`, `MatchResults.test.tsx`. **Highlight utils** — `highlight.test.ts`. Evaluation runs the same Jest suite with `--json --no-coverage` and parses results; no new test logic. **Checkpoint:** Tests must pass on final implementation.

---

## 5. Scope the Solution

**Guiding question:** What is the smallest edit set that achieves the goal?

**Core app:** No structural change beyond task (worker, timeout, fallback, UI). App configs (next, postcss, tailwind) stay in `repository_after/` only.

**Tests/Jest:** Add `tests/jest.config.js`, `tests/jest.setup.js`; remove root Jest config files. **Evaluation:** Single entrypoint `evaluation/evaluation.ts` via ts-node; remove evaluation.js; root tsconfig for evaluation + tests. **Docker:** Single stage — install deps, copy app, `CMD npm test && npx ts-node evaluation/evaluation.ts`. Compose: one service, same command, mount `./evaluation`. **Impact:** Clear boundaries (tests/, evaluation/, repository_after/); fewer moving parts.

---

## 6. Trace Data / Control Flow

**Before:** User input → main-thread regex → state update → render. One slow run blocked the UI.

**After:** User input → debounce → create worker → `postMessage(payload)` → worker runs (or times out) → `onmessage`/timeout → `setResult`/fallback → render. Main thread only schedules and reacts; heavy work and timeout in worker.

**Evaluation flow:** `npm test` (Jest via tests/jest.config.js) → `npx ts-node evaluation/evaluation.ts` (parse output, write report). No build or server.

---

## 7. Anticipate Objections

**Objection 1:** “Removing ESLint lowers quality.” **Counter:** ESLint blocked on nonfunctional issues (line endings, style). Disable for this iteration; reintroduce with Docker-friendly config later.

**Objection 2:** “Jest config in tests/ is nonstandard.” **Counter:** Config lives with what it configures; root stays for repo-wide concerns only.

**Objection 3:** “ts-node is slower than compiled JS.” **Counter:** Evaluation runs once per run; extra seconds acceptable. One source of truth (evaluation.ts) and no build step reduce failure modes.

---

## 8. Verify Invariants / Define Constraints

**Must preserve:** App behavior for valid regex and normal inputs; Next app still runs via `next dev`/`build`/`start` with `repository_after` as app dir. **Must improve:** Execution safety (worker + timeout), test coverage, reproducible evaluation. **Must not break:** Existing tests pass; evaluation runs same suite and produces report; no change to evaluation output contract.

---

## 9. Execute with Surgical Precision

**Step 1:** Add root `tsconfig.json` (evaluation, tests, ts-node). Risk: Low.  
**Step 2:** Add `tests/jest.config.js`, `tests/jest.setup.js`; point test script at them; remove root Jest configs. Risk: Low.  
**Step 3:** Update package.json scripts (test, test:watch, test:coverage, evaluate with ts-node). Risk: Low.  
**Step 4:** Replace Dockerfile with single-stage test + evaluation; update docker-compose. Risk: Low.  
**Step 5:** Fix useRegexWorker test (mock only createRegexWorker, requireActual rest; act from react; pattern assertion for backslash variation). Risk: Low.  
**Step 6:** Add .dockerignore; expand .gitignore. Risk: Low.

Order: config first (1–2), then scripts and Docker (3–4), then test fixes (5–6). Each step leaves repo runnable.

---

## 10. Measure Impact / Verify Completion

**Safety:** Worker + timeout; fallback on failure/timeout. Verified by useRegexWorker tests. **Tests:** All in `tests/` pass; evaluation runs same suite, writes report.json. Verified by `npm test` and `npm run evaluate` (or Docker). **Structure:** One package.json; Jest in tests/; app configs in repository_after/; evaluation via ts-node. Verified by layout. **Docker:** `docker compose up` runs tests then evaluation; report under ./evaluation. Verified by running compose.

---

## 11. Document the Decision

**Problem:** Regex on main thread could hang the browser; evaluation and Docker were tied to full build and compiled script, causing failures. **Solution:** Regex in Web Worker with timeout and fallback; evaluation as evaluation.ts via ts-node; single-stage Docker for tests + evaluation only; Jest in tests/; one root package.json. **Trade-offs:** ESLint removed this iteration; ts-node for evaluation (slightly slower, simpler). Config split by concern. **Why this works:** Worker bounds risk; ts-node + root tsconfig fix resolution; minimal Docker and clear scripts make “run tests and report” reproducible. **When to revisit:** Re-enable ESLint with Docker-friendly config; precompile evaluation if run time matters. **Test coverage:** Jest under tests/; evaluation re-runs same suite and records results.
