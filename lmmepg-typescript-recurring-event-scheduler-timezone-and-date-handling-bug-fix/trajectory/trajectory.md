# Trajectory - Recurring Event Scheduler Rewrite

The goal was to fix a legacy TypeScript scheduler plagued by timezone bugs, DST issues, and performance bottlenecks, without using external date libraries.

---

## 1. Audit / Discovery

**Goal:** Identify why the current logic fails fundamentally.

**I investigated** the legacy code and found that it was fundamentally broken for international use cases.

-   **I found** that the recurrence logic used naive millisecond addition (`24*60*60*1000`). This meant that any DST transition (where a day is 23 or 25 hours) would cause the time to drift (e.g., 9 AM becoming 10 AM or 8 AM).
-   **I saw** that it relied on the native `Date` object's auto-correction without clamping. So, adding 1 month to "Jan 31" resulted in "March 3" instead of "Feb 28/29", violating standard recurrence rules.
-   **I noticed** that the architecture cached the timezone offset in the constructor. This is incorrect because a timezone's offset is not constant; it changes during DST transitions throughout the year.
-   **I discovered** a massive performance bottleneck where the scheduler iterated from the event's start date indefinitely. For an event created in 2010 asked for 2024, it ran 14 years of loops unnecessarily.

---

## 2. Define the Contract

**Goal:** Strict adherence to requirements using only native APIs.

**I started by identifying the current problems and how I can enhance them.** The legacy code was failing because it tried to treat dates as simple timestamps (Math) rather than calendar objects (Wall Time). To fix this, I established a strict contract:

-   **Problem**: Naive math fails DST.
    -   **Enhancement**: I will use native `Intl` APIs to perform "Wall Time" arithmetic (adding "1 Day" conceptually, not 86,400,000 milliseconds).
-   **Problem**: Unbounded iteration impacts performance.
    -   **Enhancement**: I will implement a "Skip Ahead" optimization to handle long-running queries efficiently while remaining stateless.
-   **Problem**: Invalid date generation (e.g. Feb 30).
    -   **Enhancement**: I will enforce "Stateless Clamping" to ensuring monthly recurrences snap to valid days (Jan 31 -> Feb 29).
-   **Constraint**: No external libraries. I must build this robust logic using only standard Node.js APIs.

---

## 3. Structural Design

**Goal:** Make the recurrence logic "Stateless" and "Wall-Time" aware.

### Key Decisions

-   **Shift to Component Arithmetic**: Instead of adding milliseconds, **I decided** to add *Components* (Days, Months, Years).
    -   `date.setDate(date.getDate() + 1)` handles DST correctly (the OS handles the shift).
-   **Stateless Clamping**: For Monthly events, **I optimized** the logic to not rely on the "previous" date's day (which might have been clamped). It always looks back at the original start date (or `pattern.dayOfMonth`) to decide the target day, then clamps.
    -   Example: Jan 31 -> Feb 28 -> Mar 31 (Snap back).
-   **Dynamic Timezone**: **I removed** the cached offset. I used `Intl.DateTimeFormat` to decompose the UTC timestamp into "Wall Time" components for the *target* timezone at the *target* moment.

### Optimization Strategy

-   **Safe Skip Ahead**: **I realized** I couldn't just math-guess the exact start date due to month lengths and leap years.
-   **Solution**: **I implemented** an estimation strategy: estimate cycles to skip, apply a safety factor (90%), land *before* the target, and let the robust loop finish the job. This balances O(1) jump with strict correctness.

---

## 4. Execution Pipeline

### Recurrence Rule (New Logic)

1.  Input: Current Timestamp (UTC).
2.  Convert to Zoned Components (Wall Time).
3.  Add Interval to specific Component (Day/Month).
4.  Reconstruct Date:
    -   If Monthly: Clamp day (min(targetDay, daysInMonth)).

### Scheduler

1.  **Read Options**: Respect `weekStartsOn` and `maxOccurrences` (default 1000).
2.  **Jump**: If `startDate` > `event.startDate`, calculate diff, jump 90% of the way.
3.  **Iterate**: Generate dates using `RecurrenceRule` until `endDate` or limit.
4.  **Validate**: Check `endDate` inclusive logic using local date comparison (YYYYMMDD).

---

## 5. Elimination of Anti-Patterns

-   **Removed**: `timestamp + 86400000`. Replaced with `date.setDate(n + 1)`.
-   **Removed**: Cached timezone offsets.
-   **Removed**: Infinite loops (added hard limit).
-   **Removed**: "Silent Failure" on invalid timezone (added throw).

---

## 6. Verification

**Goal:** Prove it works across edge cases.

### Signals Verified

-   **US DST**: March 13->14 transition maintains 9 AM.
-   **Leap Year**: Jan 31 2024 -> Feb 29 2024.
-   **Performance**: 14-year gap query returns < 200ms.
-   **Australia**: Timezone moves opposite to US (verified via offset recalc).

### Result

-   The refactored code passes all constraints.
-   The legacy code fails as expected (module errors/logic bugs).
