const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");

// --- Helper Functions ---

function generateRunId() {
  return crypto.randomBytes(4).toString("hex");
}

function getEnvironmentInfo() {
  return {
    node_version: process.version,
    platform: os.platform(),
    os_type: os.type(),
    execution_mode: process.env.INSIDE_DOCKER
      ? "Inside Docker Container"
      : "Host Machine",
  };
}

function generateOutputPath(projectRoot, customPath) {
  if (customPath) return path.resolve(customPath);

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  // Ensure we write to the evaluation folder relative to this script
  // This ensures reports appear on your host machine via the volume mount
  const evalDir = path.dirname(__filename);
  const outputDir = path.join(evalDir, "reports", dateStr, timeStr);

  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, "report.json");
}

function parseJestOutput(stdout, stderr) {
  const tests = [];
  // Remove ANSI color codes for easier parsing
  const cleanOutput = (stdout + "\n" + stderr).replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
  const lines = cleanOutput.split("\n");

  let currentSuite = "unknown";

  lines.forEach((line) => {
    const cleanLine = line.trim();

    if (cleanLine.includes("PASS") || cleanLine.includes("FAIL")) {
      const parts = cleanLine.split(" ");
      if (parts.length > 1) currentSuite = parts[parts.length - 1];
    }

    // Match Jest checkmarks (✓) or crosses (✕)
    const match = cleanLine.match(/^(\u2713|\u2715|✓|✕)\s+(.+?)(?:\s+\(|$)/);

    if (match) {
      const symbol = match[1];
      const name = match[2];
      const outcome =
        symbol === "✓" || symbol === "\u2713" ? "passed" : "failed";

      tests.push({
        suite: currentSuite,
        name: name,
        outcome: outcome,
      });
    }
  });

  return tests;
}

function runEvaluationTests() {
  console.log("🚀 Starting Integration Tests...");

  let command, args;

  // LOGIC SWITCH:
  // If INSIDE_DOCKER env var is true, we run npm test directly.
  // If false, we run docker compose.
  if (process.env.INSIDE_DOCKER === "true") {
    console.log("   (Running inside container: executing 'npm test')");
    command = "npm";
    args = ["test"];
  } else {
    console.log("   (Running on host: executing 'docker compose')");
    command = "docker";
    args = ["compose", "run", "--rm", "test-runner"];
  }

  const startTime = Date.now();

  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
      timeout: 120000,
      stdio: "pipe",
      env: { ...process.env, CI: "true" }, // Force non-interactive mode
    });

    const output = result.stdout || "";
    const errorOutput = result.stderr || "";

    const tests = parseJestOutput(output, errorOutput);

    const summary = {
      total: tests.length,
      passed: tests.filter((t) => t.outcome === "passed").length,
      failed: tests.filter((t) => t.outcome === "failed").length,
      errors: result.status !== 0 && tests.length === 0 ? 1 : 0,
    };

    return {
      success:
        result.status === 0 || (summary.passed > 0 && summary.failed === 0),
      exit_code: result.status,
      tests: tests,
      summary: summary,
      stdout: output,
      stderr: errorOutput,
      duration_ms: Date.now() - startTime,
    };
  } catch (e) {
    return {
      success: false,
      exit_code: -1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 1 },
      stdout: "",
      stderr: e.message,
    };
  }
}

function mapCriteria(tests) {
  const check = (nameFragments) => {
    if (!Array.isArray(nameFragments)) nameFragments = [nameFragments];
    const matchingTests = tests.filter((t) =>
      nameFragments.some((frag) =>
        t.name.toLowerCase().includes(frag.toLowerCase())
      )
    );
    if (matchingTests.length === 0) return "Not Run";
    const hasFailure = matchingTests.some((t) => t.outcome === "failed");
    return hasFailure ? "Fail" : "Pass";
  };

  return {
    jwt_flow: check(["returns 200 and token", "full login"]),
    access_token_payload: check(["returns 200 and token"]),
    refresh_cookie: check(["set-cookie", "clears cookie"]),
    refresh_tracking: check(["revokes token in DB"]),
    invalidation: check(["revokes token", "invalidation"]),
    hashing: check(["bad password"]),
    login_form: check(["performs full login"]),
    client_validation: check(["validation", "bad password"]),
    memory_storage: check(["full login"]),
    auto_logout: check(["logout", "clears cookie"]),
  };
}

function main() {
  const runId = generateRunId();
  const projectRoot = process.cwd(); // This will be /app/tests inside Docker

  console.log(`Starting JWT Auth Evaluation [Run ID: ${runId}]`);

  const results = runEvaluationTests();
  const criteriaAnalysis = mapCriteria(results.tests);

  const report = {
    run_id: runId,
    tool: "JWT Auth Evaluator",
    started_at: new Date().toISOString(),
    environment: getEnvironmentInfo(),
    before: null,
    after: results,
    criteria_analysis: criteriaAnalysis,
    comparison: {
      summary: "Containerized Evaluation",
      success: results.success,
    },
  };

  const outputPath = generateOutputPath(projectRoot);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("\n---------------------------------------------------");
  console.log(`Tests Run: ${results.summary.total}`);
  console.log(`Passed:    ${results.summary.passed}`);
  console.log(`Failed:    ${results.summary.failed}`);
  console.log("---------------------------------------------------");
  console.log(`✅ Report saved to: ${outputPath}`);
}

main();
