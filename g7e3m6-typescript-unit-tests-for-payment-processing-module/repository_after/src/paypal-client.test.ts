import { PayPalClient } from '../../repository_before/src/paypal-client';

declare const global: any;

describe('PayPalClient', () => {
  const config = { clientId: 'client', secret: 'secret' };
  let paypalClient: PayPalClient;

  beforeEach(() => {
    paypalClient = new PayPalClient(config);
    global.fetch = jest.fn();
  });

  // Req 19: Restore Date.now after tests that mock it so timestamp-dependent tests do not leak
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockFetchResponse = (ok: boolean, jsonData: any) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok,
      json: jest.fn().mockResolvedValue(jsonData),
    });
  };

  // Req 3,6: Successful token acquisition
  it('should obtain access token successfully when credentials are valid', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    mockFetchResponse(true, { access_token: 'token_123', expires_in: 3600 });

    const token = await paypalClient.getAccessToken();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
        }),
        body: 'grant_type=client_credentials',
      })
    );

    expect(token).toBe('token_123');
  });

  // Req 3,6,23: Subsequent calls to getAccessToken should reuse cached token without new HTTP request
  it('should reuse cached access token when it is still valid', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);

    mockFetchResponse(true, { access_token: 'token_123', expires_in: 3600 });

    const firstToken = await paypalClient.getAccessToken();
    const fetchCallCountAfterFirst = (global.fetch as jest.Mock).mock.calls.length;

    const secondToken = await paypalClient.getAccessToken();
    const fetchCallCountAfterSecond = (global.fetch as jest.Mock).mock.calls.length;

    expect(firstToken).toBe('token_123');
    expect(secondToken).toBe('token_123');
    expect(fetchCallCountAfterSecond).toBe(fetchCallCountAfterFirst);
  });

  // Req 6: Authentication failure (invalid credentials)
  it('should throw when token request fails due to invalid credentials', async () => {
    mockFetchResponse(false, { message: 'Invalid client credentials' });

    await expect(paypalClient.getAccessToken()).rejects.toThrow('Failed to get PayPal access token');
  });

  // Req 3,6: Successful order creation
  it('should create PayPal order when request is valid', async () => {
    mockFetchResponse(true, { access_token: 'token_123', expires_in: 3600 });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ access_token: 'token_123', expires_in: 3600 }),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'order_123', status: 'CREATED' }),
    });

    const order = await paypalClient.createOrder({
      amount: '10.00',
      currency: 'USD',
      reference: 'order_ref',
    });

    expect(order).toEqual({ id: 'order_123', status: 'CREATED' });
  });

  // Req 6: Order creation failure
  it('should throw when createOrder response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ access_token: 'token_123', expires_in: 3600 }),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Order error' }),
    });

    await expect(
      paypalClient.createOrder({
        amount: '10.00',
        currency: 'USD',
      })
    ).rejects.toThrow('Order error');
  });

  // Req 3,6: Successful capture
  it('should capture PayPal order successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ access_token: 'token_123', expires_in: 3600 }),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'cap_123', status: 'COMPLETED' }),
    });

    const capture = await paypalClient.captureOrder('order_123');
    expect(capture).toEqual({ id: 'cap_123', status: 'COMPLETED' });
  });

  // Req 6: Capture failure
  it('should throw when captureOrder response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ access_token: 'token_123', expires_in: 3600 }),
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'Capture error' }),
    });

    await expect(paypalClient.captureOrder('order_123')).rejects.toThrow('Capture error');
  });

  // Req 6: Network error — fetch rejects (e.g. connection failure)
  it('should throw when getAccessToken fails due to network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    await expect(paypalClient.getAccessToken()).rejects.toThrow('Network request failed');
  });
});

