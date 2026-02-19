import Stripe from 'stripe';
import { SubscriptionService, CreateSubscriptionRequest, PlanChangeRequest } from '../../repository_before/src/subscription-service';

// Req 1,12,13,14,18: Mock Stripe subscriptions, paymentMethods, customers
jest.mock('stripe', () => {
  const subscriptions = {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  };

  const paymentMethods = {
    attach: jest.fn(),
  };

  const customers = {
    update: jest.fn(),
  };

  return jest.fn().mockImplementation(() => ({
    subscriptions,
    paymentMethods,
    customers,
  }));
});

const MockedStripe = Stripe as unknown as jest.Mock<typeof Stripe, any[]>;

describe('SubscriptionService', () => {
  const stripeKey = 'sk_test';
  let subscriptionService: SubscriptionService;
  let stripeInstance: any;

  beforeEach(() => {
    stripeInstance = {
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
      },
      customers: {
        update: jest.fn(),
      },
    };

    MockedStripe.mockImplementation(() => stripeInstance as any);
    subscriptionService = new SubscriptionService(stripeKey);
  });

  const baseCreateRequest: CreateSubscriptionRequest = {
    customerId: 'cus_123',
    priceId: 'price_basic',
    paymentMethodId: 'pm_123',
  };

  // Req 3,12: Create subscription with valid payment method and trial
  it('should create subscription with trial period when trialDays provided', async () => {
    const request: CreateSubscriptionRequest = {
      ...baseCreateRequest,
      trialDays: 14,
    };

    stripeInstance.subscriptions.create.mockResolvedValue({
      id: 'sub_123',
      status: 'trialing',
      current_period_end: 1700000000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_123',
            price: {
              id: 'price_basic',
            },
          },
        ],
      },
    });

    const result = await subscriptionService.createSubscription(request);

    expect(stripeInstance.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
      customer: 'cus_123',
    });

    expect(stripeInstance.customers.update).toHaveBeenCalledWith('cus_123', {
      invoice_settings: { default_payment_method: 'pm_123' },
    });

    expect(stripeInstance.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123',
        items: [{ price: 'price_basic' }],
        trial_period_days: 14,
      })
    );

    expect(result.status).toBe('trialing');
    expect(result.priceId).toBe('price_basic');
  });

  // Req 3,12: Create subscription without trial
  it('should create subscription without trial when trialDays not provided', async () => {
    stripeInstance.subscriptions.create.mockResolvedValue({
      id: 'sub_no_trial',
      status: 'active',
      current_period_end: 1700000000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    const result = await subscriptionService.createSubscription(baseCreateRequest);

    expect(result.status).toBe('active');
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  // Req 13: Subscription plan change with proration
  it('should change subscription plan with proration when prorate is true or undefined', async () => {
    const changeRequest: PlanChangeRequest = {
      subscriptionId: 'sub_123',
      newPriceId: 'price_premium',
      prorate: true,
    };

    stripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    stripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1700000000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_premium' },
          },
        ],
      },
    });

    const result = await subscriptionService.changePlan(changeRequest);

    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      items: [
        {
          id: 'si_123',
          price: 'price_premium',
        },
      ],
      proration_behavior: 'create_prorations',
    });

    expect(result.priceId).toBe('price_premium');
  });

  // Req 13: Subscription plan change without proration
  it('should change subscription plan without proration when prorate is false', async () => {
    const changeRequest: PlanChangeRequest = {
      subscriptionId: 'sub_123',
      newPriceId: 'price_premium',
      prorate: false,
    };

    stripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    stripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1700000000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_premium' },
          },
        ],
      },
    });

    await subscriptionService.changePlan(changeRequest);

    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      items: [
        {
          id: 'si_123',
          price: 'price_premium',
        },
      ],
      proration_behavior: 'none',
    });
  });

  // Req 13: Cannot change plan of canceled subscription
  it('should throw when trying to change plan of canceled subscription', async () => {
    stripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'canceled',
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    await expect(
      subscriptionService.changePlan({
        subscriptionId: 'sub_123',
        newPriceId: 'price_premium',
      })
    ).rejects.toThrow('Cannot change plan of canceled subscription');
  });

  // Req 14: Cancel subscription immediately
  it('should cancel subscription immediately when immediate is true', async () => {
    stripeInstance.subscriptions.cancel.mockResolvedValue({
      id: 'sub_123',
      status: 'canceled',
      current_period_end: 1700000000,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    const result = await subscriptionService.cancelSubscription('sub_123', true);

    expect(stripeInstance.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    expect(result.status).toBe('canceled');
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  // Req 14: Cancel subscription at end of billing period
  it('should set cancel_at_period_end when immediate is false', async () => {
    stripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1700000000,
      cancel_at_period_end: true,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    const result = await subscriptionService.cancelSubscription('sub_123', false);

    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    });
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  // Req 18: Failed payment retry logic and cancellation after max attempts
  it('should increment retry attempts and allow retry until max is reached', async () => {
    const subscriptionId = 'sub_retry';

    stripeInstance.subscriptions.update.mockResolvedValue({
      id: subscriptionId,
      status: 'active',
      current_period_end: 1700000000,
      cancel_at_period_end: true,
      items: {
        data: [
          {
            id: 'si_123',
            price: { id: 'price_basic' },
          },
        ],
      },
    });

    const first = await subscriptionService.handleFailedPayment(subscriptionId);
    const second = await subscriptionService.handleFailedPayment(subscriptionId);
    const third = await subscriptionService.handleFailedPayment(subscriptionId);

    expect(first).toEqual({ shouldRetry: true, attemptNumber: 1 });
    expect(second).toEqual({ shouldRetry: true, attemptNumber: 2 });
    expect(third).toEqual({ shouldRetry: false, attemptNumber: 3 });

    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
      cancel_at_period_end: true,
    });
  });

  // Req 13: Proration calculation helper
  it('should calculate proration correctly for upgrade or downgrade', () => {
    const proration = subscriptionService.calculateProration(100, 200, 15, 30);
    // Current daily = 100/30, new daily = 200/30, days remaining = 15
    // Unused credit ≈ 50, new charge ≈ 100, diff ≈ 50 -> rounded to 50.00
    expect(proration).toBeCloseTo(50, 2);
  });
});

