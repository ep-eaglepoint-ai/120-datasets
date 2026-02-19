const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './repository_after',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/repository_after/src/$1',
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'repository_after/src/**/*.{js,jsx,ts,tsx}',
    '!repository_after/src/**/*.d.ts',
    '!repository_after/src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testTimeout: 120000,
};

const baseExport = createJestConfig(customJestConfig);

module.exports = async () => {
  const base = await (typeof baseExport === 'function' ? baseExport() : baseExport);
  const { testTimeout, ...baseRest } = base;
  return {
    ...base,
    testTimeout: testTimeout ?? 120000,
    projects: [
      {
        ...baseRest,
        displayName: 'node',
        testEnvironment: 'node',
        testMatch: [
          '<rootDir>/tests/analytics.test.ts',
          '<rootDir>/tests/db.test.ts',
          '<rootDir>/tests/reminder.test.ts',
          '<rootDir>/tests/sessions.test.ts',
          '<rootDir>/tests/subjects.test.ts',
          '<rootDir>/tests/validation.test.ts',
        ],
      },
      {
        ...baseRest,
        displayName: 'jsdom',
        testEnvironment: 'jsdom',
        testMatch: [
          '<rootDir>/tests/offline-manager.test.ts',
          '<rootDir>/tests/ui/**/*.test.tsx',
        ],
      },
    ],
  };
};
