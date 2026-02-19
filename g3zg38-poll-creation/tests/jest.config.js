/** Jest config for poll-creation: runs tests in tests/ against repository_after */
const path = require('path');

const rootDir = path.join(__dirname, '..');

module.exports = {
  rootDir,
  preset: 'ts-jest',
  setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.ts')],
  testMatch: [
    '<rootDir>/tests/backend/**/*.test.ts',
    '<rootDir>/tests/ui/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/repository_after/client/src/$1',
  },
  testTimeout: 120000,
  projects: [
    {
      displayName: 'node',
      rootDir,
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.ts')],
      testMatch: ['<rootDir>/tests/backend/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/repository_after/client/src/$1',
        '^nanoid$': '<rootDir>/tests/__mocks__/nanoid.js',
      },
    },
    {
      displayName: 'jsdom',
      rootDir,
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [path.join(__dirname, 'jest.setup.ts')],
      testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/repository_after/client/src/$1',
      },
    },
  ],
};
