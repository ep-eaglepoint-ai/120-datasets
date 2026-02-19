import Stripe from 'stripe';
import { PayPalClient } from './paypal-client';

export interface ChargeRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  amount: number;
  currency: string;
  gateway: 'stripe' | 'paypal';
  errorCode?: string;
  errorMessage?: string;
}

export class PaymentService {
  private stripe: Stripe;
  private paypal: PayPalClient;
  private processedKeys: Set<string> = new Set();

  constructor(stripeKey: string, paypalConfig: { clientId: string; secret: string }) {
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    this.paypal = new PayPalClient(paypalConfig);
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    if (request.amount > 999999.99) {
      throw new Error('Amount exceeds maximum allowed');
    }

    if (request.idempotencyKey && this.processedKeys.has(request.idempotencyKey)) {
      throw new Error('Duplicate transaction detected');
    }

    const amountInCents = Math.round(request.amount * 100);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: request.currency.toLowerCase(),
          customer: request.customerId,
          payment_method: request.paymentMethodId,
          confirm: true,
          metadata: request.metadata,
        },
        {
          idempotencyKey: request.idempotencyKey,
        }
      );

      if (request.idempotencyKey) {
        this.processedKeys.add(request.idempotencyKey);
      }

      return {
        id: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        amount: request.amount,
        currency: request.currency,
        gateway: 'stripe',
      };
    } catch (error: any) {
      if (error.type === 'StripeCardError') {
        return {
          id: '',
          status: 'failed',
          amount: request.amount,
          currency: request.currency,
          gateway: 'stripe',
          errorCode: error.code,
          errorMessage: error.message,
        };
      }
      throw error;
    }
  }

  async chargeWithPayPal(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    try {
      const order = await this.paypal.createOrder({
        amount: request.amount.toFixed(2),
        currency: request.currency,
        reference: request.idempotencyKey,
      });

      const capture = await this.paypal.captureOrder(order.id);

      return {
        id: capture.id,
        status: capture.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: request.amount,
        currency: request.currency,
        gateway: 'paypal',
      };
    } catch (error: any) {
      return {
        id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        gateway: 'paypal',
        errorCode: error.code,
        errorMessage: error.message,
      };
    }
  }

  convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rate: number): number {
    const converted = amount * rate;
    return Math.round(converted * 100) / 100;
  }
}

