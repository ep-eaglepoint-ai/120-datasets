const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "evaluation", "reports");

function environmentInfo() {
  return {
    node_version: process.version,
    platform: `${os.platform()}-${os.arch()}`,
  };
}

function runJestJson(testFile) {
  try {
    const args = [
      "jest",
      "--json",
      "--runInBand",
      "--testLocationInResults",
      testFile,
    ];

    const result = spawnSync("npx", args, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      shell: true,
    });

    const raw = (result.stdout || "") + (result.stderr || "");
    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (e) {
      const m = result.stdout.match(/\{[\s\S]*\}\s*$/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch (e2) {
          parsed = null;
        }
      }
    }

    if (parsed && typeof parsed === "object") {
      const summary = {
        numTotalTests: parsed.numTotalTests || 0,
        numPassedTests: parsed.numPassedTests || 0,
        numFailedTests: parsed.numFailedTests || 0,
      };

      return {
        passed: summary.numFailedTests === 0,
        summary,
        raw_output: raw.slice(0, 5000),
      };
    }
    return { passed: false, raw_output: raw.slice(0, 5000) };
  } catch (err) {
    return { passed: false, raw_output: err.message };
  }
}

function runEvaluation() {
  const runId = crypto.randomUUID();
  const start = new Date();

  console.log("--- Running Evaluation ---");

  // 1. Evaluate Before (Expected to have failures in Security Checks)
  console.log("Testing Repository Before...");
  const before = runJestJson("tests/test_before.test.js");

  // 2. Evaluate After (Expected to PASS all)
  console.log("Testing Repository After...");
  const after = runJestJson("tests/test_after.test.js");

  const end = new Date();

  // Logic: Success if 'After' passes completely
  const comparison = { passed_gate: after.passed };
  const error = null;

  return {
    run_id: runId,
    started_at: start.toISOString(),
    finished_at: end.toISOString(),
    duration: (end - start) / 1000,
    environment: environmentInfo(),
    before: before || null,
    after: after || null,
    comparison,
    success: comparison.passed_gate,
    error,
  };
}

function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const report = runEvaluation();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-"); // HH-MM-SS
  const dirName = `${dateStr}/${timeStr}`;
  const reportDir = path.join(REPORTS_DIR, dirName);
  fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, "report.json");

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  return report.success ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}
