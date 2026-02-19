const repoPath = process.env.REPO_PATH || 'repository_after';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  injectGlobals: true,
  rootDir: '..',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      }
    ]
  },
  moduleNameMapper: {
    '^#models/(.*)$': `<rootDir>/${repoPath}/app/models/$1`,
    '^#services/(.*)$': `<rootDir>/${repoPath}/app/services/$1`,
    '^#middleware/(.*)$': `<rootDir>/${repoPath}/app/middleware/$1`,
    '^#policies/(.*)$': `<rootDir>/${repoPath}/app/policies/$1`,
    '^#controllers/(.*)$': `<rootDir>/${repoPath}/app/controllers/$1`,
    '^#config/(.*)$': `<rootDir>/${repoPath}/config/$1`
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'repository_after/app/**/*.ts',
    'repository_before/app/**/*.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000
};
