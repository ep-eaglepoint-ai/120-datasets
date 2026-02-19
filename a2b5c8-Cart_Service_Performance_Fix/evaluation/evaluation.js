#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORTS = path.join(__dirname, "reports");
const TESTS_DIR = path.join(ROOT, "tests");

function truncateMiddle(text, maxLen) {
  if (typeof text !== "string") return "";
  if (text.length <= maxLen) return text;
  const head = Math.floor(maxLen * 0.7);
  const tail = maxLen - head - 30;
  return `${text.slice(0, head)}\n... (truncated) ...\n${text.slice(-tail)}`;
}

function formatReportContent(report) {
  const beforePassed = report?.before?.tests?.passed;
  const afterPassed = report?.after?.tests?.passed;
  const beforeCode = report?.before?.tests?.return_code;
  const afterCode = report?.after?.tests?.return_code;
  const beforeOut = report?.before?.tests?.output || "";
  const afterOut = report?.after?.tests?.output || "";

  return [
    "## Summary",
    `- **success**: \`${Boolean(report?.success)}\``,
    `- **passed_gate**: \`${Boolean(report?.comparison?.passed_gate)}\``,
    `- **improvement_summary**: ${report?.comparison?.improvement_summary || ""}`,
    "",
    "## Before (`repository_before`)",
    `- **passed**: \`${Boolean(beforePassed)}\``,
    `- **return_code**: \`${typeof beforeCode === "number" ? beforeCode : ""}\``,
    "### Output (truncated)",
    "```",
    truncateMiddle(beforeOut, 6000),
    "```",
    "",
    "## After (`repository_after`)",
    `- **passed**: \`${Boolean(afterPassed)}\``,
    `- **return_code**: \`${typeof afterCode === "number" ? afterCode : ""}\``,
    "### Output (truncated)",
    "```",
    truncateMiddle(afterOut, 6000),
    "```",
    "",
  ].join("\n");
}

function formatLogSummary(report) {
  return [
    "CART SERVICE PERFORMANCE EVALUATION",
    "",
    `success: ${Boolean(report?.success)}`,
    `passed_gate: ${Boolean(report?.comparison?.passed_gate)}`,
    `before.passed: ${Boolean(report?.before?.tests?.passed)}`,
    `after.passed: ${Boolean(report?.after?.tests?.passed)}`,
    "",
  ].join("\n");
}

function getUUID() {
  try {
    return require("crypto").randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

function environmentInfo() {
  return {
    node_version: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
}

function parseTestOutput(output, returnCode) {
  let passedCount = 0;
  let failedCount = 0;
  let totalCount = 0;

  for (const line of output.split("\n")) {
    if (line.includes("Passed:")) {
      const match = line.match(/Passed:\s*(\d+)/);
      if (match) passedCount = parseInt(match[1], 10);
    }
    if (line.includes("Failed:")) {
      const match = line.match(/Failed:\s*(\d+)/);
      if (match) failedCount = parseInt(match[1], 10);
    }
    if (line.includes("Total:")) {
      const match = line.match(/Total:\s*(\d+)/);
      if (match) totalCount = parseInt(match[1], 10);
    }
  }

  // Do NOT trust process exit codes for "before" runs; rely on parsed counts.
  const passed = totalCount > 0 && failedCount === 0;

  return {
    passed,
    return_code: returnCode,
    output: output.slice(0, 8000),
    test_count: totalCount,
    passed_count: passedCount,
    failed_count: failedCount,
  };
}

function runTests(repoName) {
  const repoPath = repoName === "repository_before" ? path.join(ROOT, "repository_before") : path.join(ROOT, "repository_after");
  try {
    const env = { ...process.env, TEST_REPO_PATH: repoPath };
    const out = execSync("npm test 2>&1", {
      cwd: TESTS_DIR,
      env,
      encoding: "utf8",
      timeout: 120000,
      stdio: "pipe",
    });
    return parseTestOutput(out, 0);
  } catch (error) {
    const output = (error.stdout || "") + (error.stderr || "");
    return parseTestOutput(output || `Test execution error: ${error.message}`, error.status || 1);
  }
}

function evaluate(repoName) {
  const tests = runTests(repoName);
  const passRate = tests.test_count > 0 ? Math.round((tests.passed_count / tests.test_count) * 10000) / 100 : 0;
  return {
    tests,
    metrics: {
      pass_rate: passRate,
      test_count: tests.test_count,
      passed_count: tests.passed_count,
      failed_count: tests.failed_count,
    },
  };
}

function runEvaluation() {
  const runId = getUUID();
  const start = new Date();

  try {
    const before = evaluate("repository_before");
    const after = evaluate("repository_after");

    const improvement = after.metrics.passed_count - before.metrics.passed_count;
    let summary;
    if (improvement > 0) {
      summary = `Fixed ${improvement} issue(s). After: ${after.metrics.passed_count}/${after.metrics.test_count} tests pass.`;
    } else if (improvement < 0) {
      summary = `Regression: ${Math.abs(improvement)} test(s) now failing.`;
    } else {
      summary = `No change. ${after.metrics.passed_count}/${after.metrics.test_count} tests pass.`;
    }

    const comparison = {
      passed_gate: after.tests.passed,
      improvement_summary: summary,
    };

    const end = new Date();
    return {
      run_id: runId,
      started_at: start.toISOString(),
      finished_at: end.toISOString(),
      duration_seconds: (end - start) / 1000,
      environment: environmentInfo(),
      before,
      after,
      comparison,
      success: comparison.passed_gate,
      error: null,
    };
  } catch (error) {
    const end = new Date();
    return {
      run_id: runId,
      started_at: start.toISOString(),
      finished_at: end.toISOString(),
      duration_seconds: (end - start) / 1000,
      environment: environmentInfo(),
      before: null,
      after: null,
      comparison: null,
      success: false,
      error: error.message,
    };
  }
}

function main() {
  if (!fs.existsSync(REPORTS)) fs.mkdirSync(REPORTS, { recursive: true });

  const report = runEvaluation();

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace(/\..+/, "").replace("T", "_");
  const reportPath = path.join(REPORTS, `${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Stable, mandatory artifacts (expected by dataset evaluators).
  fs.writeFileSync(path.join(REPORTS, "latest.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS, "report_content"), formatReportContent(report));
  fs.writeFileSync(path.join(REPORTS, "log_summary"), formatLogSummary(report));

  // Also write the sample-style nested report directory (YYYY-MM-DD/HH-MM-SS/report.json),
  // while keeping the mandatory root artifacts above.
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const nestedDir = path.join(REPORTS, dateStr, timeStr);
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, "report.json"), JSON.stringify(report, null, 2));

  console.log(`Report written to ${reportPath}`);
  console.log("\nEvaluation Summary:");
  console.log(`  Run ID: ${report.run_id}`);
  console.log(`  Success: ${report.success}`);
  if (report.comparison) console.log(`  ${report.comparison.improvement_summary}`);
  if (report.error) console.log(`  Error: ${report.error}`);

  return report.success ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { runEvaluation, main };

