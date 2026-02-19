// Jest setup file
// This file runs before each test file
require('@testing-library/jest-dom');

// Set test environment variables
process.env.NODE_ENV = 'test';

// Next.js router mock (same behavior as jest.setup.ts)
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    asPath: '',
  })),
}));
