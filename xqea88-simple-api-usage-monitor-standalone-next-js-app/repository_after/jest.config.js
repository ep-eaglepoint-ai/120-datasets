const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>', '<rootDir>/../tests'],
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
}

module.exports = createJestConfig(customJestConfig)
