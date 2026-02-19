#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

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

function runTests(repositoryPath, repositoryName) {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${repositoryName}`);
  console.log("=".repeat(60));

  try {
    const result = execSync("node --test tests/processContentStream.test.js", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, REPO_PATH: repositoryName },
    });

    const summary = extractNodeTestSummary(result);

    return {
      success: true,
      exit_code: 0,
      tests: [],
      summary,
    };
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : "";
    const stderr = err.stderr ? String(err.stderr) : "";
    const combined = `${stdout}\n${stderr}`.trim();
    const summary = extractNodeTestSummary(combined);

    const errorMessage = err.message || String(err);
    console.error("\nERROR:", errorMessage);
    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary,
      error: errorMessage,
    };
  }
}

function extractNodeTestSummary(output) {
  const passMatch = output.match(/\bpass\s+(\d+)/i);
  const failMatch = output.match(/\bfail\s+(\d+)/i);
  const testMatch = output.match(/\btests\s+(\d+)/i);

  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
  const total = testMatch ? parseInt(testMatch[1], 10) : passed + failed;

  return {
    total,
    passed,
    failed,
    errors: failed > 0 ? 1 : 0,
    skipped: 0,
  };
}

function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const outputDir = path.join(process.cwd(), "evaluation", dateStr, timeStr);
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, "report.json");
}

const runId = generateRunId();
const startedAt = new Date();

console.log("\n" + "=".repeat(60));
console.log("HIGH-THROUGHPUT CONTENT MODERATION EVALUATION");
console.log("=".repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const beforeResults = runTests("repository_before", "repository_before");
const afterResults = runTests("repository_after", "repository_after");

const finishedAt = new Date();
const duration = (finishedAt.getTime() - startedAt.getTime()) / 1000;

const comparison = {
  before_tests_passed: beforeResults.success,
  after_tests_passed: afterResults.success,
  after_all_tests_passed:
    afterResults.summary.total > 0 && afterResults.summary.failed === 0,
  before_total: beforeResults.summary.total,
  before_passed: beforeResults.summary.passed,
  before_failed: beforeResults.summary.failed,
  after_total: afterResults.summary.total,
  after_passed: afterResults.summary.passed,
  after_failed: afterResults.summary.failed,
};

console.log("\n" + "=".repeat(60));
console.log("EVALUATION SUMMARY");
console.log("=".repeat(60));
console.log(`\nBefore Implementation (repository_before):`);
console.log(
  `  Overall: ${beforeResults.success ? "✅ PASSED" : "❌ FAILED/SKIPPED"}`,
);
console.log(
  `  Tests: ${comparison.before_passed}/${comparison.before_total} passed`,
);
console.log(`\nAfter Implementation (repository_after):`);
console.log(`  Overall: ${afterResults.success ? "✅ PASSED" : "❌ FAILED"}`);
console.log(
  `  Tests: ${comparison.after_passed}/${comparison.after_total} passed`,
);

const success = afterResults.success;
const errorMessage = success ? null : "After implementation tests failed";

const report = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(6)),
  success,
  error: errorMessage,
  environment: getEnvironmentInfo(),
  results: {
    before: beforeResults,
    after: {
      ...afterResults,
      all_tests_passed:
        afterResults.summary.total > 0 && afterResults.summary.failed === 0,
    },
    comparison,
  },
};

const outputPath = generateOutputPath();
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log(`\n✅ Report saved to: ${outputPath}`);
console.log("\n" + "=".repeat(60));
console.log("EVALUATION COMPLETE");
console.log("=".repeat(60));
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Success: ${success ? "✅ YES" : "❌ NO"}`);

process.exit(success ? 0 : 1);
