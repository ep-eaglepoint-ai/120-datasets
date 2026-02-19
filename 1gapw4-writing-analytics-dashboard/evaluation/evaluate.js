#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const TASK_TITLE = '1GAPW4 - Writing Analytics Dashboard';

function runCommand(cmd, args = [], cwd = process.cwd()) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr, output: stdout + stderr });
    });
  });
}

function parseJestOutput(output) {
  const results = {
    passed: 0,
    failed: 0,
    errors: 0,
    skipped: 0,
    tests: []
  };

  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('Tests:')) {
      const passedMatch = line.match(/(\d+)\s+passed/);
      const failedMatch = line.match(/(\d+)\s+failed/);
      if (passedMatch) results.passed = parseInt(passedMatch[1]);
      if (failedMatch) results.failed = parseInt(failedMatch[1]);
    }

    if (line.includes('PASS') && line.includes('.test.')) {
      const testMatch = line.match(/PASS\s+(.+\.test\.[jt]sx?)/);
      if (testMatch) {
        results.tests.push({ name: testMatch[1], status: 'passed' });
      }
    } else if (line.includes('FAIL') && line.includes('.test.')) {
      const testMatch = line.match(/FAIL\s+(.+\.test\.[jt]sx?)/);
      if (testMatch) {
        results.tests.push({ name: testMatch[1], status: 'failed' });
      }
    }
  }

  return results;
}

async function main() {
  const runId = randomUUID();
  const startTime = new Date();

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startTime.toISOString()}`);
  console.log();
  console.log('='.repeat(60));
  console.log(`${TASK_TITLE} EVALUATION`);
  console.log('='.repeat(60));
  console.log();

  console.log('='.repeat(60));
  console.log('RUNNING TESTS (REPOSITORY_AFTER)');
  console.log('='.repeat(60));
  console.log('Environment: repository_after');
  console.log('Tests directory: /app/tests');
  console.log();

  // Run ALL tests in the tests directory
  const testResult = await runCommand('npm', ['test'], path.join(__dirname, '..', 'repository_after'));
  const testResults = parseJestOutput(testResult.output);

  const totalTests = testResults.passed + testResults.failed + testResults.errors + testResults.skipped;

  console.log();
  console.log(`Results: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.errors} errors, ${testResults.skipped} skipped (total: ${totalTests})`);

  for (const test of testResults.tests) {
    const statusSymbol = test.status === 'passed' ? '✓' : '✗';
    const statusText = test.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${statusSymbol} ${statusText}] ${test.name}`);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('EVALUATION SUMMARY');
  console.log('='.repeat(60));
  console.log();

  const overallStatus = testResults.failed === 0 && testResults.errors === 0 ? 'PASSED' : 'FAILED';

  console.log(`Implementation (repository_after):`);
  console.log(`  Overall: ${overallStatus}`);
  console.log(`  Tests: ${testResults.passed}/${totalTests} passed`);
  console.log();

  console.log('='.repeat(60));
  console.log('EXPECTED BEHAVIOR CHECK');
  console.log('='.repeat(60));

  if (overallStatus === 'PASSED') {
    console.log('[✓ OK] All tests passed (expected)');
  } else {
    console.log('[✗ FAIL] Some tests failed (unexpected)');
  }

  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;

  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = startTime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
  const reportDir = path.join(__dirname, 'reports', dateStr, timeStr);

  fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    run_id: runId,
    task_title: TASK_TITLE,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_seconds: duration,
    test_results: {
      passed: testResults.passed,
      failed: testResults.failed,
      errors: testResults.errors,
      skipped: testResults.skipped,
      total: totalTests,
      status: overallStatus,
      tests: testResults.tests
    },
    overall_status: overallStatus
  };

  const reportPath = path.join(reportDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log();
  console.log(`Report saved to:`);
  console.log(reportPath);
  console.log();

  console.log('='.repeat(60));
  console.log('EVALUATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Success: ${overallStatus === 'PASSED' ? 'YES' : 'NO'}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exit(0);
});
