/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>", "<rootDir>/../tests"],
  testMatch: ["<rootDir>/**/*.test.(ts|tsx|js)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  modulePaths: ["<rootDir>/node_modules"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
