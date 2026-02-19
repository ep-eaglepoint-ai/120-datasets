import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_REPO = process.env.REPO_PATH || 'repository_after';
const TARGET_DIR = path.join(ROOT_DIR, TARGET_REPO);
const TEST_SRC_DIR = path.join(TARGET_DIR, 'src');

function readFileText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function listTestFiles(): string[] {
  if (!fs.existsSync(TEST_SRC_DIR)) {
    return [];
  }
  const entries = fs.readdirSync(TEST_SRC_DIR);
  return entries
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => path.join(TEST_SRC_DIR, name));
}

describe(`Meta requirements for payment processing test suite (${process.env.REPO_PATH || 'repository_after'})`, () => {
  const testFiles = listTestFiles();

  if (TARGET_REPO === 'repository_before') {
  
    it('Meta::repository_before_has_tests', () => {
      console.error(
        `Meta::repository_before_has_tests::FAILED - expected at least 1 Jest test file in ${TARGET_REPO}/src, found ${testFiles.length}.`,
      );
      expect(testFiles.length).toBeGreaterThan(0);
    });
    return;
  }

  const concatenatedTests = testFiles
    .map((file) => readFileText(file))
    .join('\n');

  it('should have all required per-service test files present (Req 21)', () => {
    const expectedFiles = [
      'payment-service.test.ts',
      'refund-service.test.ts',
      'subscription-service.test.ts',
      'webhook-handler.test.ts',
      'paypal-client.test.ts',
    ];

    const present = new Set(testFiles.map((p) => path.basename(p)));

    for (const file of expectedFiles) {
      expect(present.has(file)).toBeTruthy();
    }
  });

  it('should use descriptive Jest test names (Req 22)', () => {
    for (const file of testFiles) {
      const content = readFileText(file);
      const hasDescriptiveNames = /it\(['"]should [^'"]+['"]/.test(content);
      expect(hasDescriptiveNames).toBeTruthy();
    }
  });

  it('should enforce 90%+ global coverage thresholds in Jest config (Req 18, 23, 50)', () => {
    const jestConfigPath = path.join(TARGET_DIR, 'jest.config.js');
    const jestConfigSource = readFileText(jestConfigPath);

    expect(jestConfigSource).toContain('coverageThreshold');
    expect(jestConfigSource).toContain('branches: 90');
    expect(jestConfigSource).toContain('functions: 90');
    expect(jestConfigSource).toContain('lines: 90');
    expect(jestConfigSource).toContain('statements: 90');
  });

  it('should ensure Stripe and PayPal are always mocked and never used as real SDK instances (Req 1, 2, 58)', () => {
    expect(concatenatedTests).toContain(`jest.mock('stripe'`);
    expect(concatenatedTests).toContain(`jest.mock('../../repository_before/src/paypal-client'`);

    const forbiddenStripeInstantiation = /new\s+Stripe\s*\(/;
    expect(forbiddenStripeInstantiation.test(concatenatedTests)).toBeFalsy();
  });

  it('should ensure global fetch is mocked in Jest setup to avoid real HTTP calls (Req 2, 6, 58)', () => {
    const jestSetupPath = path.join(TEST_SRC_DIR, 'test-utils', 'jest-setup.ts');
    const jestSetupContent = readFileText(jestSetupPath);

    expect(jestSetupContent).toContain('fetch');
    expect(jestSetupContent).toContain('jest.fn()');
  });

  it('should ensure PayPalClient tests explicitly mock fetch and never hit network (Req 2, 6, 52, 58)', () => {
    const paypalTestPath = path.join(TEST_SRC_DIR, 'paypal-client.test.ts');
    const paypalTestContent = readFileText(paypalTestPath);

    expect(paypalTestContent).toContain('declare const global');
    expect(paypalTestContent).toContain('global.fetch = jest.fn()');
  });

  it('should not contain focused tests like describe.only / it.only / test.only (non-flaky suite)', () => {
    const hasFocused = /\.(only)\s*\(/.test(concatenatedTests);
    expect(hasFocused).toBeFalsy();
  });

  it('should mock Date.now in timestamp-dependent tests (Req 19)', () => {
    const webhookTestPath = path.join(TEST_SRC_DIR, 'webhook-handler.test.ts');
    const paypalTestPath = path.join(TEST_SRC_DIR, 'paypal-client.test.ts');

    const webhookContent = readFileText(webhookTestPath);
    const paypalContent = readFileText(paypalTestPath);

    expect(webhookContent).toContain(`jest.spyOn(Date, 'now')`);
    expect(paypalContent).toContain(`jest.spyOn(Date, 'now')`);
  });

  it('should only import implementations from repository_before, not repository_after', () => {
    const forbiddenImports = [
      "./payment-service'",
      './payment-service"',
      "./refund-service'",
      './refund-service"',
      "./subscription-service'",
      './subscription-service"',
      "./webhook-handler'",
      './webhook-handler"',
      "./paypal-client'",
      './paypal-client"',
    ];

    for (const token of forbiddenImports) {
      expect(concatenatedTests.includes(token)).toBeFalsy();
    }
  });

  it('should have a reasonable number of test cases per file', () => {
    for (const file of testFiles) {
      const content = readFileText(file);
      const itCount = (content.match(/\bit\(/g) || []).length;
      const testCount = (content.match(/\btest\(/g) || []).length;
      const total = itCount + testCount;

      expect(total).toBeGreaterThanOrEqual(5);
    }
  });

  it('should cover key Stripe behaviours in tests', () => {
    expect(concatenatedTests).toContain('paymentIntents.create');
    expect(concatenatedTests).toContain('refunds.create');
    expect(concatenatedTests).toContain('subscriptions.create');
    expect(concatenatedTests).toContain('subscriptions.update');
    expect(concatenatedTests).toContain('subscriptions.cancel');
    expect(concatenatedTests).toContain('webhooks.constructEvent');

    expect(concatenatedTests).toContain('StripeCardError');
    expect(concatenatedTests).toContain('StripeInvalidRequestError');
    expect(concatenatedTests).toContain('Request timed out');

    expect(concatenatedTests).toContain('idempotencyKey');
    expect(concatenatedTests).toContain('Duplicate transaction detected');
  });

  it('should cover key PayPal behaviours in tests', () => {
    expect(concatenatedTests).toContain('global.fetch = jest.fn()');
    expect(concatenatedTests).toContain('Failed to get PayPal access token');

    expect(concatenatedTests).toContain('Order creation failed');
    expect(concatenatedTests).toContain('Order error');
    expect(concatenatedTests).toContain('Capture failed');
    expect(concatenatedTests).toContain('Capture error');
  });

  it('should assert amount validation and refund edge cases', () => {
    expect(concatenatedTests).toContain('Amount must be greater than zero');
    expect(concatenatedTests).toContain('Amount exceeds maximum allowed');

    expect(concatenatedTests).toContain('Refund amount exceeds available amount');
    expect(concatenatedTests).toContain('Cannot refund a charge that has not succeeded');
    expect(concatenatedTests).toContain('Refund amount must be greater than zero');
  });

  it('should assert subscription lifecycle behaviours', () => {
    expect(concatenatedTests).toContain('trial_period_days');

    expect(concatenatedTests).toContain('proration_behavior');

    expect(concatenatedTests).toContain('cancel_at_period_end');

    expect(concatenatedTests).toContain('handleFailedPayment');
    expect(concatenatedTests).toContain('shouldRetry');
  });

  it('should assert webhook verification, idempotency and dispatch', () => {
    expect(concatenatedTests).toContain('verifySignature');
    expect(concatenatedTests).toContain('verifySignatureManual');
    expect(concatenatedTests).toContain('Invalid signature');
    expect(concatenatedTests).toContain('unknown event');
    expect(concatenatedTests).toContain('clearProcessedEvents');
  });

  it('should ensure tests are isolated and non-flaky', () => {
    for (const file of testFiles) {
      const content = readFileText(file);
      expect(content).toContain('beforeEach(');
    }

    const hasRandom = /Math\.random\s*\(/.test(concatenatedTests);
    const hasTimers =
      /setTimeout\s*\(/.test(concatenatedTests) || /setInterval\s*\(/.test(concatenatedTests);

    expect(hasRandom).toBeFalsy();
    expect(hasTimers).toBeFalsy();
  });
});


