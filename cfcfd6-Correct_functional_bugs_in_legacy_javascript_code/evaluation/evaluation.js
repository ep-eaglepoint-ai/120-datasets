#!/usr/bin/env node

/**
 * Evaluation script for JavaScript bug fix project
 * Runs tests on both repository_before and repository_after
 * Generates comparison report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Generate unique run ID
function generateRunId() {
    return Math.random().toString(36).substring(2, 10);
}

// Get current timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// Create report directory
function createReportDir() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const reportDir = path.join(__dirname, 'reports', dateStr, timeStr);
    
    fs.mkdirSync(reportDir, { recursive: true });
    return reportDir;
}

// Run tests for a specific module
function runTests(modulePath, label) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running tests on ${label}...`);
    console.log('='.repeat(60));
    
    try {
        const output = execSync(
            `npm test --prefix tests`,
            {
                env: { ...process.env, TEST_MODULE: modulePath },
                encoding: 'utf-8',
                stdio: 'pipe'
            }
        );
        
        console.log(output);
        
        // Parse Jest output - look in both stdout and stderr
        const fullOutput = output;
        const testLineMatch = fullOutput.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
        
        let passed = 0;
        let failed = 0;
        let total = 0;
        
        if (testLineMatch) {
            failed = testLineMatch[1] ? parseInt(testLineMatch[1]) : 0;
            passed = parseInt(testLineMatch[2]);
            total = parseInt(testLineMatch[3]);
        }
        
        return {
            success: failed === 0 && total > 0,
            exit_code: 0,
            total: total,
            passed: passed,
            failed: failed,
            stdout: output,
            stderr: ''
        };
    } catch (error) {
        const stdout = error.stdout || '';
        const stderr = error.stderr || '';
        const fullOutput = stdout + stderr;
        
        console.log(stdout);
        console.error(stderr);
        
        // Parse Jest output from combined output
        const testLineMatch = fullOutput.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
        
        let passed = 0;
        let failed = 0;
        let total = 0;
        
        if (testLineMatch) {
            failed = testLineMatch[1] ? parseInt(testLineMatch[1]) : 0;
            passed = parseInt(testLineMatch[2]);
            total = parseInt(testLineMatch[3]);
        }
        
        return {
            success: failed === 0 && total > 0,
            exit_code: error.status || 1,
            total: total,
            passed: passed,
            failed: failed,
            stdout: stdout,
            stderr: stderr
        };
    }
}

// Main evaluation function
function runEvaluation() {
    const runId = generateRunId();
    const startTime = getTimestamp();
    const startMs = Date.now();
    
    console.log('Starting JavaScript bug fix evaluation...');
    console.log(`Run ID: ${runId}`);
    console.log(`Started at: ${startTime}`);
    
    // Run tests on repository_before
    const beforeResults = runTests('../repository_before/utils.js', 'repository_before');
    
    // Run tests on repository_after
    const afterResults = runTests('../repository_after/utils.js', 'repository_after');
    
    const endTime = getTimestamp();
    const endMs = Date.now();
    const duration = (endMs - startMs) / 1000;
    
    // Determine overall success
    const overallSuccess = beforeResults.failed > 0 && afterResults.success;
    
    // Create report
    const report = {
        run_id: runId,
        started_at: startTime,
        finished_at: endTime,
        duration_seconds: duration,
        success: overallSuccess,
        error: null,
        environment: {
            node_version: process.version,
            platform: `${os.type()}-${os.release()}`,
            os: os.type(),
            os_release: os.release(),
            architecture: os.arch(),
            hostname: os.hostname()
        },
        results: {
            before: beforeResults,
            after: afterResults,
            comparison: {
                before_tests_passed: beforeResults.success,
                after_tests_passed: afterResults.success,
                before_total: beforeResults.total,
                before_passed: beforeResults.passed,
                before_failed: beforeResults.failed,
                after_total: afterResults.total,
                after_passed: afterResults.passed,
                after_failed: afterResults.failed
            }
        }
    };
    
    // Save report
    const reportDir = createReportDir();
    const reportPath = path.join(reportDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Run ID: ${runId}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Report saved to: ${reportPath}`);
    console.log(`Overall success: ${overallSuccess}`);
    console.log('');
    console.log('Summary:');
    console.log(`  Before tests: ${beforeResults.passed}/${beforeResults.total} passed`);
    console.log(`  After tests: ${afterResults.passed}/${afterResults.total} passed`);
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    process.exit(overallSuccess ? 0 : 1);
}

// Run evaluation
runEvaluation();
