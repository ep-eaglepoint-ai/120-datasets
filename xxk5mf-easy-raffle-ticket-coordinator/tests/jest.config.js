/** Plain Jest (no Next.js). Two projects: node (backend) and jsdom (UI). Config lives in tests/ (subfolder-specific). */
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const setupPath = path.resolve(__dirname, 'jest.setup.js');

module.exports = {
  rootDir: projectRoot,
  roots: ['<rootDir>/tests', '<rootDir>'],
  setupFilesAfterEnv: [setupPath],
  testEnvironment: 'node',
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/repository_after/src/$1',
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'repository_after/server/**/*.ts',
    'repository_after/client/src/**/*.{ts,tsx}',
    '!repository_after/**/*.d.ts',
  ],
  testTimeout: 120000,
  projects: [
    {
      displayName: 'node',
      rootDir: projectRoot,
      testEnvironment: 'node',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/repository_after/src/$1' },
      setupFilesAfterEnv: [setupPath],
    },
    {
      displayName: 'jsdom',
      rootDir: projectRoot,
      testEnvironment: 'jsdom',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/repository_after/src/$1' },
      setupFilesAfterEnv: [setupPath],
    },
  ],
};
