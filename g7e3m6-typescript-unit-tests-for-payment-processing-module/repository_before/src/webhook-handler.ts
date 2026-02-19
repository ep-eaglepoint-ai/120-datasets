import Stripe from 'stripe';
import crypto from 'crypto';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export interface WebhookResult {
  success: boolean;
  eventId: string;
  eventType: string;
  error?: string;
}

export class WebhookHandler {
  private stripe: Stripe;
  private webhookSecret: string;
  private processedEvents: Set<string> = new Set();
  private eventHandlers: Map<string, (data: any) => Promise<void>> = new Map();

  constructor(stripeKey: string, webhookSecret: string) {
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    this.webhookSecret = webhookSecret;
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.eventHandlers.set('payment_intent.succeeded', async (data) => {
      console.log('Payment succeeded:', data.id);
    });

    this.eventHandlers.set('payment_intent.payment_failed', async (data) => {
      console.log('Payment failed:', data.id);
    });

    this.eventHandlers.set('customer.subscription.updated', async (data) => {
      console.log('Subscription updated:', data.id);
    });

    this.eventHandlers.set('customer.subscription.deleted', async (data) => {
      console.log('Subscription deleted:', data.id);
    });

    this.eventHandlers.set('invoice.payment_failed', async (data) => {
      console.log('Invoice payment failed:', data.id);
    });
  }

  registerHandler(eventType: string, handler: (data: any) => Promise<void>): void {
    this.eventHandlers.set(eventType, handler);
  }

  verifySignature(payload: string | Buffer, signature: string): boolean {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return !!event;
    } catch {
      return false;
    }
  }

  verifySignatureManual(payload: string, signature: string): boolean {
    const signatureParts = signature.split(',');
    let timestamp = '';
    let v1Signature = '';

    for (const part of signatureParts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') v1Signature = value;
    }

    if (!timestamp || !v1Signature) {
      return false;
    }

    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 300;

    if (Math.abs(now - timestampNum) > tolerance) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(v1Signature), Buffer.from(expectedSignature));
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<WebhookResult> {
    if (!this.verifySignature(payload, signature)) {
      return {
        success: false,
        eventId: '',
        eventType: '',
        error: 'Invalid signature',
      };
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error: any) {
      return {
        success: false,
        eventId: '',
        eventType: '',
        error: error.message,
      };
    }

    if (this.processedEvents.has(event.id)) {
      return {
        success: true,
        eventId: event.id,
        eventType: event.type,
      };
    }

    const handler = this.eventHandlers.get(event.type);

    if (!handler) {
      this.processedEvents.add(event.id);
      return {
        success: true,
        eventId: event.id,
        eventType: event.type,
      };
    }

    try {
      await handler(event.data.object);
      this.processedEvents.add(event.id);

      return {
        success: true,
        eventId: event.id,
        eventType: event.type,
      };
    } catch (error: any) {
      return {
        success: false,
        eventId: event.id,
        eventType: event.type,
        error: error.message,
      };
    }
  }

  clearProcessedEvents(): void {
    this.processedEvents.clear();
  }
}

