#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawnSync } from 'child_process';

/**
 * POLL CREATION EVALUATION
 * Produces report.json following the standard schema.
 */

interface EnvironmentInfo {
  node_version: string;
  platform: string;
}

interface TestResults {
  passed: boolean;
  return_code: number;
  output: string;
}

interface RepositoryResults {
  tests: TestResults;
  metrics: Record<string, unknown>;
}

interface ComparisonResults {
  passed_gate: boolean;
  improvement_summary: string;
}

interface EvaluationReport {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  environment: EnvironmentInfo;
  before: RepositoryResults;
  after: RepositoryResults;
  comparison: ComparisonResults;
  success: boolean;
  error: string | null;
}

function generateRunId(): string {
  return Math.random().toString(36).substring(2, 10) + '-' + 
         Math.random().toString(36).substring(2, 6) + '-' +
         Math.random().toString(36).substring(2, 6) + '-' +
         Math.random().toString(36).substring(2, 6) + '-' +
         Math.random().toString(36).substring(2, 14);
}

function getEnvironmentInfo(): EnvironmentInfo {
  return {
    node_version: process.version,
    platform: os.platform() + '-' + os.arch(),
  };
}

function truncateOutput(output: string, maxLength: number = 8000): string {
  if (output.length <= maxLength) return output;
  return output.substring(0, maxLength) + '\n... [truncated]';
}

function runTests(repositoryPath: string, repositoryName: string): RepositoryResults {
  console.log('\n' + '='.repeat(60));
  console.log('RUNNING TESTS: ' + repositoryName);
  console.log('='.repeat(60));

  const hasCode =
    fs.existsSync(path.join(process.cwd(), repositoryPath, 'server')) ||
    fs.existsSync(path.join(process.cwd(), repositoryPath, 'client')) ||
    fs.existsSync(path.join(process.cwd(), repositoryPath, 'package.json'));

  if (!hasCode && repositoryName === 'repository_before') {
    console.log('Skipping repository_before as it contains no implementation code (CREATION mode).');
    return {
      tests: {
        passed: false,
        return_code: 1,
        output: 'No implementation (CREATION task)',
      },
      metrics: {},
    };
  }

  const cwd = process.cwd();
  const spawnResult = spawnSync('npx', ['jest', '--config', 'tests/jest.config.js', '--no-coverage', '--runInBand'], {
    encoding: 'utf8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stdout = spawnResult.stdout || '';
  const stderr = spawnResult.stderr || '';
  const combinedOutput = stderr + '\n' + stdout;
  
  let passed = spawnResult.status === 0;
  let output = truncateOutput(combinedOutput);

  return {
    tests: {
      passed,
      return_code: spawnResult.status ?? 1,
      output,
    },
    metrics: {},
  };
}

function generateOutputPaths(): { reportPath: string; latestPath: string } {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  const reportDir = path.join(process.cwd(), 'evaluation', 'reports', dateStr, timeStr);
  fs.mkdirSync(reportDir, { recursive: true });
  
  const latestDir = path.join(process.cwd(), 'evaluation', 'reports');
  
  return {
    reportPath: path.join(reportDir, 'report.json'),
    latestPath: path.join(latestDir, 'latest.json'),
  };
}

const runId = generateRunId();
const startedAt = new Date();

console.log('\n' + '='.repeat(60));
console.log('POLL CREATION EVALUATION');
console.log('='.repeat(60));
console.log('Run ID: ' + runId);
console.log('Started at: ' + startedAt.toISOString());

const beforeResults = runTests('repository_before', 'repository_before');
const afterResults = runTests('repository_after', 'repository_after');

const finishedAt = new Date();
const duration = (finishedAt.getTime() - startedAt.getTime()) / 1000;

// Success rule: success = after.tests.passed == true
const success = afterResults.tests.passed === true;

let improvementSummary: string;
if (beforeResults.tests.output.includes('CREATION')) {
  // CREATION task
  if (afterResults.tests.passed) {
    improvementSummary = 'Creation successful: all tests pass.';
  } else {
    improvementSummary = 'Creation incomplete: tests still failing.';
  }
} else {
  // REFACTOR task
  if (afterResults.tests.passed) {
    improvementSummary = 'Refactoring successful: all tests now pass.';
  } else {
    improvementSummary = 'Refactoring incomplete: tests still failing.';
  }
}

const comparison: ComparisonResults = {
  passed_gate: success,
  improvement_summary: improvementSummary,
};

console.log('\n' + '='.repeat(60));
console.log('EVALUATION SUMMARY');
console.log('='.repeat(60));
console.log('\nBefore Implementation (repository_before):');
console.log('  Overall: ' + (beforeResults.tests.passed ? 'PASSED' : 'FAILED/SKIPPED'));
console.log('  Output: ' + beforeResults.tests.output);
console.log('\nAfter Implementation (repository_after):');
console.log('  Overall: ' + (afterResults.tests.passed ? 'PASSED' : 'FAILED'));
console.log('  Output: ' + afterResults.tests.output);

const report: EvaluationReport = {
  run_id: runId,
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_seconds: parseFloat(duration.toFixed(3)),
  environment: getEnvironmentInfo(),
  before: beforeResults,
  after: afterResults,
  comparison,
  success,
  error: success ? null : 'After implementation tests failed',
};

const { reportPath, latestPath } = generateOutputPaths();
const reportJson = JSON.stringify(report, null, 2);
fs.writeFileSync(reportPath, reportJson);
fs.writeFileSync(latestPath, reportJson);

console.log('\nReport saved to: ' + reportPath);
console.log('Latest saved to: ' + latestPath);
console.log('\n' + '='.repeat(60));
console.log('EVALUATION COMPLETE');
console.log('='.repeat(60));
console.log('Duration: ' + duration.toFixed(2) + 's');
console.log('Success: ' + (success ? 'YES' : 'NO'));

process.exit(success ? 0 : 1);
