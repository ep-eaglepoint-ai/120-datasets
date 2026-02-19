#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const crypto = require("crypto");

// --- CONFIGURATION ---
// FIX: Go up one level from 'evaluation/' to get to the project root '/app'
const ROOT_DIR = path.resolve(__dirname, "..");

const TARGETS = {
  before: {
    // Expected to match: /app/tests/promo-service-before.test.js
    testFile: path.join(ROOT_DIR, "tests", "promo-service-before.test.js"),
    label: "BEFORE (Legacy Implementation)",
  },
  after: {
    // Expected to match: /app/tests/promo-service-mock.test.js
    testFile: path.join(ROOT_DIR, "tests", "promo-service-after.test.js"),
    label: "AFTER (Optimized Implementation)",
  },
};

// --- HELPER FUNCTIONS ---

function generateRunId() {
  return crypto.randomBytes(4).toString("hex");
}

function getEnvironmentInfo() {
  return {
    node_version: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory_free_mb: Math.round(os.freemem() / 1024 / 1024),
  };
}

/**
 * Runs the specific test suite file using JEST
 */
function runTestSuite(targetLabel, testFilePath) {
  return new Promise((resolve) => {
    console.log(`\n▶ Running: ${targetLabel}`);
    console.log(`  Target: ${testFilePath}`); // Log full path for debugging

    const startTime = Date.now();

    // We use npx jest to run the specific file
    const child = spawn(
      "npx",
      ["jest", testFilePath, "--colors", "--runInBand"],
      {
        cwd: ROOT_DIR, // Ensure we run from project root
        env: { ...process.env, CI: "true" },
        stdio: "pipe",
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(str);
    });

    child.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str);
    });

    child.on("close", (code) => {
      const duration = (Date.now() - startTime) / 1000;
      const fullOutput = stdout + stderr;
      const results = parseJestOutput(fullOutput);

      resolve({
        success: code === 0,
        exit_code: code,
        duration_seconds: duration,
        results: results,
        raw_output: fullOutput,
      });
    });
  });
}

function parseJestOutput(output) {
  const cleanOutput = output.replace(/\u001b\[\d+m/g, "");

  const tests = [];
  const lines = cleanOutput.split("\n");

  const passRegex = /^\s*✓\s+(.+)$/;
  const failRegex = /^\s*✕\s+(.+)$/;
  const summaryRegex =
    /Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+passed,\s+)?(\d+)\s+total/;

  let totalParsed = 0;
  let passedParsed = 0;
  let failedParsed = 0;

  for (const line of lines) {
    const passMatch = line.match(passRegex);
    const failMatch = line.match(failRegex);

    if (passMatch) {
      tests.push({ name: passMatch[1].trim(), outcome: "passed" });
    } else if (failMatch) {
      tests.push({ name: failMatch[1].trim(), outcome: "failed" });
    }

    const sumMatch = line.match(summaryRegex);
    if (sumMatch) {
      failedParsed = parseInt(sumMatch[1] || "0", 10);
      passedParsed = parseInt(sumMatch[2] || "0", 10);
      totalParsed = parseInt(sumMatch[3] || "0", 10);
    }
  }

  if (totalParsed === 0 && tests.length > 0) {
    totalParsed = tests.length;
    passedParsed = tests.filter((t) => t.outcome === "passed").length;
    failedParsed = tests.filter((t) => t.outcome === "failed").length;
  }

  return {
    tests,
    summary: {
      total: totalParsed,
      passed: passedParsed,
      failed: failedParsed,
    },
  };
}

function generateReportPath() {
  const reportDir = path.join(__dirname); // Save in 'evaluation' folder
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  return path.join(reportDir, "report.json");
}

async function main() {
  const runId = generateRunId();
  const startedAt = new Date();

  console.log("==================================================");
  console.log("🚀 STARTING PROMO CODE SERVICE EVALUATION");
  console.log("==================================================");

  try {
    const beforeResult = await runTestSuite(
      TARGETS.before.label,
      TARGETS.before.testFile
    );

    const afterResult = await runTestSuite(
      TARGETS.after.label,
      TARGETS.after.testFile
    );

    const finishedAt = new Date();

    const comparison = {
      overall_status: afterResult.success ? "OPTIMIZED" : "FAILED",
      before_pass_rate: `${beforeResult.results.summary.passed}/${beforeResult.results.summary.total}`,
      after_pass_rate: `${afterResult.results.summary.passed}/${afterResult.results.summary.total}`,
      key_findings: [],
    };

    if (beforeResult.results.summary.failed > 0) {
      comparison.key_findings.push(
        "Legacy code failed baseline requirements (Expected)."
      );
    }
    if (afterResult.success) {
      comparison.key_findings.push("Optimized code passed all requirements.");
    }

    const report = {
      run_id: runId,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      environment: getEnvironmentInfo(),
      comparison: comparison,
      details: {
        before: { ...beforeResult, raw_output: "Truncated" },
        after: { ...afterResult, raw_output: "Truncated" },
      },
    };

    const reportPath = generateReportPath();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n==================================================");
    console.log("✅ EVALUATION COMPLETE");
    console.log("==================================================");
    console.log(`\n📊 SUMMARY:`);
    console.log(`   BEFORE: ${comparison.before_pass_rate} Passed`);
    console.log(`   AFTER:  ${comparison.after_pass_rate} Passed`);
    console.log(`\n📄 Detailed JSON Report saved to: ${reportPath}`);

    if (afterResult.success) {
      process.exit(0);
    } else {
      console.error("\n❌ The Optimized code did not pass all tests.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ SYSTEM ERROR:", error);
    process.exit(1);
  }
}

main();
