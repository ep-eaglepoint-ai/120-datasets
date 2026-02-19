const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const os = require("os");

let didEnsureInstall = false;

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

function stripAnsi(text) {
  return String(text || "").replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}

function generateOutputPath(customPath) {
  if (customPath) return path.resolve(customPath);

  // Write under evaluation/reports so it is visible on host via volume mount.
  const evalDir = path.dirname(__filename);
  const outputDir = path.join(evalDir, "reports");
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, "report.json");
}

function getRepoRoot() {
  // evaluation/evaluation.js -> repo root
  return path.resolve(path.dirname(__filename), "..");
}

function getRepositoryAfterCwd() {
  return path.join(getRepoRoot(), "repository_after");
}

function ensureNpmInstall(cwd) {
  if (didEnsureInstall) return;

  const result = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    timeout: 180000,
    stdio: "pipe",
    cwd,
    env: { ...process.env, CI: "true" },
  });

  didEnsureInstall = result.status === 0;
}

function parseJestOutput(stdout, stderr) {
  const tests = [];
  const cleanOutput = stripAnsi((stdout || "") + "\n" + (stderr || ""));
  const lines = cleanOutput.split("\n");

  let currentSuite = "unknown";

  for (const line of lines) {
    const cleanLine = line.trim();

    if (cleanLine.startsWith("PASS ") || cleanLine.startsWith("FAIL ")) {
      const parts = cleanLine.split(/\s+/);
      if (parts.length > 1) currentSuite = parts[parts.length - 1];
    }

    const match = cleanLine.match(/^([✓✕\u2713\u2715])\s+(.+?)(?:\s+\(|$)/);
    if (match) {
      const symbol = match[1];
      const name = match[2];
      const outcome =
        symbol === "✓" || symbol === "\u2713" ? "passed" : "failed";
      tests.push({ suite: currentSuite, name, outcome });
    }
  }

  return tests;
}

function summarizeTests(tests, exitCode) {
  const passed = tests.filter((t) => t.outcome === "passed").length;
  const failed = tests.filter((t) => t.outcome === "failed").length;
  return {
    total: tests.length,
    passed,
    failed,
    errors: exitCode !== 0 && tests.length === 0 ? 1 : 0,
  };
}

function runCommand(label, command, args, cwd) {
  const startTime = Date.now();
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    timeout: 180000,
    stdio: "pipe",
    cwd,
    env: { ...process.env, CI: "true" },
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const tests = parseJestOutput(stdout, stderr);
  const summary = summarizeTests(tests, result.status);

  return {
    label,
    success: result.status === 0,
    exit_code: result.status,
    tests,
    summary,
    stdout,
    stderr,
    duration_ms: Date.now() - startTime,
    command: [command, ...args].join(" "),
  };
}

function hasDocker() {
  // Some evaluators run in environments without Docker.
  // In that case, fall back to running the suite directly on the host.
  const result = spawnSync("docker", ["version"], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 10_000,
  });
  return result.status === 0;
}

function runAuthSuite() {
  // Real Jest + RTL auth suite in repository_after against repository_before.
  if (process.env.INSIDE_DOCKER === "true") {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand("auth_suite", "npm", ["test"], cwd);
  }

  // If Docker is not available, run directly on the host.
  if (!hasDocker()) {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand("auth_suite", "npm", ["test"], cwd);
  }

  return runCommand(
    "auth_suite",
    "docker",
    ["compose", "run", "--rm", "js-tests"],
    process.cwd(),
  );
}

function runMetaSuite() {
  // Mutation-style meta suite under /tests.
  if (process.env.INSIDE_DOCKER === "true") {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand("meta_suite", "npm", ["run", "test:meta"], cwd);
  }

  // If Docker is not available, run directly on the host.
  if (!hasDocker()) {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand("meta_suite", "npm", ["run", "test:meta"], cwd);
  }

  return runCommand(
    "meta_suite",
    "docker",
    ["compose", "run", "--rm", "js-tests", "npm", "run", "test:meta"],
    process.cwd(),
  );
}

function runMetaSuiteBefore() {
  // Meta checks against repository_before (expected to fail with no tests).
  if (process.env.INSIDE_DOCKER === "true") {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand(
      "meta_suite_before",
      "npm",
      ["run", "test:meta:before"],
      cwd,
    );
  }

  // If Docker is not available, run directly on the host.
  if (!hasDocker()) {
    const cwd = getRepositoryAfterCwd();
    ensureNpmInstall(cwd);
    return runCommand(
      "meta_suite_before",
      "npm",
      ["run", "test:meta:before"],
      cwd,
    );
  }

  return runCommand(
    "meta_suite_before",
    "docker",
    ["compose", "run", "--rm", "js-tests", "npm", "run", "test:meta:before"],
    process.cwd(),
  );
}

function mapRequirements(authTests) {
  const check = (fragments) => {
    const list = Array.isArray(fragments) ? fragments : [fragments];
    const matching = authTests.filter((t) =>
      list.some((frag) =>
        t.name.toLowerCase().includes(String(frag).toLowerCase()),
      ),
    );
    if (matching.length === 0) return "Not Run";
    return matching.some((t) => t.outcome === "failed") ? "Fail" : "Pass";
  };

  return {
    concurrent_token_refresh_prevention: check(
      "token refresh is shared across concurrent requests",
    ),
    request_queue_retry_after_refresh: check(
      "401 triggers refresh and queues/retries",
    ),
    proactive_refresh_before_expiry: check(
      "proactive refresh occurs when <60 seconds",
    ),
    token_reuse_detection_family_revocation: check(
      "reusing a revoked refresh token invalidates",
    ),
    successful_login_updates_user_state: check(
      "successful login updates user state",
    ),
    failed_login_shows_error: check("failed login shows error"),
    logout_clears_tokens_and_user: check("logout clears tokens"),
    form_validation: check("form validation prevents submit"),
    unauthenticated_redirects_to_login: check(
      "unauthenticated users are shown the login form",
    ),
    authenticated_access_dashboard: check(
      "authenticated users can access dashboard",
    ),
    loginform_displays_demo_credentials: check(
      "login form displays demo credentials",
    ),
    dashboard_shows_user_info_and_logout: check(
      "dashboard shows user info and logout",
    ),
    error_messages_display_correctly: check("error messages display correctly"),
  };
}

function main() {
  const runId = generateRunId();
  const outputPath = generateOutputPath(process.env.EVAL_OUTPUT_PATH);

  console.log(
    `Starting JWT Authentication Test Suite Evaluation [Run ID: ${runId}]`,
  );

  const authRun = runAuthSuite();
  const metaBeforeRun = runMetaSuiteBefore();
  const metaRun = runMetaSuite();

  const report = {
    run_id: runId,
    tool: "JWT Authentication Evaluator",
    started_at: new Date().toISOString(),
    environment: getEnvironmentInfo(),
    runs: {
      auth_suite: authRun,
      meta_suite_before: metaBeforeRun,
      meta_suite: metaRun,
    },
    criteria_analysis: {
      requirements: mapRequirements(authRun.tests),
      meta_suite_passed: metaRun.success ? "Pass" : "Fail",
      meta_suite_before_expected_failure: metaBeforeRun.success
        ? "Unexpected Pass"
        : "Expected Fail",
    },
    comparison: {
      summary: "Containerized Jest + RTL authentication evaluation",
      success: authRun.success && metaRun.success,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("\n---------------------------------------------------");
  console.log(
    `Auth Suite  - Tests: ${authRun.summary.total}  Passed: ${authRun.summary.passed}  Failed: ${authRun.summary.failed}`,
  );
  console.log(
    `Meta Before - Exit:  ${metaBeforeRun.exit_code}  Success: ${metaBeforeRun.success}`,
  );
  console.log(
    `Meta Suite  - Exit:  ${metaRun.exit_code}  Success: ${metaRun.success}`,
  );
  console.log("---------------------------------------------------");
  console.log(`Report saved to: ${outputPath}`);

  if (!report.comparison.success) {
    process.exitCode = 1;
  }
}

main();
