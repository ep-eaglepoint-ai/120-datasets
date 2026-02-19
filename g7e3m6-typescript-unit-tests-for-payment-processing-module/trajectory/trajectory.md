# Trajectory: Payment Processing Test Suite

## Analysis

The task requires writing comprehensive unit tests for an existing TypeScript payment processing module that handles Stripe and PayPal transactions. The module consists of 5 services in `repository_before/`:

- **PaymentService**: Stripe charges, PayPal orders, currency conversion, idempotency handling
- **RefundService**: Full/partial refunds, validation, status tracking
- **SubscriptionService**: Create, upgrade/downgrade, cancel, trial periods, failed payment retry
- **WebhookHandler**: Signature verification, event dispatch, duplicate detection
- **PayPalClient**: OAuth token management, order creation, capture

Key requirements identified from the 25-point specification:
1. Mock all external APIs (Stripe SDK, PayPal fetch calls) - no real network traffic
2. Test success and failure scenarios for each public method
3. Cover edge cases: idempotency, amount validation, refund limits, webhook tampering
4. Achieve 90%+ code coverage (branches, functions, lines, statements)
5. Tests must be deterministic (mock Date.now), isolated (beforeEach reset), non-flaky
6. Separate test file per service with descriptive "should...when" naming

## Strategy

**Testing Approach**: Unit tests with dependency injection via mocks rather than integration tests.

**Why this pattern**:
- Payment code is critical; need fast, reliable feedback without hitting real APIs
- Mocking at SDK boundary allows testing all error paths (declined cards, network timeouts)
- Coverage thresholds enforce discipline for payment-related code
- Deterministic tests prevent flaky CI failures

**Mocking Strategy**:
- Stripe: `jest.mock('stripe')` with mock implementation per test via `beforeEach`
- PayPal: `global.fetch = jest.fn()` to intercept HTTP calls
- Time: `jest.spyOn(Date, 'now')` for webhook timestamp validation

**File Structure**:
- Tests in `repository_after/src/` import from `repository_before/src/`
- This separation allows meta-tests to verify "before has no tests, after has tests"
- `__mocks__/stripe.ts` provides default stub, overridden in each test

## Execution

1. **Setup Jest configuration** (`repository_after/jest.config.js`):
   - ts-jest preset for TypeScript
   - moduleNameMapper to resolve Stripe mock
   - coverageThreshold at 90% for all metrics
   - setupFilesAfterEnv for global fetch mock

2. **Create Stripe mock** (`repository_after/__mocks__/stripe.ts`):
   - Stub all SDK methods (paymentIntents, refunds, subscriptions, webhooks)
   - Tests override behavior via `jest.mock()` + `mockImplementation()`

3. **Create jest-setup.ts** (`repository_after/src/test-utils/`):
   - Global fetch mock to prevent real HTTP calls
   - `beforeEach` to clear/restore all mocks between tests

4. **Implement test files** (one per service):
   - `payment-service.test.ts`: 18 tests covering charge success, card errors, timeout, idempotency, PayPal flow
   - `refund-service.test.ts`: 11 tests covering partial/full refunds, validation errors, status retrieval
   - `subscription-service.test.ts`: 10 tests covering trial, plan change, proration, cancel modes, retry logic
   - `webhook-handler.test.ts`: 11 tests covering signature verification, duplicate events, handler dispatch
   - `paypal-client.test.ts`: 8 tests covering token caching, order creation, capture, error handling

5. **Add requirement traceability**:
   - Comments like `// Req 7: Idempotency key behavior` link tests to requirements
   - Meta-tests in `tests/meta-requirements.test.ts` validate structure and patterns

6. **Verify coverage and determinism**:
   - Run Jest with `--coverage` to confirm 90%+ on all metrics
   - Run `test-stability.js` script 5x to confirm no flaky tests

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started) - Mocking, coverage, configuration
- [ts-jest](https://kulshekhar.github.io/ts-jest/) - TypeScript integration with Jest
- [Stripe API Reference](https://stripe.com/docs/api) - PaymentIntents, Refunds, Subscriptions, Webhooks
- [Stripe Webhook Signatures](https://stripe.com/docs/webhooks/signatures) - HMAC verification algorithm
- [PayPal REST API](https://developer.paypal.com/docs/api/orders/v2/) - OAuth2, Orders, Capture
