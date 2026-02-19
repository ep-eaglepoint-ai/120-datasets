#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function generateRunId() {
  return Math.random().toString(36).substring(2, 10);
}

function getGitInfo() {
  const gitInfo = { git_commit: 'unknown', git_branch: 'unknown' };
  try {
    gitInfo.git_commit = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .substring(0, 8);
  } catch {}
  try {
    gitInfo.git_branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {}
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

function runMetaTestsForRepo(repoName) {
  const cwd = process.cwd();
  const jestConfigPath = path.join('repository_after', 'jest.config.js');
  const metaTestPath = 'tests/meta-requirements.test.ts';
  const env = { ...process.env, NODE_ENV: 'test', REPO_PATH: repoName === 'before' ? 'repository_before' : 'repository_after' };
  const cmd = `npx jest --config ${jestConfigPath} --runInBand ${metaTestPath} --json --no-coverage || true`;

  let stdout = '';
  let stderr = '';
  try {
    stdout = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env });
  } catch (err) {
    stdout = err.stdout?.toString?.() ?? '';
    stderr = err.stderr?.toString?.() ?? '';
  }

  try {
    const jestOutput = JSON.parse(stdout);
    const tests = [];
    jestOutput.testResults.forEach((suite) => {
      suite.assertionResults.forEach((test) => {
        tests.push({
          nodeid: `${repoName}::${test.ancestorTitles.join(' > ')} > ${test.title}`,
          name: test.title,
          outcome: test.status === 'passed' ? 'passed' : 'failed',
        });
      });
    });

    const success = jestOutput.success;
    const exitCode = success ? 0 : 1;

    return {
      success,
      exit_code: exitCode,
      tests,
      summary: {
        total: jestOutput.numTotalTests,
        passed: jestOutput.numPassedTests,
        failed: jestOutput.numFailedTests,
        errors: 0,
        skipped: 0,
      },
      stdout: jestOutput.stdout ?? '',
      stderr: jestOutput.stderr ?? '',
      error: success ? undefined : 'Meta tests reported failures',
    };
  } catch {
    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0 },
      stdout,
      stderr,
      error: stderr || 'Could not parse Jest output',
    };
  }
}

function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  const outputDir = path.join(process.cwd(), 'evaluation', dateStr, timeStr);
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, 'report.json');
}

const runId = generateRunId();
const startedAt = new Date();

console.log('\n' + '='.repeat(60));
console.log('PAYMENT PROCESSING MODULE EVALUATION (TypeScript)');
console.log('='.repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const beforeResults = runMetaTestsForRepo('before');
const afterResults = runMetaTestsForRepo('after');

const finishedAt = new Date();
const duration = (finishedAt.getTime() - startedAt.getTime()) / 1000;

const comparison = {
  before_tests_passed: beforeResults.success,
  after_tests_passed: afterResults.success,
  before_total: beforeResults.summary.total,
  before_passed: beforeResults.summary.passed,
  before_failed: beforeResults.summary.failed,
  after_total: afterResults.summary.total,
  after_passed: afterResults.summary.passed,
  after_failed: afterResults.summary.failed,
};

console.log('\n' + '='.repeat(60));
console.log('EVALUATION SUMMARY');
console.log('='.repeat(60));
console.log('\nRepository BEFORE (repository_before):');
console.log(`  Overall: ${beforeResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.before_passed}/${comparison.before_total} passed`);
console.log('\nRepository AFTER (repository_after):');
console.log(`  Overall: ${afterResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.after_passed}/${comparison.after_total} passed`);

const overallSuccess = !beforeResults.success && afterResults.success;
const errorMessage = overallSuccess
  ? null
  : 'Expected repository_before to fail (no tests) and repository_after to pass';

const report = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(6)),
  success: overallSuccess,
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
console.log('\n' + '='.repeat(60));
console.log('EVALUATION COMPLETE');
console.log('='.repeat(60));
console.log(`Duration: ${duration.toFixed(3)}s`);
console.log(`Success: ${overallSuccess ? '✅ YES' : '❌ NO'}`);

