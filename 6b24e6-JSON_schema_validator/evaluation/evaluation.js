#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('uuid');

const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(__dirname, 'reports');

function getUUID() {
    try {
        return require('crypto').randomUUID();
    } catch {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

function environmentInfo() {
    const nodeVersion = process.version;
    const platform = `${process.platform}-${process.arch}`;
    return {
        node_version: nodeVersion,
        platform: platform
    };
}

function runTests(repoName) {
    const testArg = repoName === 'repository_before' ? 'before' : 'after';
    
    try {
        const result = execSync(
            `node tests/test_all.js ${testArg}`,
            {
                cwd: ROOT,
                encoding: 'utf8',
                timeout: 120000,
                stdio: 'pipe'
            }
        );
        
        return parseTestOutput(result, 0);
    } catch (error) {
        if (error.stdout || error.stderr) {
            const output = (error.stdout || '') + (error.stderr || '');
            return parseTestOutput(output, error.status || 1);
        }
        return {
            passed: false,
            return_code: -1,
            output: `Test execution error: ${error.message}`,
            test_count: 0,
            passed_count: 0,
            failed_count: 0
        };
    }
}

function parseTestOutput(output, returnCode) {
    let passedCount = 0;
    let failedCount = 0;
    let totalCount = 0;
    
    const lines = output.split('\n');
    for (const line of lines) {
        if (line.includes('Passed:')) {
            const match = line.match(/Passed:\s*(\d+)/);
            if (match) passedCount = parseInt(match[1], 10);
        }
        if (line.includes('Failed:')) {
            const match = line.match(/Failed:\s*(\d+)/);
            if (match) failedCount = parseInt(match[1], 10);
        }
        if (line.includes('Total:')) {
            const match = line.match(/Total:\s*(\d+)/);
            if (match) totalCount = parseInt(match[1], 10);
        }
    }
    
    return {
        passed: returnCode === 0,
        return_code: returnCode,
        output: output.slice(0, 8000),
        test_count: totalCount,
        passed_count: passedCount,
        failed_count: failedCount
    };
}

function runMetrics(tests) {
    const passRate = tests.test_count > 0 
        ? Math.round((tests.passed_count / tests.test_count) * 10000) / 100
        : 0.0;
    
    return {
        pass_rate: passRate,
        test_count: tests.test_count,
        passed_count: tests.passed_count,
        failed_count: tests.failed_count
    };
}

function evaluate(repoName) {
    const tests = runTests(repoName);
    const metrics = runMetrics(tests);
    return {
        tests: tests,
        metrics: metrics
    };
}

function runEvaluation() {
    const runId = getUUID();
    const start = new Date();
    
    try {
        const before = evaluate('repository_before');
        const after = evaluate('repository_after');
        
        const improvement = after.metrics.passed_count - before.metrics.passed_count;
        
        let summary;
        if (improvement > 0) {
            summary = `Fixed ${improvement} bug(s). After: ${after.metrics.passed_count}/${after.metrics.test_count} tests pass.`;
        } else if (improvement < 0) {
            summary = `Regression: ${Math.abs(improvement)} test(s) now failing.`;
        } else {
            summary = `No change. ${after.metrics.passed_count}/${after.metrics.test_count} tests pass.`;
        }
        
        const comparison = {
            passed_gate: after.tests.passed,
            improvement_summary: summary
        };
        
        const end = new Date();
        
        return {
            run_id: runId,
            started_at: start.toISOString(),
            finished_at: end.toISOString(),
            duration_seconds: (end - start) / 1000,
            environment: environmentInfo(),
            before: before,
            after: after,
            comparison: comparison,
            success: comparison.passed_gate,
            error: null
        };
    } catch (error) {
        const end = new Date();
        return {
            run_id: runId,
            started_at: start.toISOString(),
            finished_at: end.toISOString(),
            duration_seconds: (end - start) / 1000,
            environment: environmentInfo(),
            before: null,
            after: null,
            comparison: null,
            success: false,
            error: error.message
        };
    }
}

function main() {
    if (!fs.existsSync(REPORTS)) {
        fs.mkdirSync(REPORTS, { recursive: true });
    }
    
    const report = runEvaluation();
    
    // Generate timestamp filename: YYYY-MM-DD_HH-MM-SS.json
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');
    const timestampFile = `${timestamp}.json`;
    
    // Write timestamped report
    const reportPath = path.join(REPORTS, timestampFile);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also write latest.json for convenience
    const latestPath = path.join(REPORTS, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
    
    console.log(`Report written to ${reportPath}`);
    console.log(`Latest copy: ${latestPath}`);
    console.log('\nEvaluation Summary:');
    console.log(`  Run ID: ${report.run_id}`);
    console.log(`  Success: ${report.success}`);
    
    if (report.comparison) {
        console.log(`  ${report.comparison.improvement_summary}`);
    }
    
    if (report.error) {
        console.log(`  Error: ${report.error}`);
    }
    
    return report.success ? 0 : 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = { runEvaluation, main };

