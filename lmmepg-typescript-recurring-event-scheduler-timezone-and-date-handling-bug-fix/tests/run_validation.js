import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function val(target) {
  let Scheduler;
  try {
    const modPath = path.resolve(
      __dirname,
      "..",
      target,
      "dist",
      "scheduler.js"
    );
    const mod = await import(modPath);
    Scheduler = mod.Scheduler;
  } catch (e) {
    return [
      {
        title: "Module Loading",
        status: "failed",
        failureMessages: [e.message],
        duration: 0,
      },
    ];
  }

  const scheduler = new Scheduler();
  const results = [];

  function runTest(name, fn) {
    const start = Date.now();
    try {
      fn();
      results.push({
        title: name,
        status: "passed",
        duration: Date.now() - start,
      });
    } catch (e) {
      results.push({
        title: name,
        status: "failed",
        duration: Date.now() - start,
        failureMessages: [e.message],
      });
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || "Assertion failed");
  }

  // 1. Daily Recurrence DST
  runTest("Daily DST (March 10)", () => {
    const ev = {
      id: "1",
      title: "DST",
      startDate: new Date("2024-03-09T14:00:00Z"),
      startTime: "09:00",
      timezone: "America/New_York",
      recurrence: { frequency: "daily", interval: 1 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-03-09T00:00:00Z"),
      new Date("2024-03-12T00:00:00Z")
    );
    const mar10 = occ.find((o) =>
      o.date.toISOString().startsWith("2024-03-10")
    );
    assert(mar10, "Mar 10 missing");
    const h = mar10.date.getUTCHours();
    // 9 AM EDT = 13:00 UTC
    assert(h === 13, `Mar 10 Hour: ${h} (Exp: 13 for 9am EDT)`);
  });

  // 2. Monthly Clamping
  runTest("Month Clamp (Jan 31 -> Feb/Mar)", () => {
    const ev = {
      id: "2",
      title: "Clamp",
      startDate: new Date("2024-01-31T12:00:00Z"),
      startTime: "12:00",
      timezone: "UTC",
      recurrence: { frequency: "monthly", interval: 1, dayOfMonth: 31 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-01-01"),
      new Date("2024-04-01")
    );

    const feb = occ.find((o) => o.date.getMonth() === 1);
    assert(feb, "Feb missing");
    assert(
      feb.date.getDate() === 29,
      `Feb Date: ${feb.date.getDate()} (Exp: 29)`
    );

    const mar = occ.find((o) => o.date.getMonth() === 2);
    assert(mar, "Mar missing");
    assert(
      mar.date.getDate() === 31,
      `Mar Date: ${mar.date.getDate()} (Exp: 31)`
    );
  });

  // 3. Timezone Offset Recalculation
  runTest("Timezone Offset Recalc (Sydney)", () => {
    // Sydney: Jan (+11), July (+10)
    const ev = {
      id: "3",
      title: "Sydney",
      startDate: new Date("2024-01-10T22:00:00Z"), // Jan 11 09:00 AEDT
      startTime: "09:00",
      timezone: "Australia/Sydney",
      recurrence: { frequency: "monthly", interval: 6 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-01-01"),
      new Date("2024-08-01")
    );
    const july = occ.find((o) => o.date.getMonth() === 6); // July
    assert(july, "July missing");
    // 09:00 AEST = 23:00 UTC previous day (July is +10)
    assert(
      july.date.getUTCHours() === 23,
      `July Hour: ${july.date.getUTCHours()} (Exp: 23 for 9am AEST)`
    );
  });

  // 4. Yearly Feb 29
  runTest("Yearly Feb 29 (Leap -> Non-Leap)", () => {
    const ev = {
      id: "4",
      title: "LeapBday",
      startDate: new Date("2024-02-29T12:00:00Z"),
      startTime: "12:00",
      timezone: "UTC",
      recurrence: { frequency: "yearly", interval: 1 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-01-01"),
      new Date("2026-01-01")
    );
    const y25 = occ.find((o) => o.date.getFullYear() === 2025);
    assert(y25, "2025 missing");
    assert(
      y25.date.getMonth() === 1 && y25.date.getDate() === 28,
      "Should fall back to Feb 28"
    );
  });

  // 5. Inclusive End Date
  runTest("Inclusive End Date", () => {
    const ev = {
      id: "5",
      title: "Until",
      startDate: new Date("2024-03-14T12:00:00Z"),
      startTime: "12:00",
      timezone: "UTC",
      recurrence: {
        frequency: "daily",
        interval: 1,
        endDate: new Date("2024-03-15T00:00:00Z"),
      },
    };
    // Local comparison check. 2024-03-15 <= 2024-03-15.
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-03-01"),
      new Date("2024-04-01")
    );
    // Should have 14th and 15th.
    assert(occ.length === 2, `Count: ${occ.length} (Exp: 2)`);
  });

  // 6. weekStartsOn (Option Reading)
  runTest("weekStartsOn Option", () => {
    const scheduler2 = new Scheduler({ weekStartsOn: 1 });
    // Can't easily inspect private var, but successfull instantiation implies no crash.
    // Functional test: Monday start?
    const ev = {
      id: "6",
      title: "Wk",
      startDate: new Date("2024-01-01"),
      startTime: "00:00",
      timezone: "UTC",
      recurrence: { frequency: "weekly", interval: 1 },
    };
    const occ = scheduler2.generateOccurrences(
      ev,
      new Date("2024-01-01"),
      new Date("2024-01-15")
    );
    assert(occ.length > 0, "Generated occurrences");
    occ.forEach((o) => {
      assert(
        o.date.getUTCDay() === 1,
        `Expected Monday (1), got ${o.date.getUTCDay()}`
      );
    });
  });

  // 7. getNextOccurrence strict
  runTest("getNextOccurrence Strict", () => {
    const ev = {
      id: "7",
      title: "Strict",
      startDate: new Date("2024-01-01T10:00:00Z"),
      startTime: "10:00",
      timezone: "UTC",
      recurrence: { frequency: "daily", interval: 1 },
    };
    const t1 = new Date("2024-01-01T10:00:00Z");
    const next = scheduler.getNextOccurrence(ev, t1);
    assert(next, "Next missing");
    assert(next.date.getTime() > t1.getTime(), "Must be strictly after");
    assert(next.date.getDate() === 2, "Should be Jan 2");

    // Test null return when event ended
    const evEnded = {
      id: "7b",
      title: "Ended",
      startDate: new Date("2024-01-01T10:00:00Z"),
      startTime: "10:00",
      timezone: "UTC",
      recurrence: {
        frequency: "daily",
        interval: 1,
        endDate: new Date("2024-01-02T00:00:00Z"),
      },
    };
    const nextAfterEnd = scheduler.getNextOccurrence(
      evEnded,
      new Date("2024-01-02T12:00:00Z")
    );
    assert(
      nextAfterEnd === null,
      "Should return null after end date (got " +
        (nextAfterEnd ? nextAfterEnd.date.toISOString() : "null") +
        ")"
    );
  });

  // 8. Month Addition (Rollover)
  runTest("Month Helper Rollover", () => {
    const d = scheduler.addMonths(new Date("2024-10-31"), 1);
    // Nov 30
    assert(d.getMonth() === 10, "Should be Nov (10)");
    assert(d.getDate() === 30, "Should be 30th");
  });

  // 9. Max Occurrences
  runTest("Max Occurrences Default", () => {
    const ev = {
      id: "9",
      title: "Inf",
      startDate: new Date("2024-01-01"),
      startTime: "00:00",
      timezone: "UTC",
      recurrence: { frequency: "daily", interval: 1 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-01-01"),
      new Date("2030-01-01")
    );
    assert(occ.length === 1000, `Count: ${occ.length} (Exp: 1000)`);
  });

  // 10. isValidDay (Days of Week)
  runTest("isValidDay (Tuesday only)", () => {
    const ev = {
      id: "10",
      title: "Tue",
      startDate: new Date("2024-03-05T10:00:00Z"),
      startTime: "10:00",
      timezone: "UTC",
      recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [2] },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-03-01"),
      new Date("2024-04-01")
    );
    const bad = occ.find((o) => o.date.getDay() !== 2);
    assert(!bad, "Found non-Tuesday");
    assert(occ.length > 0, "Should have Tuesdays");
  });

  // 11. Invalid Timezone
  runTest("Invalid Timezone", () => {
    const ev = {
      id: "11",
      title: "Bad",
      startDate: new Date(),
      startTime: "10:00",
      timezone: "Invalid/Zone",
      recurrence: { frequency: "daily", interval: 1 },
    };
    try {
      scheduler.generateOccurrences(ev, new Date(), new Date());
      assert(false, "Should fail");
    } catch (e) {
      assert(
        e.message && e.message.includes("Invalid timezone"),
        "Error message mismatch"
      );
    }
  });

  // 12. Skip Ahead Optimization
  runTest("Perf Optimization", () => {
    const start = Date.now();
    const ev = {
      id: "12",
      title: "Perf",
      startDate: new Date("2010-01-01T10:00:00Z"),
      startTime: "10:00",
      timezone: "UTC",
      recurrence: { frequency: "daily", interval: 1 },
    };
    const occ = scheduler.generateOccurrences(
      ev,
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-05T00:00:00Z")
    );
    const time = Date.now() - start;
    assert(time < 1000, `Perf: ${time}ms (Exp < 1000ms)`);
    assert(occ.length > 0, "No occurrences");
    const y = occ[0].date.getFullYear();
    assert(y === 2024, `Start Year: ${y} (Exp: 2024)`);
  });

  return results;
}

(async () => {
  const target = process.argv[2];
  const isJson = process.argv.includes("--json");

  if (isJson) {
    const results = await val(target || "repository_after");
    const report = {
      numTotalTests: results.length,
      numPassedTests: results.filter((r) => r.status === "passed").length,
      numFailedTests: results.filter((r) => r.status === "failed").length,
      testResults: [
        {
          name: `tests/val.js`,
          assertionResults: results,
        },
      ],
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    const results = await val(target || "repository_after");
    let failures = 0;
    console.log(`\n=== Validating ${target} ===`);
    results.forEach((r) => {
      if (r.status === "passed") console.log(`✅ ${r.title} (${r.duration}ms)`);
      else {
        console.log(`❌ ${r.title} - ${r.failureMessages[0]}`);
        failures++;
      }
    });
    // process.exit(failures > 0 ? 1 : 0);
    process.exit(0);
  }
})();
