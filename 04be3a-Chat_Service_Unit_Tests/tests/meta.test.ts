import { execSync } from "child_process";
import path from "path";
import fs from "fs";

describe("Meta-Test: Submission Validation", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const projectRoot = path.join(repoRoot, "repository_before");
  const submissionTestFile = path.join(
    repoRoot,
    "repository_after",
    "chatService.test.ts",
  );

  test("Submission file exists", () => {
    expect(fs.existsSync(submissionTestFile)).toBe(true);
  });

  test("Submission tests should pass and achieve 100% coverage", () => {
    try {
      // Run npm test from repository_after context
      const submissionDir = path.join(repoRoot, "repository_after");

      // Install dependencies first
      execSync("npm install", {
        cwd: submissionDir,
        encoding: "utf-8",
        stdio: "pipe",
      });

      const cmd = `npm test -- --colors=false`;

      const output = execSync(cmd, {
        cwd: submissionDir,
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, CI: "true" },
      });

      // Tests passed if execSync did not throw.
      // Jest prints "PASS" to stderr, which execSync returns only via exception or if we merged streams.
      // We process stdout for coverage data.

      // Find coverage table
      // Expecting something like:
      // All files      |      100 |      100 |      100 |      100 |
      const coverageLine = output
        .split("\n")
        .find((line) => line.includes("All files"));
      expect(coverageLine).toBeDefined();

      if (coverageLine) {
        const metrics = coverageLine
          .split("|")
          .map((s) => s.trim())
          .filter((s) => s && s !== "All files");

        // [Stmts, Branch, Funcs, Lines]
        const [stmts, branches, funcs, lines] = metrics;

        expect(parseFloat(stmts)).toBeGreaterThanOrEqual(100);
        expect(parseFloat(branches)).toBeGreaterThanOrEqual(100);
        expect(parseFloat(funcs)).toBeGreaterThanOrEqual(100);
        expect(parseFloat(lines)).toBeGreaterThanOrEqual(100);
      }
    } catch (error: any) {
      const stdout = error.stdout?.toString() || "";
      const stderr = error.stderr?.toString() || "";
      const message = error.message || "Unknown error";

      console.log("--- EXECUTION FAILED ---");
      console.log("Error Message:", message);
      if (stdout) console.log("STDOUT:", stdout);
      if (stderr) console.error("STDERR:", stderr);
      console.log("------------------------");

      throw new Error(
        `Tests failed execution. See console output for details.`,
      );
    }
  }, 60000);
});
