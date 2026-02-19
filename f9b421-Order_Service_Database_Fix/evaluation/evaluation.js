#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const crypto = require("crypto");

// --- CONFIGURATION ---
const ROOT_DIR = path.resolve(__dirname, "..");

// FIX: Configuration now maps specific test files to specific scenarios
const TARGETS = {
  before: {
    // Matches: tests/test-before-repository-suite.js
    testFile: path.join(ROOT_DIR, "tests", "test-before-repository-suite.js"),
    label: "Before (Unoptimized)",
  },
  after: {
    // Matches: tests/test-after-repository-suite.js
    testFile: path.join(ROOT_DIR, "tests", "test-after-repository-suite.js"),
    label: "After (Optimized)",
  },
};

// --- HELPER FUNCTIONS ---

function generateRunId() {
  return crypto.randomBytes(4).toString("hex");
}

function getGitInfo() {
  const info = { commit: "unknown", branch: "unknown" };
  try {
    info.commit = require("child_process")
      .execSync("git rev-parse HEAD", { timeout: 1000, stdio: "pipe" })
      .toString()
      .trim()
      .substring(0, 8);
    info.branch = require("child_process")
      .execSync("git rev-parse --abbrev-ref HEAD", {
        timeout: 1000,
        stdio: "pipe",
      })
      .toString()
      .trim();
  } catch (e) {
    // Git not available, ignore silently
  }
  return info;
}

function getEnvironmentInfo() {
  const git = getGitInfo();
  return {
    node_version: process.version,
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    git_commit: git.commit,
    git_branch: git.branch,
  };
}

/**
 * Runs the specific test suite file
 */
function runTestSuite(targetLabel, testFilePath) {
  return new Promise((resolve) => {
    // FIX: Added logging so you can see progress immediately
    console.log(`\n▶ Running: ${targetLabel}`);
    console.log(`  File: ${path.relative(ROOT_DIR, testFilePath)}`);

    const startTime = Date.now();

    // Spawn the specific test file
    const child = spawn("node", [testFilePath], {
      cwd: ROOT_DIR,
      env: process.env, // Pass current env
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      // Optional: Uncomment the next line if you want to see test logs in real-time
      // process.stdout.write(str);
    });

    child.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      // FIX: Always print errors so you know if files are missing
      process.stderr.write(str);
    });

    child.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;

      // If the process failed, we should know why immediately
      if (code !== 0) {
        console.log(`  ⚠️  Process exited with code ${code}`);
        if (!stderr && !stdout) console.log("  ⚠️  No output received.");
      }

      const results = parseTestOutput(stdout);

      resolve({
        success: code === 0,
        exit_code: code,
        duration_seconds: duration,
        results: results,
        raw_output: stdout,
        raw_error: stderr,
      });
    });
  });
}

function parseTestOutput(output) {
  const tests = [];
  const lines = output.split("\n");
  // Adjust these regexes depending on how your specific test files output data
  const testLineRegex = /^(.*?)\s\.\.\.\s(✅ PASS|❌ FAIL|passed|failed)/i;
  const summaryRegex = /TEST SUMMARY: (\d+)\/(\d+) Passed/i;

  let totalParsed = 0;
  let passedParsed = 0;

  for (const line of lines) {
    const match = line.match(testLineRegex);
    if (match) {
      tests.push({
        name: match[1].trim(),
        outcome: match[2].toLowerCase().includes("pass") ? "passed" : "failed",
      });
    }

    const sumMatch = line.match(summaryRegex);
    if (sumMatch) {
      passedParsed = parseInt(sumMatch[1], 10);
      totalParsed = parseInt(sumMatch[2], 10);
    }
  }

  // Fallback if regex didn't catch specific summary lines (common in custom test runners)
  if (totalParsed === 0 && tests.length > 0) {
    totalParsed = tests.length;
    passedParsed = tests.filter((t) => t.outcome === "passed").length;
  }

  return {
    tests,
    summary: {
      total: totalParsed,
      passed: passedParsed,
      failed: totalParsed - passedParsed,
    },
  };
}

function generateReportPath() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  const reportDir = path.join(ROOT_DIR, "evaluation");

  // Ensure directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  return path.join(reportDir, "report.json");
}

// --- MAIN EXECUTION ---

async function main() {
  const runId = generateRunId();
  const startedAt = new Date();

  try {
    // Run Before Suite
    const beforeResult = await runTestSuite(
      TARGETS.before.label,
      TARGETS.before.testFile
    );

    // Run After Suite
    const afterResult = await runTestSuite(
      TARGETS.after.label,
      TARGETS.after.testFile
    );

    const finishedAt = new Date();

    const comparison = {
      before_success: beforeResult.success,
      after_success: afterResult.success,
      before_score: `${beforeResult.results.summary.passed}/${beforeResult.results.summary.total}`,
      after_score: `${afterResult.results.summary.passed}/${afterResult.results.summary.total}`,
      performance_impact: {
        before_duration: beforeResult.duration_seconds,
        after_duration: afterResult.duration_seconds,
        diff: (
          afterResult.duration_seconds - beforeResult.duration_seconds
        ).toFixed(3),
      },
    };

    const report = {
      run_id: runId,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      environment: getEnvironmentInfo(),
      comparison: comparison,
      details: {
        before: beforeResult,
        after: afterResult,
      },
    };

    const reportPath = generateReportPath();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n✅ Evaluation Completed successfully!");
    console.log(`📄 Report saved to: ${reportPath}`);

    // Check if we actually ran tests
    if (beforeResult.results.summary.total === 0) {
      console.warn(
        "\n⚠️  WARNING: No tests were detected in the 'Before' suite. Check file paths."
      );
    }

    process.exit(afterResult.success && beforeResult.success ? 0 : 1);
  } catch (error) {
    console.error("\n❌ CRITICAL ERROR:", error);
    process.exit(1);
  }
}

main();
