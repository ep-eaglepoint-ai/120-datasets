module.exports = {
  verbose: true,
  projects: [
    {
      displayName: "SERVER",
      testEnvironment: "node",
      testMatch: ["<rootDir>/server/integration/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@server/(.*)$": "<rootDir>/../server/src/$1",
      },
      setupFiles: ["<rootDir>/setup-server.ts"],
    },
    {
      displayName: "CLIENT",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/client/integration/**/*.test.tsx"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
      },
      moduleNameMapper: {
        "^@client/(.*)$": "<rootDir>/../client/src/$1",
        "\\.(css|less|scss)$": "<rootDir>/../client/mocks/styleMock.js",
      },
      setupFilesAfterEnv: ["<rootDir>/setup-client.ts"],
    },
  ],
};
