import '@testing-library/jest-dom'

// Suppress console.error for expected error cases in tests
// Individual tests can override this if they need to verify error messages
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});
