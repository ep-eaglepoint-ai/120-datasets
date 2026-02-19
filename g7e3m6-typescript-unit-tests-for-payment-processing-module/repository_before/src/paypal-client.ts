export interface PayPalOrderRequest {
  amount: string;
  currency: string;
  reference?: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
}

export interface PayPalCapture {
  id: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

export class PayPalClient {
  private clientId: string;
  private secret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: { clientId: string; secret: string }) {
    this.clientId = config.clientId;
    this.secret = config.secret;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');

    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    return this.accessToken;
  }

  async createOrder(request: PayPalOrderRequest): Promise<PayPalOrder> {
    const token = await this.getAccessToken();

    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: request.currency,
              value: request.amount,
            },
            reference_id: request.reference,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create PayPal order');
    }

    return response.json();
  }

  async captureOrder(orderId: string): Promise<PayPalCapture> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to capture PayPal order');
    }

    return response.json();
  }
}

