const path = require("path");

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: path.resolve(__dirname, "..", "repository_before"),
  testMatch: ["<rootDir>/**/*.test.(ts|tsx|js|jsx)"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
