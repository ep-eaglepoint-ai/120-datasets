module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/repository_after/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  moduleDirectories: ['node_modules', '<rootDir>'],
  collectCoverageFrom: [
    'repository_after/src/**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts'
  ]
};