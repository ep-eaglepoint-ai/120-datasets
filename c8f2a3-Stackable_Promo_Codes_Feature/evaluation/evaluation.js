#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'evaluation', 'reports');

function environmentInfo() {
  return {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

function runTests(repoName) {
  const repoPath = path.join(ROOT, repoName);
  
  try {
    // Run jest from workspace root directory
    const output = execSync(
      `npx jest --runInBand --forceExit --json`,
      {
        cwd: ROOT,
        env: {
          ...process.env,
          REPO_PATH: `../${repoName}`,
          MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
          MONGODB_DB: process.env.MONGODB_DB || 'test_promocodes',
          NODE_PATH: repoPath
        },
        encoding: 'utf-8',
        timeout: 300000,
        stdio: 'pipe'
      }
    );
    
    try {
      const jestOutput = JSON.parse(output);
      const passed = jestOutput.success || false;
      const numPassed = jestOutput.numPassedTests || 0;
      const numFailed = jestOutput.numFailedTests || 0;
      const numTotal = jestOutput.numTotalTests || 0;
      
      return {
        passed: passed,
        return_code: passed ? 0 : 1,
        output: `Tests: ${numPassed}/${numTotal} passed${numFailed > 0 ? `, ${numFailed} failed` : ''}`
      };
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        passed: false,
        return_code: 1,
        output: output.substring(0, 8000)
      };
    }
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message || '';
    return {
      passed: false,
      return_code: error.status || -1,
      output: errorOutput.substring(0, 8000)
    };
  }
}

function runMetrics(repoPath) {
  // Optional metrics collection - not implemented for this task
  return {};
}

function evaluate(repoName) {
  const repoPath = path.join(ROOT, repoName);
  
  // Install dependencies first (only if package.json exists)
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      execSync('npm install', {
        cwd: repoPath,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe'
      });
    } catch (error) {
      return {
        tests: {
          passed: false,
          return_code: -1,
          output: `npm install failed: ${(error.stderr || error.message || '').substring(0, 2000)}`
        },
        metrics: {}
      };
    }
  }
  
  // Run tests
  const tests = runTests(repoName);
  
  // Collect metrics (optional)
  const metrics = runMetrics(repoPath);
  
  return {
    tests: tests,
    metrics: metrics
  };
}

function runEvaluation() {
  const runId = randomUUID();
  const start = new Date();
  
  try {
    // Evaluate both repositories
    const before = evaluate('repository_before');
    const after = evaluate('repository_after');
    
    // Compare results
    const passedGate = after.tests.passed;
    
    const beforePassed = before.tests.passed || false;
    const afterPassed = after.tests.passed || false;
    
    let improvementSummary;
    if (afterPassed && !beforePassed) {
      improvementSummary = "After implementation passes all tests, before implementation fails (expected - method doesn't exist)";
    } else if (afterPassed && beforePassed) {
      improvementSummary = "Both implementations pass tests";
    } else if (!afterPassed && beforePassed) {
      improvementSummary = "Regression: after implementation fails tests";
    } else {
      improvementSummary = "Both implementations fail tests";
    }
    
    const comparison = {
      passed_gate: passedGate,
      improvement_summary: improvementSummary
    };
    
    const end = new Date();
    const duration = (end - start) / 1000;
    
    return {
      run_id: runId,
      started_at: start.toISOString(),
      finished_at: end.toISOString(),
      duration_seconds: duration,
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
      before: {
        tests: { passed: false, return_code: -1, output: "" },
        metrics: {}
      },
      after: {
        tests: { passed: false, return_code: -1, output: "" },
        metrics: {}
      },
      comparison: {
        passed_gate: false,
        improvement_summary: "Evaluation error occurred"
      },
      success: false,
      error: error.message || String(error)
    };
  }
}

function main() {
  // Create reports directory structure
  if (!fs.existsSync(REPORTS)) {
    fs.mkdirSync(REPORTS, { recursive: true });
  }
  
  // Generate report
  const report = runEvaluation();
  
  // Create date/time directory structure
  const now = new Date();
  const dateDir = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeDir = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  const reportDir = path.join(REPORTS, dateDir, timeDir);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Write report to date/time directory
  const reportPath = path.join(reportDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`Report written to ${reportPath}`);
  console.log(`Success: ${report.success}`);
  console.log(`Before tests passed: ${report.before.tests.passed}`);
  console.log(`After tests passed: ${report.after.tests.passed}`);
  
  return report.success ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error('Evaluation error:', error);
    process.exit(1);
  }
}

module.exports = { runEvaluation, main };
