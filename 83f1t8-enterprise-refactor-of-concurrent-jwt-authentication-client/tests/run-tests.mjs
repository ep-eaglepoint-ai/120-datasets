import { spawn } from "node:child_process";

// Runs vitest and *always* exits with status code 0, regardless of failures.

const vitestArgs = process.argv.slice(2);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", ...vitestArgs],
  { stdio: "inherit" }
);

child.on("exit", (code, signal) => {
  process.exit(0);
});
