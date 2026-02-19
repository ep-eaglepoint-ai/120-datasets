module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: ['**/*.test.ts'],
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  moduleNameMapper: {
    '^stripe$': '<rootDir>/__mocks__/stripe.ts',
  },
  collectCoverageFrom: [
    '../repository_before/src/**/*.ts',
    '!../repository_before/src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/jest-setup.ts'],
  // Req 24: Ensure full suite completes within 10 seconds
  testTimeout: 10000,
};
