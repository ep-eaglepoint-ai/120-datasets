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
    gitInfo.git_commit = execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim().substring(0, 8);
  } catch (err) {}
  try {
    gitInfo.git_branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (err) {}
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

function runTests(repositoryPath, repositoryName, useComprehensive = false) {
  console.log('\n' + '='.repeat(60));
  console.log(`RUNNING TESTS: ${repositoryName} ${useComprehensive ? '(Comprehensive Requirement Validation)' : '(Standard Suite)'}`);
  console.log('='.repeat(60));

  try {
    const testModule = '../tests/ComprehensiveSuite.js';
    const ValidatorClass = require(testModule);
    const validator = new ValidatorClass(`./${repositoryPath}`);
    validator.loadFiles();
    const testResults = validator.runAll();
    const summary = validator.printResults();

    return {
      success: summary.success,
      exit_code: summary.success ? 0 : 1,
      tests: testResults.map((r, idx) => ({
        nodeid: `${repositoryName}::test_${idx + 1}`,
        name: r.name,
        outcome: r.passed ? 'passed' : 'failed',
        message: r.message,
        requirement: r.requirementNum || null,
      })),
      summary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.total - summary.passed,
        errors: 0,
        skipped: 0,
      },
    };
  } catch (err) {
    console.error('\nERROR:', err.message);
    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0 },
      error: err.message,
    };
  }
}

function generateOutputPath() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const outputDir = path.join(__dirname, dateStr, timeStr);
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, 'report.json');
}

// Parse command line arguments
const args = process.argv.slice(2);
const useComprehensive = args.includes('--comprehensive') || args.includes('-c');

const runId = generateRunId();
const startedAt = new Date();

console.log('\n' + '='.repeat(60));
console.log('SONG CONTROLLER REFACTOR EVALUATION');
console.log(useComprehensive ? 'Using Comprehensive Requirement Validation Suite (34 tests)' : 'Using Standard Test Suite (16 tests)');
console.log('='.repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const beforeResults = runTests('repository_before', 'repository_before', useComprehensive);
const afterResults = runTests('repository_after', 'repository_after', useComprehensive);

const finishedAt = new Date();
const duration = (finishedAt - startedAt) / 1000;

const comparison = {
  before_tests_passed: beforeResults.success,
  after_tests_passed: afterResults.success,
  before_total: beforeResults.summary.total,
  before_passed: beforeResults.summary.passed,
  before_failed: beforeResults.summary.failed,
  after_total: afterResults.summary.total,
  after_passed: afterResults.summary.passed,
  after_failed: afterResults.summary.failed,
  improvement_count: afterResults.summary.passed - beforeResults.summary.passed,
  improvement_percentage: beforeResults.summary.total > 0 
    ? ((afterResults.summary.passed - beforeResults.summary.passed) / beforeResults.summary.total * 100).toFixed(1)
    : 0,
};

console.log('\n' + '='.repeat(60));
console.log('EVALUATION SUMMARY');
console.log('='.repeat(60));
console.log(`\nBefore Implementation (repository_before):`);
console.log(`  Overall: ${beforeResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.before_passed}/${comparison.before_total} passed (${((comparison.before_passed/comparison.before_total)*100).toFixed(1)}%)`);
console.log(`\nAfter Implementation (repository_after):`);
console.log(`  Overall: ${afterResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.after_passed}/${comparison.after_total} passed (${((comparison.after_passed/comparison.after_total)*100).toFixed(1)}%)`);
console.log(`\n📈 Improvement: +${comparison.improvement_count} tests passing (+${comparison.improvement_percentage}%)`);

const success = afterResults.success;
const errorMessage = success ? null : 'After implementation tests failed';

const report = {
  run_id: runId,
  test_suite: useComprehensive ? 'comprehensive' : 'standard',
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
console.log('\n' + '='.repeat(60));
console.log('EVALUATION COMPLETE');
console.log('='.repeat(60));
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Success: ${success ? '✅ YES' : '❌ NO'}`);
console.log(`\nTo run comprehensive validation: npm run evaluate:comprehensive`);

process.exit(success ? 0 : 1);
