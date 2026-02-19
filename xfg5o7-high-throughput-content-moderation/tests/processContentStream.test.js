const path = require("path");
const fs = require("fs");
const { strict: assert } = require("assert");
const { describe, test } = require("node:test");

const repoPath = process.env.REPO_PATH || "repository_after";
const repoRoot = path.resolve(__dirname, "..", repoPath);
const modulePath = path.join(repoRoot, "processContentStream.js");

const { processContentStream, preprocessRules, shallowClone } = require(
  modulePath,
);


describe("TC-01: Overlapping token detection", () => {
  test("should detect multiple overlapping tokens in the same message", () => {
    const rules = [
      {
        token: "super",
        category: "prefix",
        riskLevel: 2,
        isActive: true,
        expiresAt: "2099-01-01T00:00:00Z",
        targetRegions: ["US"],
      },
      {
        token: "man",
        category: "suffix",
        riskLevel: 3,
        isActive: true,
        expiresAt: "2099-01-01T00:00:00Z",
        targetRegions: ["US"],
      },
    ];

    const events = [
      {
        id: "evt-1",
        body: "superman",
        region: "US",
        timestamp: 123,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result.length, 1);
    assert.equal(result[0].riskScore, 3);
    assert.deepEqual(result[0].categories.split(",").sort(), [
      "prefix",
      "suffix",
    ]);
  });
});

describe("TC-02: Multiple matches must aggregate correctly", () => {
  test("should aggregate all matched categories and highest risk", () => {
    const rules = [
      {
        token: "bad",
        category: "abuse",
        riskLevel: 2,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
      {
        token: "evil",
        category: "hate",
        riskLevel: 5,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
      },
    ];

    const events = [
      {
        id: "evt-2",
        body: "bad and evil content",
        region: "US",
        timestamp: 456,
      },
    ];

    const result = processContentStream(events, rules);

    assert.equal(result[0].riskScore, 5);
    assert.deepEqual(result[0].categories.split(",").sort(), ["abuse", "hate"]);
  });
});

describe("TC-03: Expired and inactive rules must be ignored", () => {
  test("should ignore expired and inactive rules", () => {
    const rules = [
      {
        token: "block",
        category: "active",
        riskLevel: 3,
        isActive: true,
        expiresAt: "2099-01-01",
        targetRegions: ["US"],
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

describe("TC-07: Structural constraints (optimized implementation)", () => {
  test("should export preprocessRules and shallowClone", () => {
    assert.equal(typeof preprocessRules, "function");
    assert.equal(typeof shallowClone, "function");
  });

  test("should avoid JSON.parse/stringify in implementation", () => {
    const source = fs.readFileSync(modulePath, "utf8");
    assert.equal(source.includes("JSON.parse"), false);
    assert.equal(source.includes("JSON.stringify"), false);
  });

  test("should use outputLink (Aho-Corasick) for overlapping matches", () => {
    const source = fs.readFileSync(modulePath, "utf8");
    assert.ok(source.includes("outputLink"));
  });

  test("should use Set for region membership", () => {
    const source = fs.readFileSync(modulePath, "utf8");
    assert.ok(source.includes("regionSet"));
  });
});
