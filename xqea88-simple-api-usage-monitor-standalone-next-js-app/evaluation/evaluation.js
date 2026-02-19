const { execSync } = require('child_process');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { randomUUID } = require('crypto');

function runEvaluation() {
  const runId = randomUUID();
  const startTime = new Date();
  const taskTitle = 'Simple API Usage Monitor (Standalone Next.js App)';

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startTime.toISOString()}`);
  console.log('');
  console.log('============================================================');
  console.log(`${taskTitle.toUpperCase()} EVALUATION`);
  console.log('============================================================');
  console.log('');
  console.log('============================================================');
  console.log('RUNNING TESTS (REPOSITORY_AFTER)');
  console.log('============================================================');
  console.log('Environment: repository_after');
  console.log('Tests directory: /app/tests');
  console.log('');

  let testOutput = '';
  let testsPassed = 0;
  let testsFailed = 0;
  let testsErrors = 0;
  let testsSkipped = 0;
  let testsTotal = 0;
  const testResults = [];

  try {
    testOutput = execSync('cd repository_after && npm test -- --json --testLocationInResults', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Extract JSON from output (npm adds extra text before the JSON)
    const jsonMatch = testOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in test output');
    }
    
    const jestResults = JSON.parse(jsonMatch[0]);
    testsTotal = jestResults.numTotalTests || 0;
    testsPassed = jestResults.numPassedTests || 0;
    testsFailed = jestResults.numFailedTests || 0;
    testsErrors = 0;
    testsSkipped = jestResults.numPendingTests || 0;

    if (jestResults.testResults) {
      let testCounter = 1;
      jestResults.testResults.forEach((suite) => {
        if (suite.assertionResults) {
          suite.assertionResults.forEach((test) => {
            testResults.push({
              id: `test-${testCounter++}`,
              name: test.fullName || test.title,
              status: test.status === 'passed' ? 'passed' : 
                      test.status === 'failed' ? 'failed' :
                      test.status === 'pending' ? 'skipped' : 'error',
              duration: test.duration
            });
          });
        }
      });
    }
  } catch (error) {
    testOutput = error.stdout || error.stderr || '';
    console.error('Error running tests:', error.message);
    testsTotal = 0;
    testsPassed = 0;
    testsFailed = 1;
    testsErrors = 1;
    
    testResults.push({
      id: 'error-1',
      name: 'Test execution failed',
      status: 'error'
    });
  }

  console.log(`Results: ${testsPassed} passed, ${testsFailed} failed, ${testsErrors} errors, ${testsSkipped} skipped (total: ${testsTotal})`);
  
  testResults.forEach(test => {
    const statusIcon = test.status === 'passed' ? '✓ PASS' : 
                       test.status === 'failed' ? '✗ FAIL' :
                       test.status === 'skipped' ? '○ SKIP' : '✗ ERROR';
    console.log(`  [${statusIcon}] ${test.name}`);
  });

  console.log('');
  console.log('============================================================');
  console.log('EVALUATION SUMMARY');
  console.log('============================================================');
  console.log('');
  console.log('Implementation (repository_after):');
  console.log(`  Overall: ${testsFailed === 0 && testsErrors === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`  Tests: ${testsPassed}/${testsTotal} passed`);
  console.log('');
  console.log('============================================================');
  console.log('EXPECTED BEHAVIOR CHECK');
  console.log('============================================================');
  console.log(`[${testsFailed === 0 && testsErrors === 0 ? '✓ OK' : '✗ FAIL'}] All tests passed (expected)`);
  console.log('');

  const endTime = new Date();
  const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

  const report = {
    run_id: runId,
    task_title: taskTitle,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_seconds: durationSeconds,
    test_results: {
      total: testsTotal,
      passed: testsPassed,
      failed: testsFailed,
      errors: testsErrors,
      skipped: testsSkipped,
      tests: testResults
    },
    overall_status: testsFailed === 0 && testsErrors === 0 ? 'PASSED' : 'FAILED'
  };

  const reportDate = startTime.toISOString().split('T')[0];
  const reportTime = startTime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
  const reportDir = join(process.cwd(), 'evaluation', 'reports', reportDate, reportTime);
  
  try {
    mkdirSync(reportDir, { recursive: true });
    const reportPath = join(reportDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('Report saved to:');
    console.log(`evaluation/reports/${reportDate}/${reportTime}/report.json`);
  } catch (error) {
    console.error('Failed to save report:', error);
  }

  console.log('');
  console.log('============================================================');
  console.log('EVALUATION COMPLETE');
  console.log('============================================================');
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${durationSeconds.toFixed(2)}s`);
  console.log(`Success: ${report.overall_status === 'PASSED' ? 'YES' : 'NO'}`);
  console.log('');

  process.exit(0);
}

runEvaluation();
