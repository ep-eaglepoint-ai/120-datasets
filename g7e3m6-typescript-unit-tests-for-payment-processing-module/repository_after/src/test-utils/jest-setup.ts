// Global Jest setup for deterministic tests and isolated external APIs
// Req 19: Date-related behavior is explicitly mocked in tests
// Req 1,2,58: Ensure Stripe SDK and PayPal HTTP calls are always mocked

// Use globalThis to avoid redeclaring Node's global in TypeScript.
const g: any = globalThis as any;

// Default fetch mock so no real HTTP calls are ever made in tests.
if (!g.fetch) {
  g.fetch = jest.fn();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();

  // Reset fetch between tests to keep isolation; individual tests can override behavior.
  if (g.fetch) {
    g.fetch = jest.fn();
  }
});

