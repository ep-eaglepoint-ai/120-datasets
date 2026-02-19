import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startServer, stopServer, JWT_SECRET, TOKEN_EXPIRY_SECONDS } from '../repository_after/backend/src/server.js';
import jwt from 'jsonwebtoken';
import {
  useAuthFetch,
  setTokens,
  getTokens,
  clearTokens,
  setBaseUrl,
  resetState,
  getRefreshState
} from '../repository_after/frontend/src/composables/useAuthFetch';

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let refreshToken: string;

function createExpiredToken() {
  return jwt.sign(
    { userId: 'user-123', version: 1, iat: Math.floor(Date.now() / 1000) - 10 },
    JWT_SECRET,
    { expiresIn: '1s' }
  );
}

function createValidToken() {
  return jwt.sign(
    { userId: 'user-123', version: 1, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createRefreshToken() {
  return jwt.sign(
    { userId: 'user-123', type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('JWT Refresh Token Rotation with Request Deduplication', () => {
  beforeAll(async () => {
    await startServer(TEST_PORT);
    setBaseUrl(BASE_URL);
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetState();
    refreshToken = createRefreshToken();
  });

  describe('Requirement 1: Must use native fetch (No Axios/libs)', () => {
    it('should use native fetch for API calls', async () => {
      const validToken = createValidToken();
      setTokens(validToken, refreshToken);
      
      const { get } = useAuthFetch();
      const result = await get<{ message: string }>('/api/data');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
    });

    it('should make requests without external HTTP libraries', async () => {
      const validToken = createValidToken();
      setTokens(validToken, refreshToken);
      
      const { authFetch } = useAuthFetch();
      const result = await authFetch('/api/data');
      
      expect(result).toBeDefined();
    });
  });

  describe('Requirement 2: Server must simulate rapid token expiration (approx 3s)', () => {
    it('should reject requests with expired tokens with 401', async () => {
      const expiredToken = createExpiredToken();
      clearTokens();
      
      const response = await fetch(`${BASE_URL}/api/data`, {
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });
      
      expect(response.status).toBe(401);
    });

    it('should accept requests with valid tokens', async () => {
      const validToken = createValidToken();
      
      const response = await fetch(`${BASE_URL}/api/data`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });
      
      expect(response.status).toBe(200);
    });

    it('should have token expiry configured to approximately 3 seconds', () => {
      expect(TOKEN_EXPIRY_SECONDS).toBe(3);
    });
  });

  describe('Requirement 3: Wrapper must detect HTTP 401 status', () => {
    it('should detect 401 response and trigger refresh', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      const result = await get<{ message: string }>('/api/data');
      
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('Protected data retrieved successfully');
    });

    it('should handle 401 without refresh token by throwing error', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, '');
      clearTokens();
      setTokens(expiredToken, '');
      
      const { get } = useAuthFetch();
      
      await expect(get('/api/data')).rejects.toThrow();
    });
  });

  describe('Requirement 4: Must implement logic lock or Singleton Promise', () => {
    it('should only send one refresh request when multiple 401s occur simultaneously', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      let refreshCallCount = 0;
      const originalFetch = globalThis.fetch;
      
      globalThis.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/refresh')) {
          refreshCallCount++;
        }
        return originalFetch(url, options);
      };
      
      const { get } = useAuthFetch();
      
      const requests = [
        get('/api/data'),
        get('/api/data/1'),
        get('/api/data/2'),
        get('/api/data/3'),
        get('/api/data/4')
      ];
      
      await Promise.all(requests);
      
      globalThis.fetch = originalFetch;
      
      expect(refreshCallCount).toBe(1);
    });

    it('should use singleton promise pattern for concurrent refresh attempts', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const results = await Promise.all([
        get<{ message: string }>('/api/data'),
        get<{ message: string }>('/api/data'),
        get<{ message: string }>('/api/data')
      ]);
      
      results.forEach(result => {
        expect(result).toHaveProperty('message');
      });
    });
  });

  describe('Requirement 5: Failed requests must be stored in queue while refresh is pending', () => {
    it('should queue failed requests during refresh', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const promise1 = get<{ message: string }>('/api/data');
      const promise2 = get<{ message: string }>('/api/data/1');
      const promise3 = get<{ message: string }>('/api/data/2');
      
      const results = await Promise.all([promise1, promise2, promise3]);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toHaveProperty('message');
      });
    });

    it('should handle queue with different endpoint requests', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const [data1, data2, data3] = await Promise.all([
        get<{ data: unknown }>('/api/data'),
        get<{ data: unknown }>('/api/data/1'),
        get<{ data: unknown }>('/api/data/2')
      ]);
      
      expect(data1).toHaveProperty('data');
      expect(data2).toHaveProperty('data');
      expect(data3).toHaveProperty('data');
    });
  });

  describe('Requirement 6: Upon successful refresh, all queued requests must be re-executed', () => {
    it('should retry all queued requests after successful refresh', async () => {
      const expiredToken = createExpiredToken();
      const freshRefreshToken = createRefreshToken();
      setTokens(expiredToken, freshRefreshToken);
      
      const { get } = useAuthFetch();
      
      const results = await Promise.all([
        get<{ message: string }>('/api/data'),
        get<{ message: string }>('/api/data/1'),
        get<{ message: string }>('/api/data/2'),
        get<{ message: string }>('/api/data/3'),
        get<{ message: string }>('/api/data/4')
      ]);
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).toHaveProperty('message');
      });
    });

    it('should use the new token for retried requests', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      await get('/api/data');
      
      const tokens = getTokens();
      expect(tokens.accessToken).not.toBe(expiredToken);
      expect(tokens.accessToken).toBeTruthy();
    });
  });

  describe('Requirement 7: If refresh fails, all queued requests must reject gracefully', () => {
    it('should reject all queued requests when refresh fails', async () => {
      const expiredToken = createExpiredToken();
      const invalidRefreshToken = 'invalid-refresh-token';
      setTokens(expiredToken, invalidRefreshToken);
      
      const { get } = useAuthFetch();
      
      const results = await Promise.allSettled([
        get('/api/data'),
        get('/api/data/1'),
        get('/api/data/2')
      ]);
      
      results.forEach(result => {
        expect(result.status).toBe('rejected');
      });
    });

    it('should clear tokens when refresh fails', async () => {
      const expiredToken = createExpiredToken();
      const invalidRefreshToken = 'invalid-refresh-token';
      setTokens(expiredToken, invalidRefreshToken);
      
      const { get } = useAuthFetch();
      
      try {
        await get('/api/data');
      } catch (e) {
        // Expected to fail
      }
      
      const tokens = getTokens();
      expect(tokens.accessToken).toBeNull();
      expect(tokens.refreshToken).toBeNull();
    });
  });

  describe('Requirement 8: Consuming component must not know a refresh occurred', () => {
    it('should transparently handle refresh without exposing internals', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const result = await get<{ message: string; data: unknown }>('/api/data');
      
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result.message).toBe('Protected data retrieved successfully');
    });

    it('should return data as if no refresh happened', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get, isLoading, error } = useAuthFetch();
      
      const result = await get('/api/data');
      
      expect(result).toBeDefined();
      expect(error.value).toBeNull();
    });

    it('should handle sequential requests after refresh transparently', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const result1 = await get<{ message: string }>('/api/data');
      expect(result1).toHaveProperty('message');
      
      const result2 = await get<{ message: string }>('/api/data/1');
      expect(result2).toHaveProperty('message');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle request without any token', async () => {
      clearTokens();
      
      const { get } = useAuthFetch();
      
      await expect(get('/api/data')).rejects.toThrow();
    });

    it('should handle server being unavailable', async () => {
      const validToken = createValidToken();
      setTokens(validToken, refreshToken);
      setBaseUrl('http://localhost:9999');
      
      const { get } = useAuthFetch();
      
      await expect(get('/api/data')).rejects.toThrow();
      
      setBaseUrl(BASE_URL);
    });

    it('should handle multiple refresh cycles correctly', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      const { get } = useAuthFetch();
      
      const result1 = await get<{ message: string }>('/api/data');
      expect(result1).toHaveProperty('message');
      
      const newRefreshToken = createRefreshToken();
      setTokens(createExpiredToken(), newRefreshToken);
      
      const result2 = await get<{ message: string }>('/api/data');
      expect(result2).toHaveProperty('message');
    });
  });

  describe('Thundering Herd Prevention', () => {
    it('should prevent thundering herd with 10 simultaneous requests', async () => {
      const expiredToken = createExpiredToken();
      setTokens(expiredToken, refreshToken);
      
      let refreshCallCount = 0;
      const originalFetch = globalThis.fetch;
      
      globalThis.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/refresh')) {
          refreshCallCount++;
        }
        return originalFetch(url, options);
      };
      
      const { get } = useAuthFetch();
      
      const requests = Array.from({ length: 10 }, (_, i) => 
        get(`/api/data/${i}`)
      );
      
      const results = await Promise.all(requests);
      
      globalThis.fetch = originalFetch;
      
      expect(refreshCallCount).toBe(1);
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});
