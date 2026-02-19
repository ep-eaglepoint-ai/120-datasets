#!/usr/bin/env node
/**
 * Evaluation runner for Auth Service Security Fix.
 *
 * This evaluation script:
 * - Runs Jest tests on the tests/ folder for both before and after implementations
 * - Collects individual test results with pass/fail status
 * - Generates structured reports with environment metadata
 *
 * Run with:
 *     docker compose run --rm evaluation
 *     node evaluation/evaluation.js [--output path/to/report.json]
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

/**
 * Generate a short unique run ID.
 */
function generateRunId() {
  return crypto.randomBytes(4).toString("hex");
}

/**
 * Get git commit and branch information.
 */
function getGitInfo() {
  const gitInfo = { git_commit: "unknown", git_branch: "unknown" };

  try {
    const commit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    gitInfo.git_commit = commit.slice(0, 8);
  } catch (e) {
    // ignore
  }

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    gitInfo.git_branch = branch;
  } catch (e) {
    // ignore
  }

  return gitInfo;
}

/**
 * Collect environment information for the report.
 */
function getEnvironmentInfo() {
  const gitInfo = getGitInfo();

  return {
    node_version: process.version,
    platform: `${os.platform()}-${os.arch()}`,
    os: os.platform(),
    os_release: os.release(),
    architecture: os.arch(),
    hostname: os.hostname(),
    git_commit: gitInfo.git_commit,
    git_branch: gitInfo.git_branch,
  };
}

/**
 * Run Jest tests with specific TARGET_REPOSITORY environment variable.
 *
 * @param {string} targetRepo - The target repository name (e.g., "repository_before", "repository_after")
 * @param {string} label - Label for this test run (e.g., "before", "after")
 * @returns {object} - Test results
 */
function runJestTests(targetRepo, label) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RUNNING TESTS: ${label.toUpperCase()}`);
  console.log("=".repeat(60));
  console.log(`TARGET_REPOSITORY: ${targetRepo}`);

  const projectRoot = path.resolve(__dirname, "..");
  const testsDir = path.join(projectRoot, "tests");

  console.log(`Tests directory: ${testsDir}`);

  // Build Jest command with JSON reporter
  const env = {
    ...process.env,
    TARGET_REPOSITORY: targetRepo,
  };

  try {
    // Run Jest with JSON output
    const result = spawnSync(
      "npx",
      ["jest", "tests/", "--json", "--testLocationInResults", "--forceExit"],
      {
        cwd: projectRoot,
        env,
        encoding: "utf8",
        timeout: 120000,
      },
    );

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";

    // Parse JSON output from Jest
    let jestResults;
    try {
      // Jest outputs JSON to stdout
      jestResults = JSON.parse(stdout);
    } catch (e) {
      // If JSON parsing fails, try to parse verbose output
      console.log("Failed to parse Jest JSON output, using fallback parser");
      jestResults = null;
    }

    let tests = [];
    let passed = 0;
    let failed = 0;
    let errors = 0;
    let skipped = 0;

    if (jestResults && jestResults.testResults) {
      for (const testFile of jestResults.testResults) {
        for (const assertion of testFile.assertionResults || []) {
          const outcome =
            assertion.status === "passed"
              ? "passed"
              : assertion.status === "failed"
                ? "failed"
                : assertion.status === "pending"
                  ? "skipped"
                  : "error";

          tests.push({
            nodeid: `${path.basename(testFile.name)}::${assertion.title}`,
            name: assertion.title,
            outcome: outcome,
          });

          if (outcome === "passed") passed++;
          else if (outcome === "failed") failed++;
          else if (outcome === "skipped") skipped++;
          else errors++;
        }
      }
    } else {
      // Fallback: parse from stderr/stdout text
      tests = parseJestVerboseOutput(stderr + stdout);
      passed = tests.filter((t) => t.outcome === "passed").length;
      failed = tests.filter((t) => t.outcome === "failed").length;
      errors = tests.filter((t) => t.outcome === "error").length;
      skipped = tests.filter((t) => t.outcome === "skipped").length;
    }

    const total = tests.length;

    console.log(
      `\nResults: ${passed} passed, ${failed} failed, ${errors} errors, ${skipped} skipped (total: ${total})`,
    );

    // Print individual test results
    const statusIcons = {
      passed: "✅",
      failed: "❌",
      error: "💥",
      skipped: "⏭️",
    };

    for (const test of tests) {
      const icon = statusIcons[test.outcome] || "❓";
      console.log(`  ${icon} ${test.nodeid}: ${test.outcome}`);
    }

    return {
      success: result.status === 0,
      exit_code: result.status,
      tests: tests,
      summary: {
        total,
        passed,
        failed,
        errors,
        skipped,
      },
      stdout: stdout.slice(-3000),
      stderr: stderr.slice(-1000),
    };
  } catch (e) {
    if (e.message && e.message.includes("TIMEOUT")) {
      console.log("❌ Test execution timed out");
      return {
        success: false,
        exit_code: -1,
        tests: [],
        summary: { error: "Test execution timed out" },
        stdout: "",
        stderr: "",
      };
    }

    console.log(`❌ Error running tests: ${e.message}`);
    return {
      success: false,
      exit_code: -1,
      tests: [],
      summary: { error: e.message },
      stdout: "",
      stderr: "",
    };
  }
}

/**
 * Parse Jest verbose output to extract test results (fallback).
 */
function parseJestVerboseOutput(output) {
  const tests = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match lines like: ✓ register normalizes email and hashes password (5 ms)
    // or: ✕ some test that failed
    if (trimmed.startsWith("✓") || trimmed.startsWith("√")) {
      const name = trimmed
        .replace(/^[✓√]\s*/, "")
        .replace(/\s*\(\d+\s*ms\)$/, "")
        .trim();
      tests.push({ nodeid: name, name, outcome: "passed" });
    } else if (trimmed.startsWith("✕") || trimmed.startsWith("×")) {
      const name = trimmed
        .replace(/^[✕×]\s*/, "")
        .replace(/\s*\(\d+\s*ms\)$/, "")
        .trim();
      tests.push({ nodeid: name, name, outcome: "failed" });
    } else if (trimmed.startsWith("○")) {
      const name = trimmed
        .replace(/^○\s*/, "")
        .replace(/\s*\(\d+\s*ms\)$/, "")
        .trim();
      tests.push({ nodeid: name, name, outcome: "skipped" });
    }
  }

  return tests;
}

/**
 * Run complete evaluation for both implementations.
 */
function runEvaluation() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("AUTH SERVICE SECURITY FIX EVALUATION");
  console.log("=".repeat(60));

  // Run tests with BEFORE implementation
  const beforeResults = runJestTests(
    "repository_before",
    "before (repository_before)",
  );

  // Run tests with AFTER implementation
  const afterResults = runJestTests(
    "repository_after",
    "after (repository_after)",
  );

  // Build comparison
  const comparison = {
    before_tests_passed: beforeResults.success,
    after_tests_passed: afterResults.success,
    before_total: beforeResults.summary.total || 0,
    before_passed: beforeResults.summary.passed || 0,
    before_failed: beforeResults.summary.failed || 0,
    after_total: afterResults.summary.total || 0,
    after_passed: afterResults.summary.passed || 0,
    after_failed: afterResults.summary.failed || 0,
  };

  // Print summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("EVALUATION SUMMARY");
  console.log("=".repeat(60));

  console.log(`\nBefore Implementation (repository_before):`);
  console.log(
    `  Overall: ${beforeResults.success ? "✅ PASSED" : "❌ FAILED"}`,
  );
  console.log(
    `  Tests: ${comparison.before_passed}/${comparison.before_total} passed`,
  );

  console.log(`\nAfter Implementation (repository_after):`);
  console.log(`  Overall: ${afterResults.success ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(
    `  Tests: ${comparison.after_passed}/${comparison.after_total} passed`,
  );

  // Determine expected behavior
  console.log(`\n${"=".repeat(60)}`);
  console.log("EXPECTED BEHAVIOR CHECK");
  console.log("=".repeat(60));

  if (afterResults.success) {
    console.log("✅ After implementation: All tests passed (expected)");
  } else {
    console.log(
      "❌ After implementation: Some tests failed (unexpected - should pass all)",
    );
  }

  return {
    before: beforeResults,
    after: afterResults,
    comparison,
  };
}

/**
 * Generate output path in format: evaluation/YYYY-MM-DD/HH-MM-SS/report.json
 */
function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");

  const projectRoot = path.resolve(__dirname, "..");
  const outputDir = path.join(projectRoot, "evaluation", dateStr, timeStr);

  fs.mkdirSync(outputDir, { recursive: true });

  return path.join(outputDir, "report.json");
}

/**
 * Main entry point for evaluation.
 */
function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  // Generate run ID and timestamps
  const runId = generateRunId();
  const startedAt = new Date();

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt.toISOString()}`);

  let results = null;
  let success = false;
  let errorMessage = null;

  try {
    results = runEvaluation();
    success = results.after.success;
    errorMessage = success ? null : "After implementation tests failed";
  } catch (e) {
    console.log(`\nERROR: ${e.message}`);
    console.log(e.stack);
    success = false;
    errorMessage = e.message;
  }

  const finishedAt = new Date();
  const duration = (finishedAt - startedAt) / 1000;

  // Collect environment information
  const environment = getEnvironmentInfo();

  // Build report
  const report = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds: Math.round(duration * 1000000) / 1000000,
    success,
    error: errorMessage,
    environment,
    results,
  };

  // Determine output path
  if (!outputPath) {
    outputPath = generateOutputPath();
  }

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to: ${outputPath}`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("EVALUATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Success: ${success ? "✅ YES" : "❌ NO"}`);

  process.exit(success ? 0 : 1);
}

main();
