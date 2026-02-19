import Stripe from 'stripe';

export interface RefundRequest {
  chargeId: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface RefundResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  chargeId: string;
  errorMessage?: string;
}

interface ChargeRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  refundedAmount: number;
}

export class RefundService {
  private stripe: Stripe;
  private chargeRecords: Map<string, ChargeRecord> = new Map();

  constructor(stripeKey: string) {
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  }

  registerCharge(charge: ChargeRecord): void {
    this.chargeRecords.set(charge.id, { ...charge, refundedAmount: charge.refundedAmount || 0 });
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const charge = this.chargeRecords.get(request.chargeId);

    if (!charge) {
      throw new Error('Charge not found');
    }

    if (charge.status !== 'succeeded') {
      throw new Error('Cannot refund a charge that has not succeeded');
    }

    const refundAmount = request.amount || charge.amount - charge.refundedAmount;

    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }

    const availableForRefund = charge.amount - charge.refundedAmount;

    if (refundAmount > availableForRefund) {
      throw new Error(`Refund amount exceeds available amount. Available: ${availableForRefund}`);
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: request.chargeId,
        amount: Math.round(refundAmount * 100),
        reason: request.reason,
      });

      charge.refundedAmount += refundAmount;
      this.chargeRecords.set(charge.id, charge);

      return {
        id: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
        amount: refundAmount,
        currency: charge.currency,
        chargeId: request.chargeId,
      };
    } catch (error: any) {
      return {
        id: '',
        status: 'failed',
        amount: refundAmount,
        currency: charge.currency,
        chargeId: request.chargeId,
        errorMessage: error.message,
      };
    }
  }

  async getRefundStatus(refundId: string): Promise<RefundResult | null> {
    try {
      const refund = await this.stripe.refunds.retrieve(refundId);
      return {
        id: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
        amount: refund.amount / 100,
        currency: refund.currency,
        chargeId: refund.payment_intent as string,
      };
    } catch {
      return null;
    }
  }
}

