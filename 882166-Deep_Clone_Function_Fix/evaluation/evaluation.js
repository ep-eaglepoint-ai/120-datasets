const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'evaluation', 'reports');

function environmentInfo() {
  return {
    node_version: process.version,
    platform: `${os.platform()}-${os.arch()}`
  };
}

function runJestJson(repoName) {
  try {
    const env = { ...process.env, REPO_PATH: repoName };
    // Run the local jest binary via npx so we get JSON output
    const result = spawnSync('npx', ['jest', '--json', '--runInBand', '--testLocationInResults'], {
      cwd: ROOT,
      env,
      encoding: 'utf-8',
      timeout: 120_000
    });

    const raw = (result.stdout || '') + (result.stderr || '');
    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (e) {
      // Try to find JSON blob inside stdout
      const m = result.stdout.match(/\{[\s\S]*\}\s*$/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (e2) { parsed = null; }
      }
    }

    if (parsed && typeof parsed === 'object') {
      // Build structured output
      const summary = {
        numTotalTests: parsed.numTotalTests || 0,
        numPassedTests: parsed.numPassedTests || 0,
        numFailedTests: parsed.numFailedTests || 0,
        numTotalTestSuites: parsed.numTotalTestSuites || 0,
        numPassedTestSuites: parsed.numPassedTestSuites || 0,
        numFailedTestSuites: parsed.numFailedTestSuites || 0
      };

      const tests = (parsed.testResults || []).flatMap(suite =>
        (suite.assertionResults || []).map(t => ({
          fullName: t.fullName,
          status: t.status,
          title: t.title,
          failureMessages: t.failureMessages || [],
          location: t.location || null
        }))
      );

      return {
        passed: summary.numFailedTests === 0,
        return_code: result.status,
        summary,
        summary_matrix: [[summary.numPassedTests, summary.numFailedTests]],
        tests,
        raw_output: raw.slice(0, 8000)
      };
    }

    // Fallback: no JSON parse
    return {
      passed: result.status === 0,
      return_code: result.status,
      raw_output: raw.slice(0, 8000)
    };
  } catch (err) {
    return {
      passed: false,
      return_code: -1,
      raw_output: err.message
    };
  }
}

function runTests(repoName) {
  // prefer structured jest JSON; if jest unavailable or parse fails, fall back to npm test (human output)
  const structured = runJestJson(repoName);
  if (structured && typeof structured === 'object') return structured;

  // fallback (shouldn't normally be reached)
  try {
    const env = { ...process.env, REPO_PATH: repoName };
    const result = spawnSync('npm', ['test', '--', '--runInBand'], {
      cwd: ROOT,
      env,
      encoding: 'utf-8',
      timeout: 120_000
    });
    return {
      passed: result.status === 0,
      return_code: result.status,
      raw_output: ((result.stdout || '') + (result.stderr || '')).slice(0, 8000)
    };
  } catch (err) {
    return { passed: false, return_code: -1, raw_output: err.message };
  }
}

function runMetrics(_repoName) { return {}; }

function evaluate(repoName) {
  const tests = runTests(repoName);
  return { tests, metrics: runMetrics(repoName) };
}

function runEvaluation() {
  const runId = crypto.randomUUID();
  const start = new Date();

  let before = null, after = null, error = null;
  try {
    before = evaluate('repository_before');
    after = evaluate('repository_after');
  } catch (e) {
    error = e.message;
  }

  const end = new Date();
  const comparison = {
    passed_gate: !!(after && after.tests && after.tests.passed),
    improvement_summary: after && after.tests && after.tests.passed
      ? 'After implementation passed correctness tests'
      : 'After implementation failed correctness tests'
  };

  return {
    run_id: runId,
    started_at: start.toISOString(),
    finished_at: end.toISOString(),
    duration_seconds: (end - start) / 1000,
    environment: environmentInfo(),
    before: before || null,
    after: after || null,
    comparison,
    success: comparison.passed_gate,
    error
  };
}

function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const report = runEvaluation();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-'); // HH-MM-SS
  const dirName = `${dateStr}/${timeStr}`;
  const reportDir = path.join(REPORTS_DIR, dirName);
  fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, 'report.json');

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  return report.success ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}