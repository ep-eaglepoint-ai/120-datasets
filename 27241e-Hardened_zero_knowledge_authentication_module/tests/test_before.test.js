const path = require("path");
const { runUniversalTests } = require("./test_shared");

const modulePath = path.join(__dirname, "../repository_before/index.js");

// Load normally (CommonJS). Jest isolates test files; we also reset modules below for safety.
beforeEach(() => {
  jest.resetModules();
});

const authModule = require("../repository_before/index.js");

// Run requirements-driven tests.
// Expected: legacy implementation FAILS multiple security requirements.
runUniversalTests({ authModule, modulePath });
