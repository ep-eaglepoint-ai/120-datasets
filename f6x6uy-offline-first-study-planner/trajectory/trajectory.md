# Trajectory: Offline-First Study Planner

## 1. AUDIT / REQUIREMENTS ANALYSIS
**Guiding Question**: *What exactly needs to be built, and what are the constraints?*

The objective is a **CREATION** task: building a 0-1 productivity application. Unlike cloud-based tools, this system must thrive in a "closed-loop" environment where the local machine is the entire universe.

### Core Requirements
* **Persistent Subjects**: Local CRUD for academic or personal topics.
* **Session Tracking**: Precise logging of time with duration and timestamp validation.
* **Analytics Engine**: Real-time aggregation of study habits.
* **Streak Logic**: A calculation engine that rewards consistency.

### Constraint Analysis
* **Zero Connectivity**: No external CDNs, Google Fonts, or Remote APIs. All assets must be bundled.
* **Local Persistence**: Reliance on a self-hosted MongoDB instance.
* **Security by Isolation**: No authentication required, as physical access to the machine implies ownership.

---

## 2. QUESTION ASSUMPTIONS
**Guiding Question**: *Why are we doing this? Is this the right approach?*

* **Initial Assumption**: "We should use IndexedDB for the browser."
    * **Reality**: The prompt explicitly requires **MongoDB**. This allows for server-side-style aggregations that are much more powerful than browser-based stores.
* **Initial Assumption**: "We need a global state library like Redux."
    * **Reality**: Because the server and client are on the same machine, the "network" is near-instant.
    * **Conclusion**: Standard Next.js server actions and cache revalidation are sufficient, reducing the bundle size.
* **Lesson**: Avoid over-engineering the frontend state when the backend is literally inches away.

---

## 3. DEFINE SUCCESS CRITERIA
**Guiding Question**: *What does "done" mean in concrete, measurable terms?*

**[Functionality: Analytics]**:
- **Acceptance Criteria**: The system must calculate total study time and daily averages accurately even if sessions are added retroactively.
- **Verification Method**: Comparing manual Excel calculations against MongoDB aggregation results.

**[Performance: UI Latency]**:
- **Acceptance Criteria**: Interactions (saving a session) must complete in under 50ms.
- **Verification Method**: Browser DevTools Performance tab audit.

**[Data Integrity: Validation]**:
- **Acceptance Criteria**: It should be impossible to save a session for a subject that was deleted.
- **Verification Method**: Testing API rejection when passing a non-existent `subjectId`.

---

## 4. MAP REQUIREMENTS TO VALIDATION
**Guiding Question**: *How will we prove the solution is correct and complete?*

| Requirement | Test Strategy | Test Category |
| :--- | :--- | :--- |
| **Session Integrity** | Duration must be > 60s and < 24h. | Functional (Zod) |
| **Streak Accuracy** | Validate across leap years and DST changes. | Logic (Unit) |
| **Persistence** | Data remains after hard-killing the Node process. | Regression |
| **Responsive UI** | Layout must be functional from 375px to 4K. | Usability |

**Mental Checkpoint**: "If the user studies from 11:30 PM to 12:30 AM, does it count for one day or two? Our logic must be deterministic."

---

## 5. SCOPE THE SOLUTION
**Guiding Question**: *What is the minimal implementation that meets all requirements?*

### Component Inventory
* **`lib/db.ts`**: A singleton MongoDB client to prevent connection leaks during Next.js hot-reloads.
* **`lib/validations.ts`**: Shared Zod schemas for `Subject` and `Session`.
* **`services/analyticsService.ts`**: Analytics and streak calculation (e.g. `calculateStudyStreak`).
* **`src/app/page.tsx`**: The primary UI hub (Tailwind, dark mode).

---

## 6. TRACE DATA/CONTROL FLOW
**Guiding Question**: *How will data/control flow through the new system?*



**Designed Flow**:
1.  **User Event**: User clicks "End Session".
2.  **Validation**: Zod intercepts the payload on the client and the server.
3.  **Persistence**: Data is written to the local `study_sessions` collection.
4.  **Revalidation**: Server revalidation (e.g. `revalidatePath('/')`) triggers a server-side fetch.
5.  **Aggregation**: MongoDB `$group` and `$sort` operators re-calculate the streak.
6.  **Update**: The UI reflects the new streak count instantly.

---

## 7. ANTICIPATE OBJECTIONS
**Guiding Question**: *What could go wrong? What objections might arise?*

**Objection 1**: "MongoDB is heavy for a local app compared to SQLite."
- **Counter**: The requirement demands MongoDB. We mitigate weight by using a lean indexing strategy and avoiding heavy middleware.

**Objection 2**: "What if the system clock is changed?"
- **Counter**: Streaks are calculated based on stored UTC timestamps. While a clock change affects the *current* log, historical data remains immutable.

**Objection 3**: "Is it really 'offline' if it uses Next.js?"
- **Counter**: Yes. Next.js is the build-tool and runtime; it does not require an external internet connection once the local environment is set up.

---

## 8. VERIFY INVARIANTS / DEFINE CONSTRAINTS
**Guiding Question**: *What must remain true throughout the implementation?*

**Must satisfy**:
- All session data must link to a valid `subjectId`. ✓
- Daily streaks must break if a 24-hour gap exists between 00:00 and 23:59 of a calendar day. ✓

**Must not violate**:
- No usage of external fonts or icons (use local SVGs). ✓
- No hard-coded local IP addresses (use `localhost` or `process.env`). ✓

---

## 9. EXECUTE WITH SURGICAL PRECISION
**Guiding Question**: *In what order should changes be made to minimize risk?*

1.  **Step 1: Environment**: Initialize Next.js and local MongoDB connection logic.
    - *Rationale*: Establish the data pipe first.
2.  **Step 2: Schema**: Define Zod schemas and TypeScript interfaces.
    - *Rationale*: Type safety prevents downstream bugs in the aggregation logic.
3.  **Step 3: Services**: Build the Analytics and Streak calculation engine.
    - *Risk*: **High**. This is the core "math" of the app.
4.  **Step 4: UI Development**: Implement the Tailwind dashboard.
5.  **Step 5: Integration**: Connect UI forms to Server Actions.

---

## 10. MEASURE IMPACT / VERIFY COMPLETION
**Guiding Question**: *Did we build what was required? Can we prove it?*

**Requirements Completion**:
- **Offline reliability**: Automated tests cover cache fallback and sync queue (offline-manager.test.ts, page UI test). Manual verification: app loads and saves with Wi-Fi disabled.
- **Data Integrity**: ✅ Verified. Malformed payloads are rejected by Zod.
- **Streak Logic**: ✅ Verified. Test cases covering 3-day, 0-day, and month-boundary streaks passed.

**Quality Metrics**:
- **Test coverage**: Enforced via `npm run test:coverage`; current threshold 70% (jest.config.js). Reminder, offline, and UI tests added; aim to raise threshold toward 95% for core services as coverage is measured.
- **First Contentful Paint**: Target < 0.8s (local); verify via Lighthouse or DevTools Performance.

---

## 11. DOCUMENT THE DECISION
**Guiding Question**: *Why did we do this, and when should it be revisited?*

* **Problem**: Need for a high-integrity, local-first study tracker.
* **Solution**: Next.js + MongoDB stack with Zod-guarded API routes.
* **Trade-offs**: Sacrificed cloud-sync for 100% data privacy and zero latency.
* **Why this works**: Using MongoDB's `$facet` allows us to fetch stats, streaks, and subject lists in a single database round-trip.
* **When to revisit**: Re-evaluate if the user database exceeds 1GB, as local MongoDB memory management might require tuning.
