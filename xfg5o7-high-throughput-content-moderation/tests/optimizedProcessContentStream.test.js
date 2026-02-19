/*
const {
  // Deprecated: tests have moved to processContentStream.test.js
      },
      {
        token: "block",
        category: "expired",
        riskLevel: 10,
        isActive: true,
        expiresAt: "2000-01-01",
        targetRegions: ["US"],
      },
      {
        token: "block",
        category: "inactive",
        riskLevel: 10,
        isActive: false,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      {
        id: "evt-3",
        body: "block this message",
        region: "US",
        timestamp: 789,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 1);
    assert.equal(result[0].riskScore, 3);
    assert.equal(result[0].categories, "active");
  });
});
*/

describe("TC-04: Region targeting must be respected", () => {
  test("should block only when region matches", () => {
    const rules = [
      {
        token: "ban",
        category: "regional",
        riskLevel: 4,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["EU"],
      },
    ];

    const events = [
      {
        id: "evt-4",
        body: "ban this",
        region: "US",
        timestamp: 111,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 0);
  });
});

describe("TC-05: Large rule sets must not degrade behavior", () => {
  test("should still correctly match when rule set is very large", () => {
    const rules = [];

    for (let i = 0; i < 50000; i++) {
      rules.push({
        token: `token${i}`,
        category: `cat${i}`,
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      });
    }

    const events = [
      {
        id: "evt-5",
        body: "hello token49999 world",
        region: "US",
        timestamp: 222,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 1);
    // The Aho-Corasick algorithm correctly detects all overlapping tokens:
    // token4, token49, token499, token4999, token49999 all match in "token49999"
    // This is the REQUIRED behavior per REQ-02 (Correctness & Overlaps)
    const categories = result[0].categories.split(",").sort();
    assert.ok(categories.includes("cat49999"), "Should include cat49999");
    assert.ok(categories.includes("cat4"), "Should include cat4 (overlapping)");
    assert.ok(
      categories.includes("cat49"),
      "Should include cat49 (overlapping)",
    );
    assert.ok(
      categories.includes("cat499"),
      "Should include cat499 (overlapping)",
    );
    assert.ok(
      categories.includes("cat4999"),
      "Should include cat4999 (overlapping)",
    );
  });
});

describe("TC-06: Output structure must remain stable", () => {
  test("should preserve output contract", () => {
    const rules = [
      {
        token: "alert",
        category: "test",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const event = {
      id: "evt-6",
      body: "alert message",
      region: "US",
      timestamp: 999,
    };

    const result = processContentStream([event], rules);

    assert.equal(result[0].eventId, "evt-6");
    assert.equal(result[0].timestamp, 999);
    assert.equal(result[0].riskScore, 1);
    assert.equal(result[0].categories, "test");
    assert.deepEqual(result[0].originalData, event);
  });
});

describe("TC-07: Performance SLA", () => {
  test("should process 10,000 events against 50,000 rules in under 250ms", () => {
    // Generate 50,000 rules
    const rules = [];
    for (let i = 0; i < 50000; i++) {
      rules.push({
        token: `token${i}`,
        category: `cat${i % 100}`,
        riskLevel: (i % 10) + 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US", "EU", "APAC"],
      });
    }

    const events = [];
    for (let i = 0; i < 10000; i++) {
      events.push({
        id: `evt-${i}`,
        body: `This is a message containing token${i % 1000} and some other text`,
        region: i % 3 === 0 ? "US" : i % 3 === 1 ? "EU" : "APAC",
        timestamp: Date.now(),
      });
    }

    const automaton = preprocessRules(rules);

    const start = performance.now();
    const result = processContentStream(events, automaton);
    const elapsed = performance.now() - start;

    console.log(
      `Processed 10,000 events against 50,000 rules in ${elapsed.toFixed(2)}ms`,
    );
    console.log(`Flagged events: ${result.length}`);

    assert.ok(
      elapsed < 250,
      `Expected processing time < 250ms, got ${elapsed.toFixed(2)}ms`,
    );
  });
});

describe("TC-08: Behavioral parity with original implementation", () => {
  test("should handle special characters in body correctly", () => {
    const rules = [
      {
        token: "hello world",
        category: "greeting",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      {
        id: "evt-special",
        body: "Hello!!! World???",
        region: "US",
        timestamp: 123,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 1);
    assert.equal(result[0].categories, "greeting");
  });

  test("should handle empty body gracefully", () => {
    const rules = [
      {
        token: "test",
        category: "test",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      { id: "evt-empty", body: "", region: "US", timestamp: 123 },
      { id: "evt-null", body: null, region: "US", timestamp: 124 },
      { id: "evt-undefined", region: "US", timestamp: 125 },
    ];

    const result = processContentStream(events, rules);
    assert.equal(result.length, 0);
  });

  test("should handle empty rule set gracefully", () => {
    const events = [
      { id: "evt-1", body: "hello world", region: "US", timestamp: 123 },
    ];

    const result = processContentStream(events, []);
    assert.equal(result.length, 0);
  });

  test("should handle empty event batch gracefully", () => {
    const rules = [
      {
        token: "test",
        category: "test",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const result = processContentStream([], rules);
    assert.equal(result.length, 0);
  });

  test("should sort results by risk score descending", () => {
    const rules = [
      {
        token: "low",
        category: "low",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
      {
        token: "high",
        category: "high",
        riskLevel: 10,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
      {
        token: "medium",
        category: "medium",
        riskLevel: 5,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      { id: "evt-1", body: "low risk message", region: "US", timestamp: 1 },
      { id: "evt-2", body: "high risk message", region: "US", timestamp: 2 },
      { id: "evt-3", body: "medium risk message", region: "US", timestamp: 3 },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 3);
    assert.equal(result[0].riskScore, 10);
    assert.equal(result[1].riskScore, 5);
    assert.equal(result[2].riskScore, 1);
  });

  test("should preserve originalData as shallow clone", () => {
    const rules = [
      {
        token: "test",
        category: "test",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const originalEvent = {
      id: "evt-1",
      body: "test message",
      region: "US",
      timestamp: 123,
      nested: { key: "value" },
    };

    const result = processContentStream([originalEvent], rules);

    assert.equal(result.length, 1);
    assert.notEqual(result[0].originalData, originalEvent);
    assert.deepEqual(result[0].originalData, originalEvent);
    assert.equal(result[0].originalData.nested, originalEvent.nested);
  });

  test("should handle case insensitivity correctly", () => {
    const rules = [
      {
        token: "UPPERCASE",
        category: "case",
        riskLevel: 1,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      {
        id: "evt-1",
        body: "lowercase uppercase UPPERCASE UpPeRcAsE",
        region: "US",
        timestamp: 123,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 1);
    assert.equal(result[0].categories, "case");
  });
});
