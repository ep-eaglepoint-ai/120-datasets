#!/usr/bin/env node
/**
 * IoT Event Processing Pipeline Evaluation
 * Runs the test suite for repository_before and repository_after
 * and writes a JSON report following the standard evaluation guide format.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

interface EnvironmentInfo {
    node_version: string;
    platform: string;
}

interface TestResult {
    passed: boolean;
    return_code: number;
    output: string;
}

interface RepositoryResult {
    tests: TestResult;
    metrics: Record<string, number>;
}

interface Comparison {
    passed_gate: boolean;
    improvement_summary: string;
}

interface EvaluationReport {
    run_id: string;
    started_at: string;
    finished_at: string;
    duration_seconds: number;
    environment: EnvironmentInfo;
    before: RepositoryResult;
    after: RepositoryResult;
    comparison: Comparison;
    success: boolean;
    error: string | null;
}

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'evaluation', 'reports');

function environmentInfo(): EnvironmentInfo {
    return {
        node_version: process.version,
        platform: `${os.platform()}-${os.arch()}`
    };
}

function runTests(testTarget: 'before' | 'after'): TestResult {
    console.log(`\nRunning tests for repository_${testTarget}...`);
    
    const cwd = ROOT;
    const result = spawnSync(
        'npx',
        ['jest', '--config', 'tests/jest.config.js', '--silent', '--forceExit'],
        {
            encoding: 'utf8',
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, TEST_TARGET: testTarget },
            timeout: 5 * 60 * 1000 // 5 min timeout
        }
    );

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const output = (stdout + '\n' + stderr).slice(0, 8000);

    if (result.signal === 'SIGTERM') {
        return {
            passed: false,
            return_code: -1,
            output: 'jest timeout'
        };
    }

    return {
        passed: result.status === 0,
        return_code: result.status ?? 1,
        output
    };
}

function runMetrics(_repoName: string): Record<string, number> {
    // Optional - can add performance metrics here if needed
    return {};
}

function evaluate(repoName: 'repository_before' | 'repository_after'): RepositoryResult {
    const testTarget = repoName === 'repository_before' ? 'before' : 'after';
    const tests = runTests(testTarget);
    const metrics = runMetrics(repoName);
    return { tests, metrics };
}

function runEvaluation(): EvaluationReport {
    const runId = uuidv4();
    const start = new Date();

    console.log('============================================================');
    console.log('IoT EVENT PROCESSING PIPELINE EVALUATION');
    console.log('============================================================');
    console.log(`Run ID: ${runId}`);
    console.log(`Started at: ${start.toISOString()}`);

    const before = evaluate('repository_before');
    const after = evaluate('repository_after');

    const comparison: Comparison = {
        passed_gate: after.tests.passed,
        improvement_summary: after.tests.passed
            ? 'After implementation passed all correctness tests'
            : 'After implementation failed correctness tests'
    };

    const end = new Date();
    const durationSeconds = (end.getTime() - start.getTime()) / 1000;

    console.log('\n============================================================');
    console.log('EVALUATION SUMMARY');
    console.log('============================================================');
    console.log(`\nBefore: ${before.tests.passed ? 'PASSED' : 'FAILED'} (exit code: ${before.tests.return_code})`);
    console.log(`After: ${after.tests.passed ? 'PASSED' : 'FAILED'} (exit code: ${after.tests.return_code})`);
    console.log(`\nSuccess: ${comparison.passed_gate ? 'YES' : 'NO'}`);
    console.log(`Duration: ${durationSeconds.toFixed(2)}s`);

    return {
        run_id: runId,
        started_at: start.toISOString(),
        finished_at: end.toISOString(),
        duration_seconds: parseFloat(durationSeconds.toFixed(3)),
        environment: environmentInfo(),
        before,
        after,
        comparison,
        success: comparison.passed_gate,
        error: null
    };
}

function main(): number {
    fs.mkdirSync(REPORTS, { recursive: true });

    let report: EvaluationReport;
    try {
        report = runEvaluation();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        report = {
            run_id: uuidv4(),
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            duration_seconds: 0,
            environment: environmentInfo(),
            before: { tests: { passed: false, return_code: -1, output: '' }, metrics: {} },
            after: { tests: { passed: false, return_code: -1, output: '' }, metrics: {} },
            comparison: { passed_gate: false, improvement_summary: 'Evaluation crashed' },
            success: false,
            error: errorMessage
        };
    }

    const reportPath = path.join(REPORTS, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${reportPath}`);

    return report.success ? 0 : 1;
}

process.exit(main());
