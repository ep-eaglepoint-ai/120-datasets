#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

interface GitInfo {
  git_commit: string;
  git_branch: string;
}

interface EnvironmentInfo extends GitInfo {
  node_version: string;
  platform: string;
  os: string;
  os_release: string;
  architecture: string;
  hostname: string;
}

interface TestResult {
  nodeid: string;
  name: string;
  outcome: "passed" | "failed";
  message: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
}

interface RepositoryResults {
  success: boolean;
  exit_code: number;
  tests: TestResult[];
  summary: TestSummary;
  error?: string;
}

interface ComparisonResults {
  before_tests_passed: boolean;
  after_tests_passed: boolean;
  before_total: number;
  before_passed: number;
  before_failed: number;
  after_total: number;
  after_passed: number;
  after_failed: number;
}

interface EvaluationReport {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  success: boolean;
  error: string | null;
  environment: EnvironmentInfo;
  results: {
    before: RepositoryResults;
    after: RepositoryResults;
    comparison: ComparisonResults;
  };
}

function generateRunId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getGitInfo(): GitInfo {
  const gitInfo: GitInfo = { git_commit: "unknown", git_branch: "unknown" };
  try {
    gitInfo.git_commit = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .substring(0, 8);
  } catch (err) {}
  try {
    gitInfo.git_branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (err) {}
  return gitInfo;
}

function getEnvironmentInfo(): EnvironmentInfo {
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

function runTests(
  repositoryPath: string,
  repositoryName: string,
): RepositoryResults {
  console.log("\n" + "=".repeat(60));
  console.log(`RUNNING TESTS: ${repositoryName}`);
  console.log("=".repeat(60));

  const hasCode =
    fs.existsSync(path.join(repositoryPath, "src")) ||
    fs.existsSync(path.join(repositoryPath, "package.json"));

  if (!hasCode && repositoryName === "repository_before") {
    console.log(
      "Skipping repository_before as it contains no implementation code (CREATION mode).",
    );
    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 },
    };
  }

  try {
    const result = execSync(
      "npx jest --config tests/jest.config.js --json --no-coverage",
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_ENV: "test" },
      },
    );

    const jestOutput = JSON.parse(result);
    const testResults: TestResult[] = [];

    jestOutput.testResults.forEach((suite: any) => {
      suite.assertionResults.forEach((test: any) => {
        testResults.push({
          nodeid: `${repositoryName}::${test.ancestorTitles.join(" > ")} > ${test.title}`,
          name: test.title,
          outcome: test.status === "passed" ? "passed" : "failed",
          message: test.failureMessages?.join("\n") || test.title,
        });
      });
    });

    return {
      success: jestOutput.success,
      exit_code: jestOutput.success ? 0 : 1,
      tests: testResults,
      summary: {
        total: jestOutput.numTotalTests,
        passed: jestOutput.numPassedTests,
        failed: jestOutput.numFailedTests,
        errors: 0,
        skipped: 0,
      },
    };
  } catch (err: any) {
    if (err.stdout) {
      try {
        const jestOutput = JSON.parse(err.stdout);
        const testResults: TestResult[] = [];

        jestOutput.testResults.forEach((suite: any) => {
          suite.assertionResults.forEach((test: any) => {
            testResults.push({
              nodeid: `${repositoryName}::${test.ancestorTitles.join(" > ")} > ${test.title}`,
              name: test.title,
              outcome: test.status === "passed" ? "passed" : "failed",
              message: test.failureMessages?.join("\n") || test.title,
            });
          });
        });

        return {
          success: jestOutput.success,
          exit_code: jestOutput.success ? 0 : 1,
          tests: testResults,
          summary: {
            total: jestOutput.numTotalTests,
            passed: jestOutput.numPassedTests,
            failed: jestOutput.numFailedTests,
            errors: 0,
            skipped: 0,
          },
        };
      } catch {}
    }

    const errorMessage = err.message || String(err);
    console.error("\nERROR:", errorMessage);
    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0 },
      error: errorMessage,
    };
  }
}

function generateOutputPath(): string {
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
console.log("REGEX PLAYGROUND EVALUATION");
console.log("=".repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const beforeResults = runTests("repository_before", "repository_before");
const afterResults = runTests("repository_after", "repository_after");

const finishedAt = new Date();
const duration = (finishedAt.getTime() - startedAt.getTime()) / 1000;

const comparison: ComparisonResults = {
  before_tests_passed: beforeResults.success,
  after_tests_passed: afterResults.success,
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

const report: EvaluationReport = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(6)),
  success,
  error: errorMessage,
  environment: getEnvironmentInfo(),
  results: {
    before: beforeResults,
    after: afterResults,
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

process.exit(0);
