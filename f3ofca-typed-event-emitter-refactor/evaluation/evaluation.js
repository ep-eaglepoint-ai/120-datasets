// filename: evaluate.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');


function parseOutput(output, results) {
    const lines = output.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Match formats like:
        // [✓ PASS] Test name
        // [✗ FAIL] Test name
        // PASS Test name
        // FAIL Test name

        const passMatch = trimmed.match(/PASS\]?\s*(.+)$/);
        const failMatch = trimmed.match(/FAIL\]?\s*(.+)$/);
        const skipMatch = trimmed.match(/SKIP\]?\s*(.+)$/);

        if (passMatch) {
            results.passed++;
            results.tests.push({
                name: passMatch[1].trim(),
                status: 'PASS'
            });
        } else if (failMatch) {
            results.failed++;
            results.tests.push({
                name: failMatch[1].trim(),
                status: 'FAIL'
            });
        } else if (skipMatch) {
            results.skipped++;
            results.tests.push({
                name: skipMatch[1].trim(),
                status: 'SKIP'
            });
        }
    }
}

/**
 * Run tests for a specific implementation
 */
function runTests(implementation) {
    const testRunner = implementation === 'before'
        ? '/app/tests/run-before.js'
        : '/app/tests/run-after.js';

    const results = {
        passed: 0,
        failed: 0,
        errors: 0,
        skipped: 0,
        tests: []
    };

    let success = true;
    let output = '';

    try {
        output = execSync(`node ${testRunner}`, {
            encoding: 'utf8',
            stdio: 'pipe',
            env: { ...process.env, NODE_PATH: '/app' }
        });

        parseOutput(output, results);
        success = results.failed === 0;
    } catch (error) {
        success = false;
        output = error.stdout || error.stderr || '';
        parseOutput(output, results);
    }

    results.total = results.passed + results.failed;
    return { success, results, output };
}

/**
 * Main evaluation function
 */
function evaluate() {
    const runId = randomUUID();
    const startTime = new Date();
    
    console.log(`Run ID: ${runId}`);
    console.log(`Started at: ${startTime.toISOString()}\n`);
    
    console.log('============================================================');
    console.log('TYPED EVENT EMITTER REFACTOR EVALUATION');
    console.log('============================================================\n');
    
    // Run tests for BEFORE
    console.log('============================================================');
    console.log('RUNNING TESTS: BEFORE (REPOSITORY_BEFORE)');
    console.log('============================================================');
    console.log('Environment: repository_before');
    console.log('Tests directory: /app/tests\n');
    
    const beforeResults = runTests('before');
    console.log(`Results: ${beforeResults.results.passed} passed, ${beforeResults.results.failed} failed, ${beforeResults.results.errors} errors, ${beforeResults.results.skipped} skipped (total: ${beforeResults.results.total})`);
    for (const test of beforeResults.results.tests) {
        const symbol = test.status === 'PASS' ? '✓' : '✗';
        console.log(`  [${symbol} ${test.status}] ${test.name}`);
    }
    console.log();
    
    // Run tests for AFTER
    console.log('============================================================');
    console.log('RUNNING TESTS: AFTER (REPOSITORY_AFTER)');
    console.log('============================================================');
    console.log('Environment: repository_after');
    console.log('Tests directory: /app/tests\n');
    
    const afterResults = runTests('after');
    console.log(`Results: ${afterResults.results.passed} passed, ${afterResults.results.failed} failed, ${afterResults.results.errors} errors, ${afterResults.results.skipped} skipped (total: ${afterResults.results.total})`);
    for (const test of afterResults.results.tests) {
        const symbol = test.status === 'PASS' ? '✓' : '✗';
        console.log(`  [${symbol} ${test.status}] ${test.name}`);
    }
    console.log();
    
    // Summary
    console.log('============================================================');
    console.log('EVALUATION SUMMARY');
    console.log('============================================================\n');
    
    console.log('Before Implementation (repository_before):');
    console.log(`  Overall: ${beforeResults.success ? 'PASSED' : 'FAILED'}`);
    console.log(`  Tests: ${beforeResults.results.passed}/${beforeResults.results.total} passed\n`);
    
    console.log('After Implementation (repository_after):');
    console.log(`  Overall: ${afterResults.success ? 'PASSED' : 'FAILED'}`);
    console.log(`  Tests: ${afterResults.results.passed}/${afterResults.results.total} passed\n`);
    
    // Expected behavior check
    console.log('============================================================');
    console.log('EXPECTED BEHAVIOR CHECK');
    console.log('============================================================');
    
    const afterOk = afterResults.success;
    const beforeOk = !beforeResults.success;
    
    if (afterOk) {
        console.log('[✓ OK] After implementation: All tests passed (expected)');
    } else {
        console.log('[✗ FAIL] After implementation: Tests failed (unexpected)');
    }
    
    if (beforeOk) {
        console.log('[✓ OK] Before implementation: Tests failed (expected)');
    } else {
        console.log('[✗ FAIL] Before implementation: Tests passed (unexpected)');
    }
    console.log();
    
    // Save report
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    const report = {
        run_id: runId,
        task_title: 'Typed Event Emitter Refactor',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_seconds: duration,
        before_results: {
            overall: beforeResults.success ? 'PASSED' : 'FAILED',
            passed: beforeResults.results.passed,
            failed: beforeResults.results.failed,
            total: beforeResults.results.total,
            tests: beforeResults.results.tests
        },
        after_results: {
            overall: afterResults.success ? 'PASSED' : 'FAILED',
            passed: afterResults.results.passed,
            failed: afterResults.results.failed,
            total: afterResults.results.total,
            tests: afterResults.results.tests
        },
        overall_status: afterOk && beforeOk ? 'SUCCESS' : 'FAILURE',
        expected_behavior_validation: {
            after_passed: afterOk,
            before_failed: beforeOk
        }
    };
    
    // Create reports directory
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const reportDir = path.join('/app/evaluation/reports', dateStr, timeStr);
    
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Report saved to:`);
    console.log(`${reportPath}\n`);
    
    console.log('============================================================');
    console.log('EVALUATION COMPLETE');
    console.log('============================================================');
    console.log(`Run ID: ${runId}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Success: ${afterOk && beforeOk ? 'YES' : 'NO'}\n`);
    
    process.exit(afterOk && beforeOk ? 0 : 0); // Always exit 0 as per requirements
}

// Run evaluation
evaluate();
