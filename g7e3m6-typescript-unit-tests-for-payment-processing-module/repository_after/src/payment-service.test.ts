import Stripe from 'stripe';
import { PaymentService, ChargeRequest } from '../../repository_before/src/payment-service';
import { PayPalClient } from '../../repository_before/src/paypal-client';

jest.mock('stripe', () => {
  const paymentIntents = {
    create: jest.fn(),
    retrieve: jest.fn(),
  };

  return jest.fn().mockImplementation(() => ({
    paymentIntents,
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Req 2,6: Mock PayPal API via PayPalClient
jest.mock('../../repository_before/src/paypal-client');

const MockedStripe = Stripe as unknown as jest.Mock<typeof Stripe, any[]>;
const MockedPayPalClient = PayPalClient as jest.MockedClass<typeof PayPalClient>;

// Req 24: Tests are designed to run quickly under normal Jest execution.
// Req 25: Tests avoid randomness and external timing, making the suite deterministic and non-flaky.

describe('PaymentService', () => {
  const stripeKey = 'sk_test';
  const paypalConfig = { clientId: 'id', secret: 'secret' };

  const baseRequest: ChargeRequest = {
    amount: 100,
    currency: 'USD',
    customerId: 'cus_123',
    paymentMethodId: 'pm_123',
    idempotencyKey: 'key-1',
    metadata: { orderId: 'order-1' },
  };

  let paymentService: PaymentService;
  let stripeInstance: any;
  let paypalInstance: jest.Mocked<PayPalClient>;

  beforeEach(() => {
    MockedStripe.mockClear();

    stripeInstance = {
      paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    };

    MockedStripe.mockImplementation(() => stripeInstance as any);

    paypalInstance = {
      getAccessToken: jest.fn(),
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
    } as any;

    MockedPayPalClient.mockImplementation(() => paypalInstance);

    paymentService = new PaymentService(stripeKey, paypalConfig);
  });

  // Req 3,23: Success scenario for charge
  it('should create a successful Stripe charge when request is valid', async () => {
    stripeInstance.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    });

    const result = await paymentService.charge(baseRequest);

    expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 10000,
        currency: 'usd',
        customer: baseRequest.customerId,
        payment_method: baseRequest.paymentMethodId,
        confirm: true,
        metadata: baseRequest.metadata,
      },
      {
        idempotencyKey: baseRequest.idempotencyKey,
      }
    );
    expect(result).toEqual({
      id: 'pi_123',
      status: 'succeeded',
      amount: baseRequest.amount,
      currency: baseRequest.currency,
      gateway: 'stripe',
    });
  });

  // Req 4: Amount validation errors (<=0)
  it('should throw error when amount is less than or equal to zero', async () => {
    await expect(
      paymentService.charge({
        ...baseRequest,
        amount: 0,
      })
    ).rejects.toThrow('Amount must be greater than zero');
  });

  // Req 4: Amount validation errors (exceeds maximum)
  it('should throw error when amount exceeds maximum allowed', async () => {
    await expect(
      paymentService.charge({
        ...baseRequest,
        amount: 1000000,
      })
    ).rejects.toThrow('Amount exceeds maximum allowed');
  });

  // Req 7: Idempotency key behavior for duplicate charge prevention
  it('should throw error when duplicate idempotency key is used', async () => {
    stripeInstance.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
    });

    await paymentService.charge(baseRequest);

    await expect(paymentService.charge(baseRequest)).rejects.toThrow('Duplicate transaction detected');
  });

  // Req 8: Pass idempotency key to Stripe API
  it('should pass idempotency key to Stripe paymentIntents.create', async () => {
    stripeInstance.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      status: 'pending',
    });

    await paymentService.charge(baseRequest);

    expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ idempotencyKey: baseRequest.idempotencyKey })
    );
  });

  // Req 5: StripeCardError handling (declined card)
  it('should return failed result when StripeCardError occurs', async () => {
    const cardError = {
      type: 'StripeCardError',
      code: 'card_declined',
      message: 'Your card was declined.',
    };

    stripeInstance.paymentIntents.create.mockRejectedValue(cardError);

    const result = await paymentService.charge(baseRequest);

    expect(result).toEqual({
      id: '',
      status: 'failed',
      amount: baseRequest.amount,
      currency: baseRequest.currency,
      gateway: 'stripe',
      errorCode: 'card_declined',
      errorMessage: 'Your card was declined.',
    });
  });

  // Req 5: StripeInvalidRequestError handling (propagate error)
  it('should throw non-card Stripe errors such as invalid request', async () => {
    const invalidError = {
      type: 'StripeInvalidRequestError',
      message: 'Invalid parameters',
    };

    stripeInstance.paymentIntents.create.mockRejectedValue(invalidError);

    await expect(paymentService.charge(baseRequest)).rejects.toEqual(invalidError);
  });

  // Req 4: Missing required fields — Stripe rejects invalid/incomplete params; error is propagated
  it('should propagate Stripe error when request has invalid or missing required fields', async () => {
    const missingFieldsError = {
      type: 'StripeInvalidRequestError',
      message: 'No such customer: \'invalid_customer\'',
    };

    stripeInstance.paymentIntents.create.mockRejectedValue(missingFieldsError);

    await expect(
      paymentService.charge({
        ...baseRequest,
        customerId: 'invalid_customer',
      })
    ).rejects.toEqual(missingFieldsError);

    expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'invalid_customer' }),
      expect.any(Object)
    );
  });

  // Req 5: Network timeout during charge (generic error)
  it('should throw when network timeout occurs during charge', async () => {
    const timeoutError = new Error('Request timed out');
    stripeInstance.paymentIntents.create.mockRejectedValue(timeoutError);

    await expect(paymentService.charge(baseRequest)).rejects.toThrow('Request timed out');
  });

  // Req 23: Currency conversion with rounding
  it('should convert currency with correct rounding', () => {
    const amount = paymentService.convertCurrency(10, 'USD', 'EUR', 0.8456);
    expect(amount).toBeCloseTo(8.46, 2);
  });

  // Req 3,6: Successful PayPal charge via PaymentService
  it('should create a successful PayPal charge when request is valid', async () => {
    paypalInstance.createOrder.mockResolvedValue({
      id: 'order_123',
      status: 'CREATED',
    } as any);

    paypalInstance.captureOrder.mockResolvedValue({
      id: 'capture_123',
      status: 'COMPLETED',
    } as any);

    const result = await paymentService.chargeWithPayPal(baseRequest);

    expect(paypalInstance.createOrder).toHaveBeenCalledWith({
      amount: '100.00',
      currency: 'USD',
      reference: baseRequest.idempotencyKey,
    });

    expect(paypalInstance.captureOrder).toHaveBeenCalledWith('order_123');

    expect(result).toEqual({
      id: 'capture_123',
      status: 'succeeded',
      amount: baseRequest.amount,
      currency: baseRequest.currency,
      gateway: 'paypal',
    });
  });

  // Req 4: Amount validation for PayPal charge
  it('should throw error when PayPal charge amount is not greater than zero', async () => {
    await expect(
      paymentService.chargeWithPayPal({
        ...baseRequest,
        amount: 0,
      })
    ).rejects.toThrow('Amount must be greater than zero');
  });

  // Req 6: PayPal error handling (createOrder failure)
  it('should return failed result when PayPal createOrder fails', async () => {
    paypalInstance.createOrder.mockRejectedValue({
      code: 'ORDER_ERROR',
      message: 'Order creation failed',
    });

    const result = await paymentService.chargeWithPayPal(baseRequest);

    expect(result.status).toBe('failed');
    expect(result.gateway).toBe('paypal');
    expect(result.errorCode).toBe('ORDER_ERROR');
    expect(result.errorMessage).toBe('Order creation failed');
  });

  // Req 6: PayPal error handling (captureOrder failure)
  it('should return failed result when PayPal captureOrder fails', async () => {
    paypalInstance.createOrder.mockResolvedValue({
      id: 'order_123',
      status: 'CREATED',
    } as any);

    paypalInstance.captureOrder.mockRejectedValue({
      code: 'CAPTURE_ERROR',
      message: 'Capture failed',
    });

    const result = await paymentService.chargeWithPayPal(baseRequest);

    expect(result.status).toBe('failed');
    expect(result.gateway).toBe('paypal');
    expect(result.errorCode).toBe('CAPTURE_ERROR');
    expect(result.errorMessage).toBe('Capture failed');
  });
});

