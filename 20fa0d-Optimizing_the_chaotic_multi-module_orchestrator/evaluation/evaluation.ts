import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

function generateRunId(): string {
    return Math.random().toString(16).slice(2, 10);
}

function getGitInfo(projectRoot: string) {
    const info = { git_commit: 'unknown', git_branch: 'unknown' };
    try {
        const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', timeout: 5000 });
        if (rev.status === 0 && rev.stdout) info.git_commit = rev.stdout.trim().slice(0, 8);
    } catch { }
    try {
        const br = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', timeout: 5000 });
        if (br.status === 0 && br.stdout) info.git_branch = br.stdout.trim();
    } catch { }
    return info;
}

function getEnvironmentInfo(projectRoot: string) {
    const git = getGitInfo(projectRoot);
    return {
        node_version: process.version,
        platform: os.platform(),
        os: os.type(),
        os_release: os.release(),
        architecture: os.arch(),
        hostname: os.hostname(),
        git_commit: git.git_commit,
        git_branch: git.git_branch,
    };
}

function runPlaywrightTests(testFile: string, label: string, projectRoot: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`RUNNING TESTS: ${label.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log(`Test File: ${testFile}`);

    const testsPath = path.join(projectRoot, 'tests');
    const testFilePath = path.join(testsPath, testFile);

    // Verify test file exists
    if (!fs.existsSync(testFilePath)) {
        console.error(`❌ Test file not found: ${testFilePath}`);
        return {
            success: false,
            exit_code: -1,
            tests: [],
            summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0 },
            stdout: '',
            stderr: `Test file not found: ${testFilePath}`,
        };
    }

    try {
        const args = [
            'playwright',
            'test',
            testFile,
            '--reporter=list'
        ];

        // Run from tests directory
        const res = spawnSync('npx', args, {
            cwd: testsPath,
            env: process.env,
            encoding: 'utf8',
            timeout: 180000 // 3 minutes
        });

        const stdout = res.stdout || '';
        const stderr = res.stderr || '';
        const out = (stdout + '\n' + stderr).trim();

        let passed = 0, failed = 0, skipped = 0, total = 0;

        // Parse Playwright output
        // Look for "X passed" and "X failed" lines
        const passedMatch = /([0-9]+) passed/.exec(out);
        const failedMatch = /([0-9]+) failed/.exec(out);
        const skippedMatch = /([0-9]+) skipped/.exec(out);

        passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
        failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
        skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
        total = passed + failed + skipped;

        // Parse individual test results
        const tests = [];
        const testLines = out.split('\n').filter(line => 
            line.includes('›') || line.includes('✓') || line.includes('✘')
        );

        for (const line of testLines) {
            const isPassed = line.includes('✓') || line.includes('passed');
            const isFailed = line.includes('✘') || line.includes('failed');

            if (isPassed || isFailed) {
                // Extract test name
                const nameMatch = /› (.+?)(?:\s+\(|$)/.exec(line);
                const name = nameMatch ? nameMatch[1].trim() : line.trim();

                tests.push({
                    name,
                    status: isPassed ? 'passed' : 'failed',
                    duration_ms: 0
                });
            }
        }

        console.log(`\nResults: ${passed} passed, ${failed} failed, 0 errors, ${skipped} skipped (total: ${total})`);

        return {
            success: res.status === 0,
            exit_code: res.status ?? -1,
            tests,
            summary: { total, passed, failed, errors: 0, skipped },
            stdout: stdout.length > 5000 ? stdout.slice(-5000) : stdout,
            stderr: stderr.length > 2000 ? stderr.slice(-2000) : stderr,
        };
    } catch (e) {
        console.error('Error running Playwright tests:', e);
        return {
            success: false,
            exit_code: -1,
            tests: [],
            summary: { total: 0, passed: 0, failed: 0, errors: 1, skipped: 0, error: String(e) },
            stdout: '',
            stderr: String(e)
        };
    }
}

function generateOutputPath(projectRoot: string) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const outDir = path.join(projectRoot, 'evaluation', dateStr, timeStr);
    fs.mkdirSync(outDir, { recursive: true });
    return path.join(outDir, 'report.json');
}

function categorizeFailures(tests: any[]) {
    const categories = {
        memory_leaks: [] as string[],
        inefficient_code: [] as string[],
        missing_features: [] as string[],
        type_safety: [] as string[],
        code_quality: [] as string[],
        performance: [] as string[],
        other: [] as string[]
    };

    for (const test of tests) {
        if (test.status !== 'failed') continue;

        const name = test.name.toLowerCase();
        if (name.includes('memory') || name.includes('leak')) {
            categories.memory_leaks.push(test.name);
        } else if (name.includes('json.parse') || name.includes('stringify')) {
            categories.inefficient_code.push(test.name);
        } else if (name.includes('pipeline') || name.includes('cancel') || name.includes('debounce')) {
            categories.missing_features.push(test.name);
        } else if (name.includes('typescript') || name.includes('strict')) {
            categories.type_safety.push(test.name);
        } else if (name.includes('utility') || name.includes('clear names')) {
            categories.code_quality.push(test.name);
        } else if (name.includes('performance') || name.includes('optimized') || name.includes('render')) {
            categories.performance.push(test.name);
        } else {
            categories.other.push(test.name);
        }
    }

    return categories;
}

function evaluation() {
    console.log('\n' + '='.repeat(60));
    console.log('CHAOTIC COMPONENT REFACTORING EVALUATION');
    console.log('='.repeat(60));

    const projectRoot = path.resolve(process.cwd());
    const startTime = Date.now();

    // Run tests for both versions
    const beforeResults = runPlaywrightTests('test_before.spec.js', 'before (repository_before)', projectRoot);
    const afterResults = runPlaywrightTests('test_after.spec.js', 'after (repository_after)', projectRoot);

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    const comparison = {
        before_tests_passed: Boolean(beforeResults.success),
        after_tests_passed: Boolean(afterResults.success),
        before_total: beforeResults.summary?.total ?? 0,
        before_passed: beforeResults.summary?.passed ?? 0,
        before_failed: beforeResults.summary?.failed ?? 0,
        before_skipped: beforeResults.summary?.skipped ?? 0,
        after_total: afterResults.summary?.total ?? 0,
        after_passed: afterResults.summary?.passed ?? 0,
        after_failed: afterResults.summary?.failed ?? 0,
        after_skipped: afterResults.summary?.skipped ?? 0,
    };

    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION SUMMARY');
    console.log('='.repeat(60));

    console.log('\nBefore Implementation (repository_before):');
    console.log(`  Overall: ${beforeResults.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Tests: ${comparison.before_passed}/${comparison.before_total} passed`);
    if (comparison.before_failed > 0) {
        console.log(`  Failed: ${comparison.before_failed}`);
    }
    if (comparison.before_skipped > 0) {
        console.log(`  Skipped: ${comparison.before_skipped}`);
    }

    console.log('\nAfter Implementation (repository_after):');
    console.log(`  Overall: ${afterResults.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Tests: ${comparison.after_passed}/${comparison.after_total} passed`);
    if (comparison.after_failed > 0) {
        console.log(`  Failed: ${comparison.after_failed}`);
    }
    if (comparison.after_skipped > 0) {
        console.log(`  Skipped: ${comparison.after_skipped}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('REFACTORING VALIDATION');
    console.log('='.repeat(60));

    // Analyze what issues were fixed
    const beforeCategories = categorizeFailures(beforeResults.tests);
    const afterCategories = categorizeFailures(afterResults.tests);

    const issuesFixed = comparison.before_failed - comparison.after_failed;
    const issuesRemaining = comparison.after_failed;

    if (afterResults.success && comparison.before_failed > 0) {
        console.log('✅ SUCCESS: Refactoring fixed all issues!');
        console.log(`   ${issuesFixed} issue(s) resolved`);
    } else if (comparison.after_failed < comparison.before_failed) {
        console.log('✅ IMPROVEMENT: Refactoring fixed some issues');
        console.log(`   ${issuesFixed} issue(s) resolved`);
        console.log(`   ${issuesRemaining} issue(s) remaining`);
    } else if (afterResults.success && comparison.before_failed === 0) {
        console.log('⚠️  Both implementations pass - refactoring maintained quality');
    } else {
        console.log('❌ CONCERN: Refactoring did not improve test results');
    }

    // Calculate improvement metrics
    if (comparison.before_total > 0) {
        const beforePassRate = (comparison.before_passed / comparison.before_total) * 100;
        const afterPassRate = (comparison.after_passed / comparison.after_total) * 100;
        const improvement = afterPassRate - beforePassRate;

        console.log('\n' + '='.repeat(60));
        console.log('IMPROVEMENT METRICS');
        console.log('='.repeat(60));
        console.log(`Before: ${beforePassRate.toFixed(1)}% pass rate (${comparison.before_passed}/${comparison.before_total})`);
        console.log(`After:  ${afterPassRate.toFixed(1)}% pass rate (${comparison.after_passed}/${comparison.after_total})`);
        console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);

        if (comparison.before_failed > 0) {
            const fixRate = ((issuesFixed / comparison.before_failed) * 100);
            console.log(`\nIssue Fix Rate: ${fixRate.toFixed(1)}% (${issuesFixed}/${comparison.before_failed} issues resolved)`);
        }
    }

    // Show what was fixed by category
    if (comparison.before_failed > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('ISSUES FIXED BY CATEGORY');
        console.log('='.repeat(60));

        const categoriesNames = Object.keys(beforeCategories);
        for (const cat of categoriesNames) {
            const beforeCount = beforeCategories[cat].length;
            const afterCount = afterCategories[cat].length;
            const fixed = beforeCount - afterCount;

            if (beforeCount > 0) {
                const catName = cat.replace(/_/g, ' ').toUpperCase();
                const status = afterCount === 0 ? '✅' : fixed > 0 ? '⚠️' : '❌';
                console.log(`${status} ${catName}: ${beforeCount} → ${afterCount} (${fixed} fixed)`);

                if (afterCount === 0 && beforeCount > 0) {
                    console.log(`   All ${beforeCount} issue(s) resolved!`);
                }
            }
        }
    }

    // Show remaining issues if any
    if (comparison.after_failed > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('REMAINING ISSUES');
        console.log('='.repeat(60));

        const failedTests = afterResults.tests.filter(t => t.status === 'failed');
        for (let i = 0; i < failedTests.length && i < 5; i++) {
            console.log(`  ${i + 1}. ${failedTests[i].name}`);
        }
        if (failedTests.length > 5) {
            console.log(`  ... and ${failedTests.length - 5} more`);
        }
    }

    const startedAt = new Date(startTime).toISOString();
    const finishedAt = new Date(endTime).toISOString();

    const report = {
        run_id: generateRunId(),
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: Math.round(durationSeconds * 100) / 100,
        success: Boolean(afterResults.success),
        error: Boolean(afterResults.success) ? null : 'After implementation tests failed',
        environment: getEnvironmentInfo(projectRoot),
        results: { 
            before: beforeResults, 
            after: afterResults, 
            comparison,
            issues_fixed: issuesFixed,
            issues_remaining: issuesRemaining,
            before_categories: beforeCategories,
            after_categories: afterCategories
        },
    };

    const outPath = generateOutputPath(projectRoot);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), { encoding: 'utf8' });
    console.log(`\n✅ Detailed report saved to: ${outPath}`);
    console.log(`   Duration: ${durationSeconds.toFixed(1)}s`);

    return report.success ? 0 : 1;
}

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
const scriptPath = path.resolve(process.cwd(), 'evaluation', 'evaluation.ts');
if (entryFile && (entryFile === scriptPath || entryFile.endsWith('evaluation.js'))) {
    const code = evaluation();
    process.exit(code);
}

export { evaluation };