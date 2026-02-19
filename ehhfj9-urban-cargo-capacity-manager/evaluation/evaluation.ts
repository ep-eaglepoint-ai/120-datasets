#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

type Args = {
  root: string;
  output: string;
  verbose: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
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
          "  npm run evaluate -- [--root <projectRoot>] [--output <pathToReport.json>] [--verbose]",
          "",
          "Runs tests against repository_after and writes a JSON report.",
          "If repository_before contains an implementation, it will be evaluated too.",
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

function extractJsonObject(maybeMixedOutput: string) {
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

type VitestJson = {
  testResults?: Array<{
    assertionResults?: Array<{
      title?: string;
      fullName?: string;
      status?: string;
      duration?: number;
    }>;
  }>;
};

function summarizeResults(jsonReport: VitestJson | null) {
  const testDetails: Array<{
    name: string;
    outcome: string;
    elapsed_seconds: number;
  }> = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  if (jsonReport && Array.isArray(jsonReport.testResults)) {
    for (const suite of jsonReport.testResults) {
      const assertions = suite.assertionResults || [];
      for (const a of assertions) {
        const status = a.status || "unknown";
        if (status === "passed") passed++;
        else if (status === "failed") failed++;
        else skipped++;

        testDetails.push({
          name: a.fullName || a.title || "(unknown)",
          outcome: status,
          elapsed_seconds: (a.duration || 0) / 1000,
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

async function execCapture(
  cmd: string,
  cmdArgs: string[],
  cwd: string,
  verbose: boolean,
  env?: Record<string, string | undefined>
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...(env || {}) },
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
        resolve({ code: code ?? 0, stdout, stderr });
      });

      child.on("error", (err) => {
        resolve({ code: -1, stdout: "", stderr: String(err) });
      });
    }
  );
}

function repoHasCore(rootDir: string, repoName: string) {
  const candidates = [
    path.join(rootDir, repoName, "lib", "core.ts"),
    path.join(rootDir, repoName, "lib", "core.js"),
    path.join(rootDir, repoName, "lib", "core.mjs"),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

async function runTests(
  rootDir: string,
  label: string,
  verbose: boolean,
  options: { targetRepo: "repository_after" | "repository_before" }
) {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${label}`);
  console.log("=".repeat(60));

  const outputFile = path.join(
    os.tmpdir(),
    `ehhfj9-vitest-${options.targetRepo}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.json`
  );
  try {
    fs.rmSync(outputFile, { force: true });
  } catch {
    // ignore
  }

  const env = { TARGET_REPO: options.targetRepo };
  const res = await execCapture(
    "npx",
    ["vitest", "run", "--reporter=json", `--outputFile=${outputFile}`],
    rootDir,
    verbose,
    env
  );

  let json: VitestJson | null = null;
  try {
    if (fs.existsSync(outputFile)) {
      json = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    }
  } catch {
    json = null;
  }

  // Fallback: try to find JSON in mixed stdout if outputFile wasn't produced.
  if (!json) {
    json = extractJsonObject(res.stdout) as VitestJson | null;
  }

  const summary = summarizeResults(json);
  const merged = `${res.stdout}\n${res.stderr}`;

  return {
    success: res.code === 0,
    exit_code: res.code,
    tests: summary.tests,
    metrics: summary.metrics,
    stdout_snippet: merged.slice(-4000),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const rootDir = path.resolve(args.root);
  const run_id = generateRunID();
  const startedAt = new Date();

  const defaultOutputPath = path.join(
    rootDir,
    "evaluation",
    "reports",
    "report.json"
  );
  const outputPath = args.output
    ? path.resolve(args.output)
    : defaultOutputPath;

  let exitCode = 0;
  const environment = {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
  };

  const report: any = {
    run_id,
    started_at: startedAt.toISOString(),
    finished_at: null,
    duration_seconds: null,
    environment,
    before: null,
    after: null,
    comparison: null,
    success: false,
    error: null,
  };

  console.log(`Evaluation Start | Run ID: ${run_id}`);

  try {
    // Always generate Prisma client once before running vitest.
    await execCapture(
      "npm",
      ["run", "prisma:generate"],
      rootDir,
      args.verbose
    );

    const beforeExists = repoHasCore(rootDir, "repository_before");

    const before = beforeExists
      ? await runTests(rootDir, "BEFORE (Provided)", args.verbose, {
          targetRepo: "repository_before",
        })
      : {
          skipped: true,
          reason: "repository_before has no implementation to evaluate",
          success: false,
          exit_code: 0,
          tests: [],
          metrics: { total: 0, passed: 0, failed: 0, skipped: 0 },
          stdout_snippet: "",
        };

    const after = await runTests(
      rootDir,
      "AFTER (repository_after)",
      args.verbose,
      {
        targetRepo: "repository_after",
      }
    );

    report.before = before;
    report.after = after;
    report.comparison = {
      after_passed: after.metrics.passed,
      before_available: beforeExists,
      improvement_detected: beforeExists
        ? after.metrics.passed > (before as any).metrics.passed
        : null,
    };
    report.success = after.exit_code === 0;
    exitCode = after.exit_code;
  } catch (err) {
    exitCode = 1;
    report.success = false;
    report.error = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
    };
  } finally {
    const finishedAt = new Date();
    report.finished_at = finishedAt.toISOString();
    report.duration_seconds =
      (finishedAt.getTime() - startedAt.getTime()) / 1000;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`Report saved to ${outputPath}`);
  }

  process.exit(exitCode);
}

void main();
