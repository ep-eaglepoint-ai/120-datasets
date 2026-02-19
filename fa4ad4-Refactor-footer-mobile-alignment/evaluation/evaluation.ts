import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

interface TestResult {
  nodeid: string; 
  name: string;
  outcome: 'passed' | 'failed' | 'error' | 'skipped';
}

interface EvaluationResult {
  success: boolean;
  exit_code: number;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
  };
  stdout: string;
  stderr: string;
}

function generateRunId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getGitInfo(): { git_commit: string; git_branch: string } {
  const info = { git_commit: 'unknown', git_branch: 'unknown' };
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim();
    info.git_commit = commit.substring(0, 8);
  } catch (e) {
    // Silently ignore git errors (not in a git repo)
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim();
    info.git_branch = branch;
  } catch (e) {
    // Silently ignore git errors (not in a git repo)
  }

  return info;
}

function getEnvironmentInfo() {
  const gitInfo = getGitInfo();
  return {
    node_version: process.version,
    platform: os.platform(),
    os_release: os.release(),
    architecture: os.arch(),
    hostname: os.hostname(),
    git_commit: gitInfo.git_commit,
    git_branch: gitInfo.git_branch,
  };
}

function parseStructureTests(stdout: string): TestResult[] {
  const tests: TestResult[] = [];
  const lines = stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('[PASS]') || line.includes('[FAIL]')) {
      const outcome = line.includes('[FAIL]') ? 'failed' : 'passed';
      // format: [PASS] description: detail
      const parts = line.split(']');
      if (parts.length > 1) {
        let name = parts[1].trim(); 
        tests.push({
          nodeid: `test_structure.ts::${name}`,
          name: name,
          outcome: outcome
        });
      }
    }
  }
  return tests;
}

function runTestsWithRepo(repoName: string, label: string): EvaluationResult {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RUNNING TESTS: ${label.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Repository: ${repoName}`);

  const env = { ...process.env, REPO: repoName, CI: 'true' };
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  
  try {
    // Run Structure Tests via npm test
    stdout = execSync('npm test', { 
      env, 
      encoding: 'utf-8', 
      stdio: 'pipe' 
    });
  } catch (e: any) {
    stdout = e.stdout?.toString() || '';
    stderr = e.stderr?.toString() || '';
    exitCode = e.status || 1;
  }

  // Parse results from stdout
  const tests = parseStructureTests(stdout);
  
  const passed = tests.filter(t => t.outcome === 'passed').length;
  const failed = tests.filter(t => t.outcome === 'failed').length;
  
  const summary = {
    total: tests.length,
    passed,
    failed,
    errors: exitCode !== 0 && failed === 0 ? 1 : 0, 
    skipped: 0
  };

  console.log(`\nResults: ${summary.passed} passed, ${summary.failed} failed (total: ${summary.total})`);
  
  tests.forEach(test => {
    const icon = test.outcome === 'passed' ? '✅' : '❌';
    console.log(`  ${icon} ${test.name}`);
  });

  return {
    success: exitCode === 0,
    exit_code: exitCode,
    tests,
    summary,
    stdout,
    stderr
  };
}

function generateOutputPath(): string {
  // Generate timestamped directory structure like cb4e35
  const projectRoot = path.resolve(__dirname, '..');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const outputDir = path.join(projectRoot, 'evaluation', dateStr, timeStr);
  
  // Create directory if it doesn't exist
  fs.mkdirSync(outputDir, { recursive: true });
  
  return path.join(outputDir, 'report.json');
}

function main() {
  const runId = generateRunId();
  const startedAt = new Date();

  console.log(`Run ID: ${runId}`);
  console.log(`Started at: ${startedAt.toISOString()}`);
  console.log(`\n${'='.repeat(60)}`);
  console.log("FOOTER REFACTORING STRUCTURE EVALUATION");
  console.log(`${'='.repeat(60)}`);

  // Run tests with BEFORE implementation
  // Expected to PASS checks for Legacy/JavaScript state
  const beforeResults = runTestsWithRepo('repository_before', 'before (repository_before)');

  // Run tests with AFTER implementation
  // Expected to PASS checks for React/TypeScript state
  const afterResults = runTestsWithRepo('repository_after', 'after (repository_after)');

  const comparison = {
    before_tests_passed: beforeResults.success,
    after_tests_passed: afterResults.success,
    before_passed: beforeResults.summary.passed,
    before_failed: beforeResults.summary.failed,
    after_passed: afterResults.summary.passed,
    after_failed: afterResults.summary.failed,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log("EVALUATION SUMMARY");
  console.log(`${'='.repeat(60)}`);

  console.log(`\nBefore Implementation (repository_before):`);
  console.log(`  Overall: ${beforeResults.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Tests: ${comparison.before_passed}/${beforeResults.summary.total} passed`);

  console.log(`\nAfter Implementation (repository_after):`);
  console.log(`  Overall: ${afterResults.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Tests: ${comparison.after_passed}/${afterResults.summary.total} passed`);
  
  // Both must be successful for the task to be considered complete
  const success = beforeResults.success && afterResults.success;

  const report = {
    run_id: runId,
    task_id: "fa4ad4",
    task_name: "Footer Mobile Alignment Refactor",
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    success,
    error: success ? null : "One or more repositories failed their structural checks",
    environment: getEnvironmentInfo(),
    results: {
      before: beforeResults,
      after: afterResults,
      comparison
    }
  };

  const outputPath = process.argv[2] && process.argv[2].startsWith('--output=') 
    ? process.argv[2].split('=')[1]
    : generateOutputPath();

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to: ${outputPath}`);
  
  process.exit(success ? 0 : 1);
}

main();
