// Basic jest setup
const fs = require('node:fs');
const path = require('node:path');

process.env.SESSION_SECRET = 'test-secret-1234567890-test-secret';

// Clear test data directory
const dataDir = path.join(__dirname, 'repository_after', 'data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

const mockCookiesStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookiesStore)),
}));

// Export globally for tests to check calls
global.mockCookiesStore = mockCookiesStore;

// Polyfill for Request/Response
if (typeof Request === 'undefined') {
  const { Request, Response, Headers } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
}
