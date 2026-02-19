const path = require("path");

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: path.resolve(__dirname, ".."),
  testMatch: [
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/tests/**/*.test.tsx",
  ],
  // Keep this meta runner minimal; it only runs the meta test file.
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
