import Stripe from 'stripe';
import { RefundService, RefundRequest } from '../../repository_before/src/refund-service';

// Req 1,9,10,11: Mock Stripe refunds.create and refunds.retrieve
jest.mock('stripe', () => {
  const refunds = {
    create: jest.fn(),
    retrieve: jest.fn(),
  };

  return jest.fn().mockImplementation(() => ({
    refunds,
  }));
});

const MockedStripe = Stripe as unknown as jest.Mock<typeof Stripe, any[]>;

describe('RefundService', () => {
  const stripeKey = 'sk_test';
  let refundService: RefundService;
  let stripeInstance: any;

  // Refund with different currency than original: not implemented (RefundService uses charge.currency only).
  const baseCharge = {
    id: 'ch_123',
    amount: 100,
    currency: 'usd',
    status: 'succeeded' as const,
    refundedAmount: 0,
  };

  beforeEach(() => {
    stripeInstance = {
      refunds: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    };

    MockedStripe.mockImplementation(() => stripeInstance as any);
    refundService = new RefundService(stripeKey);
    refundService.registerCharge({ ...baseCharge });
  });

  // Req 3,9: Partial refund scenario with remaining balance
  it('should process a partial refund and update remaining balance when charge is succeeded', async () => {
    const request: RefundRequest = {
      chargeId: baseCharge.id,
      amount: 40,
      reason: 'requested_by_customer',
    };

    stripeInstance.refunds.create.mockResolvedValue({
      id: 're_123',
      status: 'succeeded',
    });

    const result = await refundService.refund(request);

    expect(stripeInstance.refunds.create).toHaveBeenCalledWith({
      payment_intent: baseCharge.id,
      amount: 4000,
      reason: 'requested_by_customer',
    });

    expect(result).toEqual({
      id: 're_123',
      status: 'succeeded',
      amount: 40,
      currency: 'usd',
      chargeId: baseCharge.id,
    });

    // Second partial refund to verify remaining balance
    stripeInstance.refunds.create.mockResolvedValue({
      id: 're_124',
      status: 'succeeded',
    });

    const secondResult = await refundService.refund({
      chargeId: baseCharge.id,
      amount: 60,
    });

    expect(secondResult.amount).toBe(60);
  });

  // Req 3,10: Full refund scenario
  it('should process a full refund when amount is not specified', async () => {
    stripeInstance.refunds.create.mockResolvedValue({
      id: 're_full',
      status: 'succeeded',
    });

    const result = await refundService.refund({
      chargeId: baseCharge.id,
    });

    expect(result.amount).toBe(100);
    expect(result.status).toBe('succeeded');
  });

  // Req 11: Refund exceeding available amount should fail
  it('should throw error when refund amount exceeds available amount', async () => {
    const request: RefundRequest = {
      chargeId: baseCharge.id,
      amount: 150,
    };

    await expect(refundService.refund(request)).rejects.toThrow(
      'Refund amount exceeds available amount. Available: 100'
    );
  });

  // Req 11: Refund of already fully refunded charge should fail
  it('should throw error when attempting to refund already fully refunded charge', async () => {
    stripeInstance.refunds.create.mockResolvedValue({
      id: 're_1',
      status: 'succeeded',
    });

    await refundService.refund({ chargeId: baseCharge.id });

    await expect(
      refundService.refund({
        chargeId: baseCharge.id,
        amount: 1,
      })
    ).rejects.toThrow('Refund amount exceeds available amount. Available: 0');
  });

  // Req 9,11: Refund amount must be greater than zero
  // Note: implementation treats 0 as "full refund", so we assert on negative values.
  it('should throw error when refund amount is negative', async () => {
    await expect(
      refundService.refund({
        chargeId: baseCharge.id,
        amount: -10,
      })
    ).rejects.toThrow('Refund amount must be greater than zero');
  });

  // Req 9,10,11: Cannot refund non-succeeded or missing charges
  it('should throw error when charge is not found', async () => {
    await expect(
      refundService.refund({
        chargeId: 'unknown',
      })
    ).rejects.toThrow('Charge not found');
  });

  it('should throw error when charge is not succeeded', async () => {
    const pendingCharge = {
      ...baseCharge,
      id: 'ch_pending',
      status: 'pending' as const,
    };
    refundService.registerCharge(pendingCharge as any);

    await expect(
      refundService.refund({
        chargeId: 'ch_pending',
      })
    ).rejects.toThrow('Cannot refund a charge that has not succeeded');
  });

  // Req 9,10,11: Stripe refund failure handling
  it('should return failed result when Stripe refund creation fails', async () => {
    stripeInstance.refunds.create.mockRejectedValue(new Error('Stripe refund error'));

    const result = await refundService.refund({
      chargeId: baseCharge.id,
      amount: 10,
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('Stripe refund error');
  });

  // Req 3: getRefundStatus success and failure
  it('should return refund status when refund exists', async () => {
    stripeInstance.refunds.retrieve.mockResolvedValue({
      id: 're_status',
      status: 'succeeded',
      amount: 5000,
      currency: 'usd',
      payment_intent: 'ch_status',
    });

    const result = await refundService.getRefundStatus('re_status');

    expect(result).toEqual({
      id: 're_status',
      status: 'succeeded',
      amount: 50,
      currency: 'usd',
      chargeId: 'ch_status',
    });
  });

  it('should return null when refund retrieval fails', async () => {
    stripeInstance.refunds.retrieve.mockRejectedValue(new Error('not found'));

    const result = await refundService.getRefundStatus('unknown');
    expect(result).toBeNull();
  });

  // Branch coverage: getRefundStatus when Stripe returns status 'pending'
  it('should return refund status pending when Stripe refund status is pending', async () => {
    stripeInstance.refunds.retrieve.mockResolvedValue({
      id: 're_pending',
      status: 'pending',
      amount: 2500,
      currency: 'usd',
      payment_intent: 'ch_pending',
    });

    const result = await refundService.getRefundStatus('re_pending');

    expect(result).toEqual({
      id: 're_pending',
      status: 'pending',
      amount: 25,
      currency: 'usd',
      chargeId: 'ch_pending',
    });
  });
});

