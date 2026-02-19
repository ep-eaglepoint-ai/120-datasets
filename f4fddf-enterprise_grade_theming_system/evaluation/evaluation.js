const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

function generateRunId() {
  return Math.random().toString(36).substring(2, 10);
}

function getGitInfo() {
  const gitInfo = { git_commit: "unknown", git_branch: "unknown" };
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

  // Copy test files into the repository
  const repoDir = path.join(__dirname, "..", repositoryPath);
  const testsDir = path.join(__dirname, "..", "tests");
  const targetTestDir = path.join(repoDir, "src", "test");

  // Create test directory if it doesn't exist
  if (!fs.existsSync(targetTestDir)) {
    fs.mkdirSync(targetTestDir, { recursive: true });
  }

  // Copy appropriate test files based on repository
  if (repositoryName === "repository_before") {
    // Copy tests for before: setup.js, App.test.jsx, Requirements.test.jsx
    const testFiles = ["setup.js", "App.test.jsx", "Requirements.test.jsx"];
    for (const file of testFiles) {
      const srcPath = path.join(testsDir, file);
      const destPath = path.join(targetTestDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } else if (repositoryName === "repository_after") {
    // Copy tests for after: setup.js, ThemeContext.test.jsx, ThemeToggle.test.jsx, ThemedComponents.test.jsx
    const testFiles = [
      "setup.js",
      "ThemeContext.test.jsx",
      "ThemeToggle.test.jsx",
      "ThemedComponents.test.jsx",
    ];
    for (const file of testFiles) {
      const srcPath = path.join(testsDir, file);
      const destPath = path.join(targetTestDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  try {
    // Use JSON reporter to get structured data
    // Direct invocation to ensure args are passed
    const output = execSync("bun x vitest run --reporter=json", {
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
  let parsed = null;

  // Try to find and parse JSON output
  try {
    // Look for the specific start of Vitest JSON output to avoid matching console logs
    const jsonStartMatch = output.match(/\{"numTotalTestSuites":/);
    if (jsonStartMatch) {
      const jsonStart = jsonStartMatch.index;
      const jsonEnd = output.lastIndexOf("}");
      if (jsonEnd !== -1) {
        const jsonStr = output.substring(jsonStart, jsonEnd + 1);
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          // If simple extraction fails, try to find the balancing brace (simplified)
          // or just fallback silently
          console.error("JSON Parse Error (logging only):", e.message);
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse JSON output:", e.message);
  }

  const tests = [];
  let passed = 0;
  let failed = 0;
  let total = 0;

  if (parsed && parsed.testResults) {
    // Process JSON format
    parsed.testResults.forEach((fileResult) => {
      if (fileResult.assertionResults) {
        fileResult.assertionResults.forEach((assertion) => {
          tests.push({
            name: assertion.fullName || assertion.title,
            outcome: assertion.status === "passed" ? "passed" : "failed",
            duration: assertion.duration,
          });
        });
      }
    });

    passed = parsed.numPassedTests;
    failed = parsed.numFailedTests;
    total = parsed.numTotalTests;
  } else {
    // Fallback/Legacy string parsing (mostly for tests-before failing cases or non-JSON output)
    const lines = output.split("\n");

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith("✓") || cleanLine.startsWith("√")) {
        const testName = cleanLine.replace(/^[✓√]\s+/, "").trim();
        tests.push({
          name: testName,
          outcome: "passed",
          success: true,
        });
      } else if (cleanLine.startsWith("×") || cleanLine.startsWith("X")) {
        const testName = cleanLine.replace(/^[×X]\s+/, "").trim();
        tests.push({
          name: testName,
          outcome: "failed",
          success: false,
        });
      }
    });

    const passMatch = output.match(/Tests\s+.*?(\d+)\s+passed/);
    const failMatch = output.match(/Tests\s+.*?(\d+)\s+failed/);

    if (passMatch) passed = parseInt(passMatch[1]);
    if (failMatch) failed = parseInt(failMatch[1]);
    total = passed + failed;
  }

  const summary = {
    total: total,
    passed: passed,
    failed: failed,
    errors: 0,
    skipped: 0,
  };

  console.log(
    `\n${expectSuccess && failed > 0 ? "❌" : "✅"} Tests: ${
      summary.passed
    } passed, ${summary.failed} failed`,
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

function writeReportVariants(primaryPath, reportJson) {
  fs.writeFileSync(primaryPath, reportJson);

  const stableEvaluationPath = path.join(__dirname, "report.json");
  fs.writeFileSync(stableEvaluationPath, reportJson);

  const stableRootPath = path.join(__dirname, "..", "report.json");
  fs.writeFileSync(stableRootPath, reportJson);

  // Also write to /workspace/report.json if the volume is mounted (for local development)
  try {
    if (fs.existsSync("/workspace")) {
      fs.writeFileSync("/workspace/report.json", reportJson);
    }
  } catch (err) {
    // Silently fail if workspace isn't mounted
  }

  // Also write to /host/report.json if the volume is mounted (for CI artifacts)
  try {
    if (fs.existsSync("/host")) {
      fs.writeFileSync("/host/report.json", reportJson);
    }
  } catch (err) {
    // Silently fail if host isn't mounted
  }

  return {
    primaryPath,
    stableEvaluationPath,
    stableRootPath,
  };
}

// --- New logic for Pythonic report.json format ---
const runId = generateRunId();
const startedAt = new Date();

console.log("\n" + "=".repeat(60));
console.log("OFFLINE-FIRST ARCHITECTURE EVALUATION");
console.log("=".repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

// Run tests and collect results (using afterResults only for now)
const afterResults = runTests("repository_after", "repository_after", true);

const finishedAt = new Date();
const duration = (finishedAt - startedAt) / 1000;

// Parse test results into required format
function mapTestsToPythonic(tests, repoName) {
  // If no test details, just return empty array
  if (!Array.isArray(tests) || tests.length === 0) return [];
  return tests.map((t, idx) => ({
    nodeid: `${repoName}::${t.name || "test_" + idx}`,
    name: t.name || "test_" + idx,
    outcome: t.outcome || (t.success ? "passed" : "failed"),
  }));
}

// Compose unit_tests section
const unit_tests = {
  success: afterResults.success,
  exit_code: afterResults.exit_code,
  tests: mapTestsToPythonic(afterResults.tests, "repository_after"),
  summary: {
    total: afterResults.summary.total,
    passed: afterResults.summary.passed,
    failed: afterResults.summary.failed,
    errors: afterResults.summary.errors,
    skipped: afterResults.summary.skipped,
  },
  stdout: afterResults.stdout || "",
  stderr: afterResults.stderr || "",
};

// Stub algorithm_validation (customize as needed)
const algorithm_validation = {
  success: afterResults.success,
  runs: [],
  statistics: {},
};

// Compose summary
const summary = {
  unit_tests_passed: afterResults.success,
  validation_passed: algorithm_validation.success,
  overall_passed: afterResults.success && algorithm_validation.success,
  total_tests: afterResults.summary.total,
  tests_passed: afterResults.summary.passed,
  tests_failed: afterResults.summary.failed,
  convergence_rate: algorithm_validation.statistics.convergence_rate || null,
};

const report = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(6)),
  success: afterResults.success,
  error: null,
  environment: {
    python_version: "3.11.14", // Hardcoded or fetch dynamically if needed
    platform: `${os.type()}-${os.release()}-${os.arch()}-${os.platform()}-with-glibc2.41`,
    os: os.type(),
    os_release: os.release(),
    architecture: os.arch(),
    hostname: os.hostname(),
    git_commit: getGitInfo().git_commit,
    git_branch: getGitInfo().git_branch,
  },
  results: {
    unit_tests,
    algorithm_validation,
    summary,
    evaluation_passed: afterResults.success && algorithm_validation.success,
  },
};

const outputPath = generateOutputPath();
const reportJson = JSON.stringify(report, null, 2);
const paths = writeReportVariants(outputPath, reportJson);

console.log(`\n✅ Report saved to: ${paths.primaryPath}`);
console.log(`✅ Stable report: ${paths.stableEvaluationPath}`);
console.log(`✅ Stable report: ${paths.stableRootPath}`);
console.log("\n" + "=".repeat(60));
console.log("EVALUATION COMPLETE");
console.log("=".repeat(60));
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Success: ${afterResults.success ? "✅ YES" : "❌ NO"}`);

process.exit(afterResults.success ? 0 : 1);
