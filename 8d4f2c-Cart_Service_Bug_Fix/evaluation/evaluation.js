#!/usr/bin/env node
/**
 * Evaluation runner for Cart Service Bug Fix.
 *
 * This evaluation script:
 * - Runs Jest tests on the tests/ folder for both before and after implementations
 * - Collects individual test results with pass/fail status
 * - Generates structured reports with environment metadata
 *
 * Run with:
 *     docker compose run --rm evaluation
 *     # or locally:
 *     node evaluation/evaluation.js [--output <path>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function generateRunId() {
  return crypto.randomBytes(4).toString('hex');
}

function getGitInfo() {
  const gitInfo = { git_commit: 'unknown', git_branch: 'unknown' };
  try {
    gitInfo.git_commit = execSync('git rev-parse HEAD 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim().slice(0, 8);
  } catch (e) {}
  try {
    gitInfo.git_branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch (e) {}
  return gitInfo;
}

function getEnvironmentInfo() {
  const gitInfo = getGitInfo();
  return {
    node_version: process.version,
    platform: process.platform,
    os: os.type(),
    os_release: os.release(),
    architecture: process.arch,
    hostname: os.hostname(),
    git_commit: gitInfo.git_commit,
    git_branch: gitInfo.git_branch,
  };
}

function parseJestOutput(output) {
  const tests = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines like: ✓ should throw error when adding... (123 ms)
    // or: ✕ should reject quantity of 0 (45 ms)
    // Handle both with and without timing
    if (trimmed.startsWith('✓')) {
      const name = trimmed.replace(/^✓\s+/, '').replace(/\s+\(\d+\s*m?s\)\s*$/, '').trim();
      tests.push({ name, outcome: 'passed' });
    } else if (trimmed.startsWith('✕')) {
      const name = trimmed.replace(/^✕\s+/, '').replace(/\s+\(\d+\s*m?s\)\s*$/, '').trim();
      tests.push({ name, outcome: 'failed' });
    } else if (trimmed.startsWith('○')) {
      const name = trimmed.replace(/^○\s+/, '').trim();
      tests.push({ name, outcome: 'skipped' });
    }
  }

  return tests;
}

function runJestTests(repoPath, testsDir, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RUNNING TESTS: ${label.toUpperCase()}`);
  console.log('='.repeat(60));

  const projectRoot = path.dirname(testsDir);
  const testFile = path.join(testsDir, 'cartService.test.js');

  // Determine repo name from path
  const repoName = path.basename(repoPath);

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = execSync(`npx jest "${testFile}" --forceExit --detectOpenHandles --no-coverage 2>&1`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'test', TEST_REPO: repoName },
      timeout: 120000,
    });
    stdout = result;
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    // When using 2>&1, output is in stdout
    if (err.output) {
      stdout = err.output.filter(Boolean).join('\n');
    }
  }

  // Parse from both stdout and stderr (Jest outputs to stderr on failures)
  const combinedOutput = stdout + '\n' + stderr;
  const tests = parseJestOutput(combinedOutput);
  const passed = tests.filter(t => t.outcome === 'passed').length;
  const failed = tests.filter(t => t.outcome === 'failed').length;
  const skipped = tests.filter(t => t.outcome === 'skipped').length;
  const total = tests.length;

  // Show only test results (no verbose errors)
  for (const test of tests) {
    const icon = test.outcome === 'passed' ? '✓' : '✕';
    console.log(`${icon} ${test.name}`);
  }

  console.log(`\nTests: ${failed > 0 ? `${failed} failed, ` : ''}${passed} passed, ${total} total`);

  return {
    success: exitCode === 0,
    exit_code: exitCode,
    tests,
    summary: { total, passed, failed, skipped },
    stdout: stdout.slice(-3000),
    stderr: stderr.slice(-1000),
  };
}

async function runEvaluation() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('CART SERVICE BUG FIX EVALUATION');
  console.log('='.repeat(60));

  const projectRoot = path.resolve(__dirname, '..');
  const testsDir = path.join(projectRoot, 'tests');
  const beforePath = path.join(projectRoot, 'repository_before');
  const afterPath = path.join(projectRoot, 'repository_after');

  // Run tests with BEFORE implementation
  const beforeResults = runJestTests(beforePath, testsDir, 'before');

  // Run tests with AFTER implementation
  const afterResults = runJestTests(afterPath, testsDir, 'after');

  const comparison = {
    before_tests_passed: beforeResults.success,
    after_tests_passed: afterResults.success,
    before_total: beforeResults.summary.total || 0,
    before_passed: beforeResults.summary.passed || 0,
    before_failed: beforeResults.summary.failed || 0,
    after_total: afterResults.summary.total || 0,
    after_passed: afterResults.summary.passed || 0,
    after_failed: afterResults.summary.failed || 0,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nBefore Implementation (repository_before):`);
  console.log(`  Overall: ${beforeResults.success ? 'PASSED' : 'FAILED'}`);
  console.log(`  Tests: ${comparison.before_passed}/${comparison.before_total} passed`);

  console.log(`\nAfter Implementation (repository_after):`);
  console.log(`  Overall: ${afterResults.success ? 'PASSED' : 'FAILED'}`);
  console.log(`  Tests: ${comparison.after_passed}/${comparison.after_total} passed`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('EXPECTED BEHAVIOR CHECK');
  console.log('='.repeat(60));

  if (afterResults.success) {
    console.log('[OK] After implementation: All tests passed (expected)');
  } else {
    console.log('[FAIL] After implementation: Some tests failed (unexpected - should pass all)');
  }

  if (comparison.before_failed > 0) {
    console.log(`[OK] Before implementation: ${comparison.before_failed} tests failed (expected for FAIL_TO_PASS tests)`);
  } else {
    console.log('[WARN] Before implementation: No tests failed (FAIL_TO_PASS tests should fail)');
  }

  return { before: beforeResults, after: afterResults, comparison };
}

function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

  const projectRoot = path.resolve(__dirname, '..');
  const outputDir = path.join(projectRoot, 'evaluation', 'reports', dateStr, timeStr);
  fs.mkdirSync(outputDir, { recursive: true });

  return path.join(outputDir, 'report.json');
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      break;
    }
  }

  const runId = generateRunId();
  const startedAt = new Date();

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt.toISOString()}`);

  let results = null;
  let success = false;
  let errorMessage = null;

  try {
    results = await runEvaluation();
    success = results.after.success;
    errorMessage = success ? null : 'After implementation tests failed';
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    console.error(err.stack);
    errorMessage = err.message;
  }

  const finishedAt = new Date();
  const duration = (finishedAt - startedAt) / 1000;

  const environment = getEnvironmentInfo();

  const report = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds: Math.round(duration * 1000000) / 1000000,
    success,
    error: errorMessage,
    environment,
    results,
  };

  if (!outputPath) {
    outputPath = generateOutputPath();
  }

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${outputPath}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('EVALUATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Success: ${success ? 'YES' : 'NO'}`);

  process.exit(success ? 0 : 1);
}

main();

