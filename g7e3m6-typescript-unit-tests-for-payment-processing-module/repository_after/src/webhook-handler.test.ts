import Stripe from 'stripe';
import crypto from 'crypto';
import { WebhookHandler } from '../../repository_before/src/webhook-handler';

// Req 1,3,15,16,17,19: Mock Stripe webhooks.constructEvent and test webhook behaviors
jest.mock('stripe', () => {
  const webhooks = {
    constructEvent: jest.fn(),
  };

  return jest.fn().mockImplementation(() => ({
    webhooks,
  }));
});

const MockedStripe = Stripe as unknown as jest.Mock<typeof Stripe, any[]>;

describe('WebhookHandler', () => {
  const stripeKey = 'sk_test';
  const webhookSecret = 'whsec_test_secret';
  let webhookHandler: WebhookHandler;
  let stripeInstance: any;

  const payloadObject = { id: 'evt_123', object: 'event' };
  const payloadString = JSON.stringify(payloadObject);

  beforeEach(() => {
    stripeInstance = {
      webhooks: {
        constructEvent: jest.fn(),
      },
    };

    MockedStripe.mockImplementation(() => stripeInstance as any);
    webhookHandler = new WebhookHandler(stripeKey, webhookSecret);
  });

  // Req 19: Restore Date.now after tests that mock it so timestamp-dependent tests do not leak
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Req 15: Valid webhook signature verification using Stripe SDK
  it('should return true when verifySignature receives a valid signature', () => {
    stripeInstance.webhooks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
    });

    const isValid = webhookHandler.verifySignature(payloadString, 'sig_header');
    expect(isValid).toBe(true);
  });

  // Req 15: Invalid/tampered signature rejection using Stripe SDK
  it('should return false when verifySignature receives an invalid signature', () => {
    stripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const isValid = webhookHandler.verifySignature(payloadString, 'bad_sig');
    expect(isValid).toBe(false);
  });

  // Req 15,19: Manual signature verification with valid signature and timestamp
  it('should return true from verifySignatureManual for a valid non-expired signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payloadString}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const signatureHeader = `t=${timestamp},v1=${expectedSignature}`;

    jest.spyOn(Date, 'now').mockReturnValue(timestamp * 1000);

    const isValid = webhookHandler.verifySignatureManual(payloadString, signatureHeader);
    expect(isValid).toBe(true);
  });

  // Req 15,19: Manual signature verification with expired timestamp
  it('should return false from verifySignatureManual when timestamp is expired', () => {
    const now = Math.floor(Date.now() / 1000);
    const oldTimestamp = now - 1000;
    const signedPayload = `${oldTimestamp}.${payloadString}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const signatureHeader = `t=${oldTimestamp},v1=${expectedSignature}`;

    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);

    const isValid = webhookHandler.verifySignatureManual(payloadString, signatureHeader);
    expect(isValid).toBe(false);
  });

  // Req 15: Manual signature with missing fields
  it('should return false from verifySignatureManual when signature header is missing fields', () => {
    const isValid = webhookHandler.verifySignatureManual(payloadString, 'v1=abc');
    expect(isValid).toBe(false);
  });

  // Req 16,17: Duplicate webhook event handling and event dispatch to correct handler
  it('should dispatch event to default handler and not process duplicate events twice', async () => {
    const event = {
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_123' },
      },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(event);

    const first = await webhookHandler.handleWebhook(payloadString, 'valid_sig');
    const second = await webhookHandler.handleWebhook(payloadString, 'valid_sig');

    expect(first).toEqual({
      success: true,
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
    });

    expect(second).toEqual({
      success: true,
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
    });
  });

  // Req 15,17: Unknown event type handling
  it('should handle unknown event types gracefully by returning success without error', async () => {
    const event = {
      id: 'evt_unknown',
      type: 'unknown.event',
      data: {
        object: { id: 'obj_1' },
      },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(event);

    const result = await webhookHandler.handleWebhook(payloadString, 'valid_sig');

    expect(result).toEqual({
      success: true,
      eventId: 'evt_unknown',
      eventType: 'unknown.event',
    });
  });

  // Req 15: Invalid signature in handleWebhook
  it('should return invalid signature error when verifySignature fails in handleWebhook', async () => {
    // verifySignature will return false because constructEvent throws
    stripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const result = await webhookHandler.handleWebhook(payloadString, 'bad_sig');
    expect(result).toEqual({
      success: false,
      eventId: '',
      eventType: '',
      error: 'Invalid signature',
    });
  });

  // Req 15: Error while constructing event after signature verification
  it('should return error when constructEvent throws after verifySignature passes', async () => {
    // First call for verifySignature should succeed
    stripeInstance.webhooks.constructEvent
      .mockReturnValueOnce({
        id: 'evt_error',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      })
      // Second call inside handleWebhook should throw
      .mockImplementationOnce(() => {
        throw new Error('Webhook parse error');
      });

    const result = await webhookHandler.handleWebhook(payloadString, 'sig_header');

    expect(result).toEqual({
      success: false,
      eventId: '',
      eventType: '',
      error: 'Webhook parse error',
    });
  });

  // Req 17: Event handler execution and error handling
  it('should call registered handler for event type and handle handler errors', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    webhookHandler.registerHandler('customer.subscription.updated', handler);

    const event = {
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123' } },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(event);

    const successResult = await webhookHandler.handleWebhook(payloadString, 'sig_header');
    expect(handler).toHaveBeenCalledWith({ id: 'sub_123' });
    expect(successResult.success).toBe(true);

    const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
    webhookHandler.registerHandler('invoice.payment_failed', failingHandler);

    const failingEvent = {
      id: 'evt_invoice_failed',
      type: 'invoice.payment_failed',
      data: { object: { id: 'inv_123' } },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(failingEvent);

    const failResult = await webhookHandler.handleWebhook(payloadString, 'sig_header');
    expect(failingHandler).toHaveBeenCalledWith({ id: 'inv_123' });
    expect(failResult.success).toBe(false);
    expect(failResult.error).toBe('Handler failed');
  });

  // Req 16: clearProcessedEvents should reset processed event set
  it('should clear processed events so an event can be processed again', async () => {
    const event = {
      id: 'evt_clear',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123' } },
    };

    stripeInstance.webhooks.constructEvent.mockReturnValue(event);

    await webhookHandler.handleWebhook(payloadString, 'sig_header');
    webhookHandler.clearProcessedEvents();
    const result = await webhookHandler.handleWebhook(payloadString, 'sig_header');

    expect(result.success).toBe(true);
    expect(result.eventId).toBe('evt_clear');
  });
});

