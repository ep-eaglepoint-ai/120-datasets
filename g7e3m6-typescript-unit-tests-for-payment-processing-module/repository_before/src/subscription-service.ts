import Stripe from 'stripe';

export interface CreateSubscriptionRequest {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  trialDays?: number;
}

export interface SubscriptionResult {
  id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  priceId: string;
}

export interface PlanChangeRequest {
  subscriptionId: string;
  newPriceId: string;
  prorate?: boolean;
}

export class SubscriptionService {
  private stripe: Stripe;
  private readonly maxRetryAttempts = 3;
  private retryAttempts: Map<string, number> = new Map();

  constructor(stripeKey: string) {
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<SubscriptionResult> {
    await this.stripe.paymentMethods.attach(request.paymentMethodId, {
      customer: request.customerId,
    });

    await this.stripe.customers.update(request.customerId, {
      invoice_settings: { default_payment_method: request.paymentMethodId },
    });

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: request.customerId,
      items: [{ price: request.priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    };

    if (request.trialDays && request.trialDays > 0) {
      subscriptionParams.trial_period_days = request.trialDays;
    }

    const subscription = await this.stripe.subscriptions.create(subscriptionParams);

    return this.mapSubscription(subscription);
  }

  async changePlan(request: PlanChangeRequest): Promise<SubscriptionResult> {
    const subscription = await this.stripe.subscriptions.retrieve(request.subscriptionId);

    if (subscription.status === 'canceled') {
      throw new Error('Cannot change plan of canceled subscription');
    }

    const updatedSubscription = await this.stripe.subscriptions.update(request.subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: request.newPriceId,
        },
      ],
      proration_behavior: request.prorate !== false ? 'create_prorations' : 'none',
    });

    return this.mapSubscription(updatedSubscription);
  }

  async cancelSubscription(subscriptionId: string, immediate: boolean = false): Promise<SubscriptionResult> {
    let subscription: Stripe.Subscription;

    if (immediate) {
      subscription = await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    return this.mapSubscription(subscription);
  }

  async handleFailedPayment(subscriptionId: string): Promise<{ shouldRetry: boolean; attemptNumber: number }> {
    const currentAttempts = this.retryAttempts.get(subscriptionId) || 0;
    const newAttempts = currentAttempts + 1;

    this.retryAttempts.set(subscriptionId, newAttempts);

    if (newAttempts >= this.maxRetryAttempts) {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return { shouldRetry: false, attemptNumber: newAttempts };
    }

    return { shouldRetry: true, attemptNumber: newAttempts };
  }

  calculateProration(
    currentPlanAmount: number,
    newPlanAmount: number,
    daysRemaining: number,
    totalDaysInPeriod: number
  ): number {
    const dailyCurrentRate = currentPlanAmount / totalDaysInPeriod;
    const dailyNewRate = newPlanAmount / totalDaysInPeriod;

    const unusedCredit = dailyCurrentRate * daysRemaining;
    const newCharge = dailyNewRate * daysRemaining;

    const proration = newCharge - unusedCredit;
    return Math.round(proration * 100) / 100;
  }

  private mapSubscription(subscription: Stripe.Subscription): SubscriptionResult {
    return {
      id: subscription.id,
      status: subscription.status as SubscriptionResult['status'],
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      priceId: subscription.items.data[0].price.id,
    };
  }
}

