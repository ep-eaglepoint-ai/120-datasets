const path = require('path');
const nextJest = require('next/jest');

const projectRoot = path.join(__dirname, '..');

const createJestConfig = nextJest({
  dir: path.join(projectRoot, 'repository_after'),
});

const customJestConfig = {
  rootDir: projectRoot,
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testEnvironment: 'jsdom',
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
};

const baseExport = createJestConfig(customJestConfig);

module.exports = async () => (typeof baseExport === 'function' ? baseExport() : baseExport);
