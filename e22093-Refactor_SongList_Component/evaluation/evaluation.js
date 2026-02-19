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

function runTests(repositoryPath, repositoryName) {
  console.log('\n' + '='.repeat(60));
  console.log(`RUNNING TESTS: ${repositoryName}`);
  console.log('='.repeat(60));

  try {
    const testCommand = repositoryName === 'repository_before' ? 'npm run test-before' : 'npm run test-after';
    const output = execSync(testCommand, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' }
    });

    const lines = output.split('\n');
    const tests = [];
    let passed = 0;
    let failed = 0;
    let total = 0;

    // Parse Jest output for test results
    lines.forEach(line => {
      if (line.includes('✓') || line.includes('PASS')) {
        const testMatch = line.match(/✓\s+(.+)/);
        if (testMatch) {
          tests.push({
            nodeid: `${repositoryName}::${testMatch[1]}`,
            name: testMatch[1],
            outcome: 'passed',
            message: 'Test passed',
          });
          passed++;
        }
      } else if (line.includes('✕') || line.includes('FAIL')) {
        const testMatch = line.match(/✕\s+(.+)/);
        if (testMatch) {
          tests.push({
            nodeid: `${repositoryName}::${testMatch[1]}`,
            name: testMatch[1],
            outcome: 'failed',
            message: 'Test failed',
          });
          failed++;
        }
      }
    });

    // Extract summary from Jest output
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/) ||
                        output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    
    if (summaryMatch) {
      if (summaryMatch.length === 4) {
        failed = parseInt(summaryMatch[1]);
        passed = parseInt(summaryMatch[2]);
        total = parseInt(summaryMatch[3]);
      } else {
        passed = parseInt(summaryMatch[1]);
        total = parseInt(summaryMatch[2]);
        failed = total - passed;
      }
    } else {
      total = passed + failed;
    }

    const summary = {
      total: total,
      passed: passed,
      failed: failed,
      errors: 0,
      skipped: 0,
    };

    console.log(`\n${passed > 0 ? '✅' : '❌'} Tests: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);

    return {
      success: failed === 0,
      exit_code: failed === 0 ? 0 : 1,
      tests,
      summary,
    };
  } catch (err) {
    console.error('\nERROR:', err.message);
    
    // Parse failed test output
    const output = err.stdout || err.message;
    const lines = output.split('\n');
    let failed = 0;
    let passed = 0;
    let total = 0;
    
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/) ||
                        output.match(/Test Suites:\s+(\d+)\s+failed/);
    
    if (summaryMatch) {
      if (summaryMatch.length === 4) {
        failed = parseInt(summaryMatch[1]);
        passed = parseInt(summaryMatch[2]);
        total = parseInt(summaryMatch[3]);
      } else {
        // Extract from error output
        const failedMatch = output.match(/(\d+)\s+failed/);
        const passedMatch = output.match(/(\d+)\s+passed/);
        const totalMatch = output.match(/(\d+)\s+total/);
        
        failed = failedMatch ? parseInt(failedMatch[1]) : 0;
        passed = passedMatch ? parseInt(passedMatch[1]) : 0;
        total = totalMatch ? parseInt(totalMatch[1]) : failed + passed;
      }
    }

    return {
      success: false,
      exit_code: 1,
      tests: [],
      summary: { total: total, passed: passed, failed: failed, errors: 0, skipped: 0 },
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

const runId = generateRunId();
const startedAt = new Date();

console.log('\n' + '='.repeat(60));
console.log('SONGLIST COMPONENT REFACTOR EVALUATION');
console.log('='.repeat(60));
console.log(`Run ID: ${runId}`);
console.log(`Started at: ${startedAt.toISOString()}`);

const beforeResults = runTests('repository_before', 'repository_before');
const afterResults = runTests('repository_after', 'repository_after');

const finishedAt = new Date();
const duration = (finishedAt - startedAt) / 1000;

const comparison = {
  before_tests_passed: beforeResults.success,
  before_total: beforeResults.summary.total,
  before_passed: beforeResults.summary.passed,
  before_failed: beforeResults.summary.failed,
  after_tests_passed: afterResults.success,
  after_total: afterResults.summary.total,
  after_passed: afterResults.summary.passed,
  after_failed: afterResults.summary.failed,
  improvement: afterResults.summary.passed - beforeResults.summary.passed,
  improvement_percentage: beforeResults.summary.total > 0 ? 
    Math.round(((afterResults.summary.passed - beforeResults.summary.passed) / beforeResults.summary.total) * 100) : 0
};

console.log('\n' + '='.repeat(60));
console.log('EVALUATION SUMMARY');
console.log('='.repeat(60));
console.log(`\nBefore Implementation (repository_before):`);
console.log(`  Overall: ${beforeResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.before_passed}/${comparison.before_total} passed (${Math.round((comparison.before_passed/comparison.before_total)*100)}%)`);
console.log(`\nAfter Implementation (repository_after):`);
console.log(`  Overall: ${afterResults.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`  Tests: ${comparison.after_passed}/${comparison.after_total} passed (${Math.round((comparison.after_passed/comparison.after_total)*100)}%)`);
console.log(`\nImprovement:`);
console.log(`  Additional tests passing: +${comparison.improvement}`);
console.log(`  Improvement percentage: +${comparison.improvement_percentage}%`);

const success = afterResults.success && (comparison.improvement > 0 || comparison.after_passed === comparison.after_total);
const errorMessage = success ? null : 'Implementation did not meet success criteria';

const report = {
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
console.log('\n' + '='.repeat(60));
console.log('EVALUATION COMPLETE');
console.log('='.repeat(60));
console.log(`Duration: ${duration.toFixed(2)}s`);
console.log(`Success: ${success ? '✅ YES' : '❌ NO'}`);

process.exit(success ? 0 : 1);
