const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'evaluation', 'reports');

function environmentInfo() {
    return {
        node_version: process.version,
        platform: `${os.platform()}-${os.arch()}`
    };
}

function runTests(repoService) {
    const projectName = `eval-${repoService}-${Date.now()}`;
    try {
        const command = `docker compose -p ${projectName} up --build --exit-code-from ${repoService} ${repoService}`;
        console.log(`Running: ${command}`);
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        return {
            passed: true,
            return_code: 0,
            output: output.substring(0, 8000)
        };
    } catch (error) {
        return {
            passed: false,
            return_code: error.status || -1,
            output: (error.stdout + error.stderr || error.message).substring(0, 8000)
        };
    } finally {
        try {
            execSync(`docker compose -p ${projectName} down -v`, { stdio: 'ignore' });
        } catch (e) { }
    }
}

async function runEvaluation() {
    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const start = Date.now();

    console.log(`--- Starting Evaluation [ID: ${runId}] ---`);

    const before = {
        tests: runTests('test-before'),
        metrics: {}
    };

    const after = {
        tests: runTests('test-after'),
        metrics: {}
    };

    const finishedAt = new Date().toISOString();
    const durationSeconds = (Date.now() - start) / 1000;

    const comparison = {
        passed_gate: after.tests.passed,
        improvement_summary: after.tests.passed && !before.tests.passed
            ? "Successfully implemented coupon system. After implementation passes all tests while baseline fails."
            : "Implementation verification result recorded."
    };

    const report = {
        run_id: runId,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: durationSeconds,
        environment: environmentInfo(),
        before: before,
        after: after,
        comparison: comparison,
        success: comparison.passed_gate,
        error: null
    };

    return report;
}

async function main() {
    try {
        if (!fs.existsSync(REPORTS)) {
            fs.mkdirSync(REPORTS, { recursive: true });
        }

        const report = await runEvaluation();
        const outputPath = path.join(REPORTS, 'latest.json');
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

        console.log(`\nReport written to ${outputPath}`);
        console.log(`Success: ${report.success}`);

        process.exit(report.success ? 0 : 1);
    } catch (err) {
        console.error('Fatal evaluation error:', err);
        const errorReport = {
            success: false,
            error: err.message
        };
        fs.writeFileSync(path.join(REPORTS, 'latest.json'), JSON.stringify(errorReport, null, 2));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
