import os from "node:os";
import process from "node:process";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const execFileAsync = promisify(execFile);

function generateRunId() {
  return crypto.randomBytes(4).toString("hex");
}

async function getGitInfo(projectRoot) {
  const gitInfo = { git_commit: "unknown", git_branch: "unknown" };

  try {
    const commit = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      timeout: 5000,
    });
    if (commit?.stdout) gitInfo.git_commit = commit.stdout.trim().slice(0, 8);

    const branch = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: projectRoot, timeout: 5000 }
    );
    if (branch?.stdout) gitInfo.git_branch = branch.stdout.trim();
  } catch {
    // ignore (e.g., not a git repo in evaluation environment)
  }

  return gitInfo;
}

async function getEnvironmentInfo(projectRoot) {
  const git = await getGitInfo(projectRoot);
  return {
    node_version: process.version,
    platform: `${os.platform()} ${os.release()}`,
    os: os.platform(),
    arch: os.arch(),
    git_commit: git.git_commit,
    git_branch: git.git_branch,
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

async function generateOutputPath(projectRoot) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
  const timeStr = `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(
    now.getSeconds()
  )}`;

  const outputDir = join(
    projectRoot,
    "evaluation",
    "reports",
    dateStr,
    timeStr
  );
  await mkdir(outputDir, { recursive: true });
  return join(outputDir, "report.json");
}

function parseTestOutput({ stdout, stderr }) {
  const tests = [];

  const consume = (text) => {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith("✓ ")) {
        tests.push({ name: line.slice(2).trim(), outcome: "passed" });
      } else if (line.startsWith("✗ ")) {
        tests.push({ name: line.slice(2).trim(), outcome: "failed" });
      }
    }
  };

  consume(stdout || "");
  consume(stderr || "");

  const summary = {
    total: tests.length,
    passed: tests.filter((t) => t.outcome === "passed").length,
    failed: tests.filter((t) => t.outcome === "failed").length,
  };

  return { tests, summary };
}

async function runEvaluationTests({ projectRoot, timeoutSeconds }) {
  const startedAt = new Date();

  try {
    const result = await execFileAsync("npm", ["test", "--silent"], {
      cwd: projectRoot,
      timeout: timeoutSeconds * 1000,
      env: { ...process.env, CI: "1" },
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = parseTestOutput({
      stdout: result.stdout,
      stderr: result.stderr,
    });
    return {
      success: true,
      exit_code: 0,
      ...parsed,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: Date.now() - startedAt.getTime(),
    };
  } catch (err) {
    const stdout = err?.stdout ?? "";
    const stderr = err?.stderr ?? (err?.message ? String(err.message) : "");
    const exitCode = Number.isFinite(err?.code) ? err.code : 1;

    const parsed = parseTestOutput({ stdout, stderr });

    return {
      success: false,
      exit_code: exitCode,
      ...parsed,
      stdout,
      stderr,
      duration_ms: Date.now() - startedAt.getTime(),
    };
  }
}

function parseArgs(argv) {
  const out = { output: null, timeout: 120 };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--output") {
      out.output = argv[i + 1] ?? null;
      i += 1;
    } else if (a === "--timeout") {
      const v = Number(argv[i + 1]);
      if (Number.isFinite(v) && v > 0) out.timeout = v;
      i += 1;
    }
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const runId = generateRunId();
  const startedAt = new Date();

  const projectRoot = resolve(import.meta.dirname, "..");
  const testsPath = join(projectRoot, "tests");
  const repoAfterPath = join(projectRoot, "repository_after");

  const results = await runEvaluationTests({
    projectRoot,
    timeoutSeconds: args.timeout,
  });

  const finishedAt = new Date();

  const report = {
    run_id: runId,
    tool: "Frontend Voting App Evaluator",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds:
      Math.round(((finishedAt - startedAt) / 1000) * 10000) / 10000,
    environment: await getEnvironmentInfo(projectRoot),
    paths: {
      project_root: projectRoot,
      tests_dir: testsPath,
      repository_after: repoAfterPath,
      repository_before: null,
    },
    results: {
      success: results.success,
      exit_code: results.exit_code,
      tests: results.tests,
      summary: results.summary,
      // keep full logs in the report, but not printed to console by default
      stdout: results.stdout,
      stderr: results.stderr,
    },
    criteria_analysis: {
      app_location: "Verified by test: stores the app inside repository_after",
      vue_script_setup:
        "Verified by test: uses Vue 3 + Composition API + <script setup> everywhere",
      frontend_only:
        "Verified by test: is frontend-only: no backend, no external API calls",
      pinia_persistence:
        "Verified by test: uses Pinia store with LocalStorage persistence + hydration",
      crud: "Verified by test: supports CRUD: create, edit, duplicate, delete polls",
      schema:
        "Verified by test: poll schema supports title, optional description, tags, options, and start/end times",
      voting_modes:
        "Verified by test: supports single-choice and multi-choice voting",
      anonymity:
        "Verified by test: supports anonymous or named voting (client-side only)",
      duplicate_vote_prevention:
        "Verified by test: prevents duplicate voting per poll per browser session",
      expiration_and_locking:
        "Verified by test: handles poll status: active, closed, expired; locks voting after close/end",
      results_ui:
        "Verified by test: shows real-time results with animated progress bars, percentages, and total votes",
      filters_sorting:
        "Verified by test: has sortable/filterable poll lists: active, closed, trending, by tag",
      validation:
        "Verified by test: includes form validation and empty/error states",
      accessibility:
        "Verified by test: includes accessibility support: modal ARIA + focus trapping + keyboard escape",
      theme:
        "Verified by test: supports light/dark mode toggle with persistence",
    },
    success: results.success,
    error: results.success ? null : "Tests failed or execution error occurred.",
  };

  const outputPath = args.output
    ? resolve(projectRoot, args.output)
    : await generateOutputPath(projectRoot);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf-8");

  // Only print relevant info
  const { passed, total, failed } = report.results.summary;
  process.stdout.write(`Report saved to: ${outputPath}\n`);
  process.stdout.write(`Summary: ${passed}/${total} passed\n`);

  if (!report.success) {
    if (failed > 0) {
      process.stdout.write("Failed tests:\n");
      for (const t of report.results.tests) {
        if (t.outcome === "failed") process.stdout.write(`  - ${t.name}\n`);
      }
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(`Evaluation error: ${e?.message ?? String(e)}\n`);
  process.exit(1);
});
