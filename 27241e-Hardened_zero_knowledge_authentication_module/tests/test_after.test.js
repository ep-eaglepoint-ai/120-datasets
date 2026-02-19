const path = require("path");
const { runUniversalTests } = require("./test_shared");

const modulePath = path.join(__dirname, "../repository_after/index.js");

beforeEach(() => {
  jest.resetModules();
});

const authModule = require("../repository_after/index.js");

runUniversalTests({ authModule, modulePath });
