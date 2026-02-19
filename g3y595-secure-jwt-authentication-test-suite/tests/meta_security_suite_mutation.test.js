const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

jest.setTimeout(60_000);

function readOriginalAppSource() {
  const repoRoot = path.resolve(__dirname, "..");
  const originalAppPath = path.join(
    repoRoot,
    "repository_before",
    "src",
    "App.tsx"
  );
  return fs.readFileSync(originalAppPath, "utf8");
}

function applyMutationOrThrow(name, source, mutated) {
  if (mutated === source) {
    throw new Error(
      `Meta test failed to apply mutation (${name}); regex did not match source.`
    );
  }
  return mutated;
}

function runRealSuiteWithMutatedApp(mutatedSource) {
  const repoRoot = path.resolve(__dirname, "..");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mutated-app-"));
  const mutatedAppPath = path.join(tmpDir, "App.mutated.tsx");
  fs.writeFileSync(mutatedAppPath, mutatedSource, "utf8");

  const jestBin = path.join(
    repoRoot,
    "repository_after",
    "node_modules",
    "jest",
    "bin",
    "jest.js"
  );

  return spawnSync(
    process.execPath,
    [
      jestBin,
      "--config",
      path.join(repoRoot, "repository_after", "jest.config.cjs"),
      "--runInBand",
    ],
    {
      cwd: path.join(repoRoot, "repository_after"),
      env: {
        ...process.env,
        APP_MODULE_PATH: mutatedAppPath,
      },
      encoding: "utf8",
    }
  );
}

describe("Meta: mutation-style strength checks", () => {
  test("mutation: theft detection disabled should be caught", () => {
    // Meta Test: validates theft-detection coverage
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "theft-detection",
      originalSource,
      originalSource.replace(
        /if \(tokenData\.isRevoked\) \{[\s\S]*?throw new Error\(["']Token reuse detected\. All sessions invalidated\.["']\);\s*\}/m,
        "if (tokenData.isRevoked) {\n      // MUTATION: theft detection disabled\n    }"
      )
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });

  test("mutation: proactive refresh disabled should be caught", () => {
    // Meta Test: validates proactive refresh + concurrent refresh tests
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "proactive-refresh-threshold",
      originalSource,
      originalSource.replace(
        /this\.tokens\s*&&\s*this\.tokens\.expiresAt\s*-\s*Date\.now\(\)\s*<\s*60000/g,
        "this.tokens && this.tokens.expiresAt - Date.now() < 0"
      )
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });

  test("mutation: 401 queue/retry disabled should be caught", () => {
    // Meta Test: validates request queue + retry coverage
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "queueing-disabled",
      originalSource,
      originalSource.replace(
        /if \(error\.status === 401 && !config\.data\?\._retry\) \{/g,
        "if (false) {"
      )
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });

  test("mutation: protected route bypass should be caught", () => {
    // Meta Test: validates protected route unauthenticated behavior
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "protected-route-bypass",
      originalSource,
      originalSource.replace(
        /if \(!isAuthenticated\) \{\s*return <LoginForm \/>;\s*\}/m,
        "// MUTATION: bypass auth\n  if (!isAuthenticated) {\n    return <>{children}</>;\n  }"
      )
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });

  test("mutation: demo credentials removed should be caught", () => {
    // Meta Test: validates login demo credential UI coverage
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "demo-credentials-removed",
      originalSource,
      originalSource.replace(/Demo Credentials:/g, "Demo Creds Removed")
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });

  test("mutation: logout does not clear user should be caught", () => {
    // Meta Test: validates logout clears user state
    const originalSource = readOriginalAppSource();
    const mutated = applyMutationOrThrow(
      "logout-does-not-clear-user",
      originalSource,
      originalSource.replace(
        /setUser\(null\);/g,
        "// MUTATION: user not cleared\n      // setUser(null);"
      )
    );

    const run = runRealSuiteWithMutatedApp(mutated);
    expect(run.status).not.toBe(0);
  });
});
