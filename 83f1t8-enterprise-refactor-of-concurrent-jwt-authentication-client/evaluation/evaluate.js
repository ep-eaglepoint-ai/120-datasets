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
          "",
          "Notes:",
          "  By default, this prints only a short summary (no huge Vitest JSON).",
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

async function getGitInfo(rootDir) {
  const commitRes = await execCapture("git", ["rev-parse", "--short", "HEAD"], {
    cwd: rootDir,
  });
  const branchRes = await execCapture(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: rootDir }
  );

  return {
    git_commit:
      (commitRes.code === 0 ? commitRes.stdout : "unknown").trim() || "unknown",
    git_branch:
      (branchRes.code === 0 ? branchRes.stdout : "unknown").trim() || "unknown",
  };
}

async function getEnvironment(rootDir) {
  const { git_commit, git_branch } = await getGitInfo(rootDir);
  return {
    node_version: process.version,
    platform: `${process.platform}-${process.arch}`,
    os: process.platform,
    architecture: process.arch,
    git_commit,
    git_branch,
    hostname: os.hostname(),
  };
}

function vitestBin(rootDir) {
  const binName = process.platform === "win32" ? "vitest.cmd" : "vitest";
  return path.join(rootDir, "node_modules", ".bin", binName);
}

function extractJsonObject(maybeMixedOutput) {
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

function summarizeVitestJson(jsonReport) {
  const testDetails = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  if (jsonReport && Array.isArray(jsonReport.testResults)) {
    for (const fileRes of jsonReport.testResults) {
      const fileName = fileRes.name ?? fileRes.file ?? "unknown";
      const assertions = Array.isArray(fileRes.assertionResults)
        ? fileRes.assertionResults
        : [];

      for (const a of assertions) {
        const status = a.status ?? a.state ?? "unknown";
        const elapsedMs = a.duration ?? a.durationMs ?? 0;

        let outcome = "unknown";
        if (status === "passed" || status === "pass") {
          outcome = "passed";
          passed++;
        } else if (status === "failed" || status === "fail") {
          outcome = "failed";
          failed++;
        } else if (
          status === "skipped" ||
          status === "pending" ||
          status === "todo"
        ) {
          outcome = "skipped";
          skipped++;
        }

        testDetails.push({
          name: a.fullName ?? a.title ?? a.name ?? "unknown",
          package: fileName,
          outcome,
          elapsed_seconds: typeof elapsedMs === "number" ? elapsedMs / 1000 : 0,
        });
      }
    }
  } else {
    const total =
      jsonReport?.numTotalTests ??
      jsonReport?.testCount ??
      jsonReport?.numTotalSuites ??
      0;

    passed = jsonReport?.numPassedTests ?? jsonReport?.passed ?? 0;
    failed = jsonReport?.numFailedTests ?? jsonReport?.failed ?? 0;
    skipped =
      jsonReport?.numPendingTests ??
      jsonReport?.numSkippedTests ??
      jsonReport?.skipped ??
      0;

    if (total && passed + failed + skipped === 0) {
      skipped = total;
    }
  }

  const total = passed + failed + skipped;
  return {
    tests: testDetails,
    metrics: { total, passed, failed, skipped },
  };
}

function printRunSummary(label, result) {
  const m = result.metrics;
  console.log(
    `${label}: exit=${result.exit_code}, passed=${m.passed}, failed=${m.failed}, skipped=${m.skipped}, total=${m.total}`
  );
}

async function runVitest(rootDir, targetRepo, label, { verbose }) {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${label}`);
  console.log("=".repeat(60));
  console.log(`Work Dir: ${rootDir}`);
  console.log(`TARGET_REPO: ${targetRepo}`);

  const bin = vitestBin(rootDir);
  const args = ["run", "tests/jwt-client-reliability.test.ts", "--reporter=json", "--no-color"];

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TARGET_REPO: targetRepo,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      const s = d.toString("utf8");
      stdout += s;
      if (verbose) process.stdout.write(s);
    });

    child.stderr.on("data", (d) => {
      const s = d.toString("utf8");
      stderr += s;
      if (verbose) process.stderr.write(s);
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;

      const json = extractJsonObject(stdout) ?? extractJsonObject(stderr);
      const summary = summarizeVitestJson(json);

      const combinedOut = (stdout + "\n" + stderr).trim();
      const maxLen = 10_000;
      const snippet =
        combinedOut.length > maxLen
          ? combinedOut.slice(combinedOut.length - maxLen)
          : combinedOut;

      const result = {
        success: exitCode === 0,
        exit_code: exitCode,
        tests: summary.tests,
        metrics: summary.metrics,
        stdout_snippet: snippet,
      };

      printRunSummary(label, result);
      resolve(result);
    });

    child.on("error", (err) => {
      const result = {
        success: false,
        exit_code: -1,
        tests: [],
        metrics: { total: 0, passed: 0, failed: 0, skipped: 0 },
        stdout_snippet: String(err),
      };

      printRunSummary(label, result);
      resolve(result);
    });
  });
}

function defaultOutputPath(rootDir, startedAt) {
  const dateStr = startedAt.toISOString().slice(0, 10);
  const timeStr = startedAt.toTimeString().slice(0, 8).replace(/:/g, "-");
  return path.join(
    rootDir,
    "evaluation",
    "reports",
    dateStr,
    timeStr,
    "report.json"
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = path.resolve(args.root);

  const run_id = generateRunID();
  const startedAt = new Date();

  console.log(`Evaluation Start | Run ID: ${run_id}`);

  const environment = await getEnvironment(rootDir);

  const before = await runVitest(
    rootDir,
    "before",
    "BEFORE (Legacy - Expected to Fail)",
    {
      verbose: args.verbose,
    }
  );

  const after = await runVitest(
    rootDir,
    "after",
    "AFTER (Refactored - Expected to Pass)",
    {
      verbose: args.verbose,
    }
  );

  const finishedAt = new Date();
  const duration_seconds = (finishedAt.getTime() - startedAt.getTime()) / 1000;

  const comparison = {
    before_total: before.metrics.total,
    after_total: after.metrics.total,
    before_passed: before.metrics.passed,
    after_passed: after.metrics.passed,
    regression_detected: after.metrics.failed > 0,
    improvement_detected: after.metrics.passed > before.metrics.passed,
  };

  const success =
    after.success && after.metrics.failed === 0 && after.metrics.total > 0;
  const error = success
    ? null
    : "Evaluation Failed: The refactored solution did not pass all tests.";

  const report = {
    run_id,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds,
    environment,
    before,
    after,
    comparison,
    success,
    error,
  };

  const outputPath = args.output
    ? path.resolve(args.output)
    : defaultOutputPath(rootDir, startedAt);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("\n" + "=".repeat(60));
  console.log("EVALUATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`Global Success: ${success}`);
  console.log(`Report saved to: ${outputPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal evaluator error:", err);
  process.exit(1);
});
