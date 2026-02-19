#!/usr/bin/env node

import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    output: "",
    verbose: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--root" || token === "-r") {
      args.root = argv[i + 1] ?? args.root;
      i++;
      continue;
    }

    if (token === "--output" || token === "-o") {
      args.output = argv[i + 1] ?? "";
      i++;
      continue;
    }

    if (token === "--verbose" || token === "-v") {
      args.verbose = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      console.log(
        [
          "Usage:",
          "  node evaluation/evaluate.js [--root <projectRoot>] [--output <pathToReport.json>] [--verbose]",
          "",
          "Runs tests against repository_before and repository_after and writes a JSON report.",
        ].join("\n")
      );
      process.exit(0);
    }
  }

  return args;
}

function generateRunID() {
  return crypto.randomBytes(4).toString("hex");
}

async function execCapture(cmd, cmdArgs, { cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));

    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });

    child.on("error", (err) => {
      resolve({ code: -1, stdout: "", stderr: String(err) });
    });
  });
}

function extractJsonObject(maybeMixedOutput) {
  // Try to find the JSON blob in the output (since tests might print other stuff)
  const first = maybeMixedOutput.indexOf("{");
  const last = maybeMixedOutput.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = maybeMixedOutput.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

// Adapted to our custom runner's JSON output
function summarizeResults(jsonReport) {
  const testDetails = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Expecting shape { testResults: [ { assertionResults: [...] } ] }
  if (jsonReport && Array.isArray(jsonReport.testResults)) {
      for (const suite of jsonReport.testResults) {
          const assertions = suite.assertionResults || [];
          for (const a of assertions) {
              const status = a.status; // passed/failed
              if (status === 'passed') passed++;
              else if (status === 'failed') failed++;
              else skipped++;

              testDetails.push({
                  name: a.title,
                  outcome: status,
                  elapsed_seconds: (a.duration || 0) / 1000
              });
          }
      }
  }

  const total = passed + failed + skipped;
  return {
    tests: testDetails,
    metrics: { total, passed, failed, skipped },
  };
}

async function runTests(rootDir, targetRepo, label, { verbose }) {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${label}`);
  console.log("=".repeat(60));

  // Run the custom validation script depending on target
  // We use our 'tests/run_validation.js' which now supports --json and target arg.
  const scriptPath = path.join(rootDir, 'tests', 'run_validation.js');

  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, targetRepo, '--json'], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      const s = d.toString("utf8");
      stdout += s;
      // Don't print the JSON output even in verbose mode
    });

    child.stderr.on("data", (d) => {
      const s = d.toString("utf8");
      stderr += s;
      if (verbose) process.stderr.write(s);
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      const json = extractJsonObject(stdout);

      let summary;
      if (json) {
          summary = summarizeResults(json);
      } else {
          // Fallback if no JSON (e.g. wrapper error)
          summary = {
              tests: [],
              metrics: { total: 0, passed: 0, failed: 1, skipped: 0 }
          };
      }

      const result = {
        success: exitCode === 0 || summary.metrics.passed > 0, // Soften check? validation.js exits 0 if only passed.
        exit_code: exitCode,
        tests: summary.tests,
        metrics: summary.metrics,
        stdout_snippet: stdout.slice(-2000)
      };

      console.log(`${label}: passed=${summary.metrics.passed}, failed=${summary.metrics.failed}`);
      resolve(result);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = path.resolve(args.root);
  const run_id = generateRunID();
  const startedAt = new Date();

  console.log(`Evaluation Start | Run ID: ${run_id}`);

  // Environment info - simplified since git might not be here
  const environment = {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname()
  };

  // Run Before
  const before = await runTests(
    rootDir,
    "repository_before",
    "BEFORE (Legacy)",
    { verbose: args.verbose }
  );

  // Run After
  const after = await runTests(
      rootDir,
      "repository_after",
      "AFTER (Refactored)",
      { verbose: args.verbose }
  );

  const finishedAt = new Date();

  const report = {
      run_id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_seconds: (finishedAt.getTime() - startedAt.getTime()) / 1000,
      environment,
      before,
      after,
      comparison: {
          after_passed: after.metrics.passed,
          improvement_detected: after.metrics.passed > before.metrics.passed
      },
      success: after.metrics.failed === 0 && after.metrics.passed > 0
  };

  const outputPath = args.output || path.join(rootDir, 'evaluation', 'reports', 'report.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`Report saved to ${outputPath}`);
}

main().catch(console.error);
