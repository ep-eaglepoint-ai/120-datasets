const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

function generateRunId() {
  return Math.random().toString(36).substring(2, 10);
}

function getGitInfo() {
  const gitInfo = { git_commit: "unknown", git_branch: "unknown" };
  try {
    gitInfo.git_commit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      timeout: 5000,
    })
      .trim()
      .substring(0, 8);
  } catch (err) {}
  try {
    gitInfo.git_branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  } catch (err) {}
  return gitInfo;
}

function getEnvironmentInfo() {
  const gitInfo = getGitInfo();
  return {
    node_version: process.version,
    platform: os.platform(),
    os: os.type(),
    os_release: os.release(),
    architecture: os.arch(),
    hostname: os.hostname(),
    git_commit: gitInfo.git_commit,
    git_branch: gitInfo.git_branch,
  };
}

function runTests(repositoryPath, repositoryName, expectSuccess = true) {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${repositoryName}`);
  console.log("=".repeat(60));

  try {
    const output = execSync("bun run test", {
      cwd: path.join(__dirname, "..", repositoryPath),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CI: "true" },
    });

    return parseOutput(output, repositoryName, true, expectSuccess);
  } catch (err) {
    if (err.stdout) {
      return parseOutput(err.stdout, repositoryName, false, expectSuccess);
    }

    console.error("\nERROR:", err.message);
    if (err.stderr) console.error("STDERR:", err.stderr);

    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0 },
      error: err.message,
    };
  }
}

function parseOutput(output, repositoryName, executionSuccess, expectSuccess) {
  const lines = output.split("\n");
  const tests = [];
  let passed = 0;
  let failed = 0;
  let total = 0;

  lines.forEach((line) => {
    if (line.includes("✓") || line.includes("√")) {
    }
  });

  const passMatch = output.match(/Tests\s+.*?(\d+)\s+passed/);
  const failMatch = output.match(/Tests\s+.*?(\d+)\s+failed/);

  if (passMatch) passed = parseInt(passMatch[1]);
  if (failMatch) failed = parseInt(failMatch[1]);

  total = passed + failed;

  if (total === 0 && output.includes("Test Files")) {
    const fileFailMatch = output.match(/Test Files\s+.*?(\d+)\s+failed/);
    const filePassMatch = output.match(/Test Files\s+.*?(\d+)\s+passed/);
  }

  const summary = {
    total: total,
    passed: passed,
    failed: failed,
    errors: 0,
    skipped: 0,
  };

  console.log(
    `\n${expectSuccess && failed > 0 ? "❌" : "✅"} Tests: ${summary.passed} passed, ${summary.failed} failed`,
  );

  const testsPassed = failed === 0 && passed > 0;

  return {
    success: testsPassed,
    exit_code: executionSuccess ? 0 : 1,
    tests,
    summary,
  };
}

function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const outputDir = path.join(__dirname, dateStr, timeStr);
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, "report.json");
}

const runId = generateRunId();
const startedAt = new Date();

console.log("\n" + "=".repeat(60));
console.log("OFFLINE-FIRST ARCHITECTURE EVALUATION");
console.log("=".repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const afterResults = runTests("repository_after", "repository_after", true);

const beforeResults = runTests(
  "repository_before",
  "repository_before",
  false,
);

const finishedAt = new Date();
const duration = (finishedAt - startedAt) / 1000;

console.log("\n" + "=".repeat(60));
console.log("EVALUATION SUMMARY");
console.log("=".repeat(60));
console.log(`\nRepository After (Should PASS):`);
console.log(
  `  Tests: ${afterResults.summary.passed} passed, ${afterResults.summary.failed} failed`,
);
console.log(`  Status: ${afterResults.success ? "✅ PASSED" : "❌ FAILED"}`);

console.log(`\nRepository Before (Should FAIL):`);
console.log(
  `  Tests: ${beforeResults.summary.passed} passed, ${beforeResults.summary.failed} failed`,
);
console.log(
  `  Status: ${!beforeResults.success ? "✅ FAILED (As Expected)" : "❌ UNEXPECTEDLY PASSED"}`,
);

const success = afterResults.success && !beforeResults.success;

const report = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(6)),
  success,
  environment: getEnvironmentInfo(),
  results: {
    repository_after: afterResults,
    repository_before: beforeResults,
  },
};

const outputPath = generateOutputPath();
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), { flag: 'w' });

// Also save to root for CI system (absolute path)
const rootReportPath = path.resolve(__dirname, "..", "report.json");
fs.writeFileSync(rootReportPath, JSON.stringify(report, null, 2), { flag: 'w' });

// Ensure file is flushed to disk
const fd = fs.openSync(rootReportPath, 'r+');
fs.fsyncSync(fd);
fs.closeSync(fd);

console.log(`\n✅ Report saved to: ${outputPath}`);
console.log(`✅ Report also saved to: ${rootReportPath}`);
console.log("\n" + "=".repeat(60));
console.log("EVALUATION COMPLETE");
console.log("=".repeat(60));
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Success: ${success ? "✅ YES" : "❌ NO"}`);

// Always exit 0 so CI can collect the report and determine success from report contents
process.exit(0);
