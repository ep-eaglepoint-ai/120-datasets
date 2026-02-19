#!/usr/bin/env node

const path = require("path");
const { runCartServiceTests } = require("./cartService.test");

async function main() {
  const repoRootFromEnv = process.env.TEST_REPO_PATH;
  const arg = process.argv[2];
  const repoName = arg === "before" ? "repository_before" : arg === "after" ? "repository_after" : null;
  const repoRoot = repoRootFromEnv || (repoName ? path.join(__dirname, "..", repoName) : null);

  if (!repoRoot) {
    console.error("Usage: TEST_REPO_PATH=/abs/path npm test  (or: node tests/test_all.js <before|after>)");
    return 2;
  }

  const results = await runCartServiceTests({ repoRoot });

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;

  for (const r of results) {
    if (r.ok) {
      console.log(`PASS ${r.name}`);
    } else {
      console.log(`FAIL ${r.name}`);
      console.log(String(r.err && r.err.stack ? r.err.stack : r.err));
    }
  }

  console.log("");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed.length}`);

  // Important: Always exit 0 so "before" checks don't hard-fail CI jobs.
  // The evaluation harness uses the printed counts to determine pass/fail.
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(1);
    }
  );
}

