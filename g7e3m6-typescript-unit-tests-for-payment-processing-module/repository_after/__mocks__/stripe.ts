// Lightweight Stripe stub so Jest can resolve the 'stripe' module
// when importing implementation files from repository_before.
// All actual behavior is overridden in tests via jest.mock('stripe', ...).

export default class Stripe {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(apiKey: string, options?: any) {}

  paymentIntents = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create: async (_params: any, _options?: any): Promise<any> => {
      return { id: 'pi_stub', status: 'succeeded' };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retrieve: async (_id: string): Promise<any> => {
      return { id: 'pi_stub', status: 'succeeded' };
    },
  };

  refunds = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create: async (_params: any): Promise<any> => {
      return { id: 're_stub', status: 'succeeded' };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retrieve: async (_id: string): Promise<any> => {
      return { id: 're_stub', status: 'succeeded', amount: 0, currency: 'usd', payment_intent: 'pi_stub' };
    },
  };

  subscriptions = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create: async (_params: any): Promise<any> => {
      return {
        id: 'sub_stub',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: { data: [{ id: 'si_stub', price: { id: 'price_stub' } }] },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retrieve: async (_id: string): Promise<any> => {
      return {
        id: 'sub_stub',
        status: 'active',
        items: { data: [{ id: 'si_stub', price: { id: 'price_stub' } }] },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update: async (_id: string, _params: any): Promise<any> => {
      return {
        id: 'sub_stub',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: { data: [{ id: 'si_stub', price: { id: 'price_stub' } }] },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cancel: async (_id: string): Promise<any> => {
      return {
        id: 'sub_stub',
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000),
        cancel_at_period_end: false,
        items: { data: [{ id: 'si_stub', price: { id: 'price_stub' } }] },
      };
    },
  };

  webhooks = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructEvent: (payload: any, _signature: string, _secret: string): any => {
      return {
        id: 'evt_stub',
        type: 'payment_intent.succeeded',
        data: { object: typeof payload === 'string' ? JSON.parse(payload) : payload },
      };
    },
  };
}

