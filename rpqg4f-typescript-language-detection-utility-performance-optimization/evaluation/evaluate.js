import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

const TASK_TITLE = 'RPQG4F - TypeScript Language Detection Utility Performance Optimization';

function runCommand(command, args, cwd = '/app') {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { 
      cwd, 
      shell: true,
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr, output: stdout + stderr });
    });
  });
}

function parseJestOutput(output) {
  const results = { passed: 0, failed: 0, errors: 0, skipped: 0, tests: [] };
  
  // Parse test results from Jest output
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('✓') || line.includes('PASS')) {
      const match = line.match(/✓\s+(.+?)(?:\s+\(\d+\s*m?s\))?$/);
      if (match) {
        results.passed++;
        results.tests.push({ name: match[1].trim(), status: 'passed' });
      }
    } else if (line.includes('✕') || line.includes('FAIL')) {
      const match = line.match(/✕\s+(.+?)(?:\s+\(\d+\s*m?s\))?$/);
      if (match) {
        results.failed++;
        results.tests.push({ name: match[1].trim(), status: 'failed' });
      }
    }
  }
  
  // Fallback: parse summary line
  const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed|(\d+)\s+failed/g);
  if (summaryMatch && results.passed === 0 && results.failed === 0) {
    const passedMatch = output.match(/(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    if (passedMatch) results.passed = parseInt(passedMatch[1]);
    if (failedMatch) results.failed = parseInt(failedMatch[1]);
  }
  
  return results;
}

function printResults(results, env) {
  const total = results.passed + results.failed + results.errors + results.skipped;
  console.log(`\nResults: ${results.passed} passed, ${results.failed} failed, ${results.errors} errors, ${results.skipped} skipped (total: ${total})`);
  
  for (const test of results.tests) {
    if (test.status === 'passed') {
      console.log(`  [✓ PASS] ${test.name}`);
    } else {
      console.log(`  [✗ FAIL] ${test.name}`);
    }
  }
}

async function main() {
  const runId = randomUUID();
  const startTime = new Date();
  
  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startTime.toISOString()}`);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${TASK_TITLE} EVALUATION`);
  console.log(`${'='.repeat(60)}`);
  
  // Run tests for BEFORE
  console.log(`\n${'='.repeat(60)}`);
  console.log('RUNNING TESTS: BEFORE (REPOSITORY_BEFORE)');
  console.log(`${'='.repeat(60)}`);
  console.log('Environment: repository_before');
  console.log('Tests directory: /app/tests');
  
  const beforeResult = await runCommand('npx', ['cross-env', 'TEST_IMPL=before', 'jest', '--config', 'tests/jest.config.js', '--no-cache'], '/app');
  const beforeResults = parseJestOutput(beforeResult.output);
  printResults(beforeResults, 'before');
  
  // Run tests for AFTER
  console.log(`\n${'='.repeat(60)}`);
  console.log('RUNNING TESTS: AFTER (REPOSITORY_AFTER)');
  console.log(`${'='.repeat(60)}`);
  console.log('Environment: repository_after');
  console.log('Tests directory: /app/tests');
  
  const afterResult = await runCommand('npx', ['cross-env', 'TEST_IMPL=after', 'jest', '--config', 'tests/jest.config.js', '--no-cache'], '/app');
  const afterResults = parseJestOutput(afterResult.output);
  printResults(afterResults, 'after');
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('EVALUATION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const beforeTotal = beforeResults.passed + beforeResults.failed + beforeResults.errors + beforeResults.skipped;
  const afterTotal = afterResults.passed + afterResults.failed + afterResults.errors + afterResults.skipped;
  
  const beforeStatus = beforeResults.failed > 0 || beforeResults.errors > 0 ? 'FAILED' : 'PASSED';
  const afterStatus = afterResults.failed === 0 && afterResults.errors === 0 ? 'PASSED' : 'FAILED';
  
  console.log(`\nBefore Implementation (repository_before):`);
  console.log(`  Overall: ${beforeStatus}`);
  console.log(`  Tests: ${beforeResults.passed}/${beforeTotal} passed`);
  
  console.log(`\nAfter Implementation (repository_after):`);
  console.log(`  Overall: ${afterStatus}`);
  console.log(`  Tests: ${afterResults.passed}/${afterTotal} passed`);
  
  // Expected behavior check
  console.log(`\n${'='.repeat(60)}`);
  console.log('EXPECTED BEHAVIOR CHECK');
  console.log(`${'='.repeat(60)}`);
  
  const afterOk = afterStatus === 'PASSED';
  const beforeOk = beforeStatus === 'FAILED';
  
  if (afterOk) {
    console.log('[✓ OK] After implementation: All tests passed (expected)');
  } else {
    console.log('[✗ FAIL] After implementation: Some tests failed (unexpected)');
  }
  
  if (beforeOk) {
    console.log('[✓ OK] Before implementation: Tests failed (expected)');
  } else {
    console.log('[✗ FAIL] Before implementation: All tests passed (unexpected - tests should fail)');
  }
  
  // Save report
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;
  
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = startTime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
  const reportDir = `/app/evaluation/reports/${dateStr}/${timeStr}`;
  
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  
  const report = {
    run_id: runId,
    task_title: TASK_TITLE,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_seconds: duration,
    before_results: {
      passed: beforeResults.passed,
      failed: beforeResults.failed,
      errors: beforeResults.errors,
      skipped: beforeResults.skipped,
      total: beforeTotal,
      status: beforeStatus
    },
    after_results: {
      passed: afterResults.passed,
      failed: afterResults.failed,
      errors: afterResults.errors,
      skipped: afterResults.skipped,
      total: afterTotal,
      status: afterStatus
    },
    overall_status: afterOk && beforeOk ? 'SUCCESS' : 'FAILURE',
    expected_behavior_validation: {
      after_passes: afterOk,
      before_fails: beforeOk
    }
  };
  
  const reportPath = `${reportDir}/report.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\nReport saved to:`);
  console.log(reportPath);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('EVALUATION COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Success: ${afterOk && beforeOk ? 'YES' : 'NO'}`);
  
  process.exit(0);
}

main().catch(console.error);
