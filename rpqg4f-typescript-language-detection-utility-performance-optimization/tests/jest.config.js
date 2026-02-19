// Unified Jest config that handles both repository_before and repository_after
// Uses environment variable TEST_IMPL to switch between implementations
const testImpl = process.env.TEST_IMPL || 'after';
const implPath = testImpl === 'before' 
  ? '<rootDir>/repository_before/src/languageDetection.ts'
  : '<rootDir>/repository_after/src/languageDetection.ts';

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@impl/languageDetection$': implPath,
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          esModuleInterop: true,
          module: 'ESNext',
          moduleResolution: 'node',
          target: 'ES2020',
          paths: {
            '@impl/languageDetection': [testImpl === 'before' 
              ? './repository_before/src/languageDetection.ts'
              : './repository_after/src/languageDetection.ts']
          },
          baseUrl: '.'
        },
      },
    ],
  },
  rootDir: '..',
  testMatch: ['<rootDir>/tests/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
