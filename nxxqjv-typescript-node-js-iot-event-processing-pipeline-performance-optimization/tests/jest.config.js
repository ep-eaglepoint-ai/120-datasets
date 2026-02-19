/** @type {import('jest').Config} */
const isBefore = process.env.TEST_TARGET === 'before';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: isBefore
    ? ['/node_modules/']
    : ['/node_modules/', '<rootDir>/tests/before/', '<rootDir>/tests/before_tests/'],
  modulePathIgnorePatterns: ['<rootDir>/repository_after/dist'],
  collectCoverageFrom: [
    'repository_after/src/**/*.ts',
    '!repository_after/src/**/*.d.ts',
    '!repository_after/src/largePayloadHandler.ts',
  ],
  moduleNameMapper: isBefore
    ? { '^(.+)repository_after[/\\\\]src[/\\\\](.+)$': '<rootDir>/repository_before/$2' }
    : {},
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testTimeout: 15000,
};
