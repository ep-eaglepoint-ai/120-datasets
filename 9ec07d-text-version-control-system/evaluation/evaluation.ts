import { runTests, TestResult } from "../tests/test_criteria";
import * as fs from "fs";
import * as path from "path";

// Define URLs for services in Docker Compose network
// Note: We expect 'app' and 'app-before' to be accessible by service name.
const REPO_AFTER_URL = "http://app:3000/api";
const REPO_BEFORE_URL = "http://app-before:3000/api";

interface Results {
  passed: number;
  failed: number;
  total: number;
  tests: { [key: string]: "PASSED" | "FAILED" };
  error: string | null;
}

async function runTestsForUrl(url: string, label: string): Promise<Results> {
  console.log(`\n🔍 Evaluating ${label}...`);
  const results: Results = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: {},
    error: null,
  };

  try {
    const testResults = await runTests(url);
    results.total = testResults.length;

    testResults.forEach((r) => {
      if (r.status === "PASSED") {
        results.passed++;
        results.tests[r.name] = "PASSED";
      } else {
        results.failed++;
        results.tests[r.name] = "FAILED";
      }
    });

    console.log(`   ✓ Passed: ${results.passed}`);
    console.log(`   ✗ Failed: ${results.failed}`);

    // If all failed, it might be a connection error, but runTests catches exceptions.
    // We can check if any error message indicates connection failure?
    // But for now, reporting individual failures is correct.
  } catch (e: any) {
    console.log(`   ⚠ Error: ${e.message}`);
    results.error = e.message;
  }

  return results;
}

function generateReport(
  beforeResults: Results,
  afterResults: Results,
  outputPath: string
) {
  const started_at = new Date();

  const report = {
    run_id: uuidv4(),
    started_at: started_at.toISOString(),
    finished_at: new Date().toISOString(),
    duration_seconds: 0,
    environment: {
      node_version: process.version,
      platform: `${process.platform}-${process.arch}`,
    },
    before: {
      tests: beforeResults.tests,
      metrics: {
        total: beforeResults.total,
        passed: beforeResults.passed,
        failed: beforeResults.failed,
      },
      error: beforeResults.error,
    },
    after: {
      tests: afterResults.tests,
      metrics: {
        total: afterResults.total,
        passed: afterResults.passed,
        failed: afterResults.failed,
      },
      error: afterResults.error,
    },
    comparison: {
      tests_fixed: [] as string[],
      tests_broken: [] as string[],
      improvement: 0,
    },
    success: false,
  };

  // Calculate comparison
  const tests = new Set([
    ...Object.keys(beforeResults.tests),
    ...Object.keys(afterResults.tests),
  ]);

  tests.forEach((test) => {
    const beforeStatus = beforeResults.tests[test] || "FAILED";
    const afterStatus = afterResults.tests[test] || "FAILED";

    if (beforeStatus === "FAILED" && afterStatus === "PASSED") {
      report.comparison.tests_fixed.push(test);
    } else if (beforeStatus === "PASSED" && afterStatus === "FAILED") {
      report.comparison.tests_broken.push(test);
    }
  });

  // Calculate improvement
  if (afterResults.total > 0) {
    const beforeRate =
      (beforeResults.passed / Math.max(beforeResults.total, 1)) * 100;
    const afterRate = (afterResults.passed / afterResults.total) * 100;
    report.comparison.improvement =
      Math.round((afterRate - beforeRate) * 100) / 100;
  }

  // Determine success (simplified rules for this context)
  report.success =
    afterResults.passed === afterResults.total &&
    afterResults.total > 0 &&
    afterResults.error === null;

  // Update duration
  report.finished_at = new Date().toISOString();
  report.duration_seconds =
    (new Date().getTime() - started_at.getTime()) / 1000;

  // Save report
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  return report;
}

// Minimal UUID implementation if not available in context (it is available in test_criteria, but let's be safe)
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("Text Version Control System Evaluation");
  console.log("=".repeat(60));

  const projectRoot = "/workspace"; // Mapped in docker-compose

  // Output path matching the reference
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const outputDir = path.join(
    projectRoot,
    "evaluation",
    "reports",
    dateStr,
    timeStr
  );
  const outputFile = path.join(outputDir, "report.json");

  console.log(`\n📄 Output: ${outputFile}\n`);

  // Run tests
  const beforeResults = await runTestsForUrl(
    REPO_BEFORE_URL,
    "repository_before (http://app-before:3000)"
  );
  const afterResults = await runTestsForUrl(
    REPO_AFTER_URL,
    "repository_after (http://app:3000)"
  );

  // Generate report
  console.log("\n📊 Generating report...");
  const report = generateReport(beforeResults, afterResults, outputFile);

  console.log(`   Report saved to: ${outputFile}`);
  console.log(`\n${"=".repeat(60)}`);
  console.log("EVALUATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Tests Fixed: ${report.comparison.tests_fixed.length}`);
  if (report.comparison.tests_fixed.length > 0) {
    report.comparison.tests_fixed.forEach((test) => {
      console.log(`  ✓ ${test}`);
    });
  }

  console.log(`\nTests Broken: ${report.comparison.tests_broken.length}`);
  if (report.comparison.tests_broken.length > 0) {
    report.comparison.tests_broken.forEach((test) => {
      console.log(`  ✗ ${test}`);
    });
  }

  console.log(`\nImprovement: ${report.comparison.improvement}%`);
  console.log(`Overall Success: ${report.success ? "✓ PASS" : "✗ FAIL"}`);
  console.log("=".repeat(60));

  process.exit(report.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
