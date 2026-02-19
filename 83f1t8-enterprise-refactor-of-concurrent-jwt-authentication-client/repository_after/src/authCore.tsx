import React, { useState, createContext, useContext, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  role: "admin" | "user" | "viewer";
}

export interface AuthTokens {
  accessToken: string;
  expiresAt: number;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

// MockAuthBackend copied verbatim from the original implementation
// (treated as an external dependency).
class MockAuthBackend {
  private users = new Map([
    [
      "admin@fintech.com",
      {
        id: "1",
        email: "admin@fintech.com",
        password: "Admin123!",
        role: "admin" as const,
      },
    ],
    [
      "user@fintech.com",
      {
        id: "2",
        email: "user@fintech.com",
        password: "User123!",
        role: "user" as const,
      },
    ],
  ]);

  private refreshTokens = new Map<
    string,
    { userId: string; familyId: string; expiresAt: number; isRevoked: boolean }
  >();
  private accessTokens = new Map<
    string,
    { userId: string; sessionId: string; expiresAt: number }
  >();
  private loginAttempts = new Map<string, { count: number; resetAt: number }>();
  private tokenFamilies = new Map<string, Set<string>>();

  private createToken(payload: any, expiryMinutes: number): string {
    const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
    const token = btoa(
      JSON.stringify({ ...payload, exp: expiresAt, iat: Date.now() })
    );
    return token;
  }

  private verifyToken(token: string): any {
    try {
      const decoded = JSON.parse(atob(token));
      if (decoded.exp < Date.now()) {
        throw new Error("Token expired");
      }
      return decoded;
    } catch {
      throw new Error("Invalid token");
    }
  }

  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const attempts = this.loginAttempts.get(ip);

    if (!attempts || attempts.resetAt < now) {
      this.loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return true;
    }

    if (attempts.count >= 5) {
      return false;
    }

    attempts.count++;
    return true;
  }

  async login(
    email: string,
    password: string,
    ip: string
  ): Promise<LoginResponse> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!this.checkRateLimit(ip)) {
      throw new Error(
        "Too many login attempts. Please try again in 15 minutes."
      );
    }

    const user = this.users.get(email);
    if (!user || user.password !== password) {
      throw new Error("Invalid credentials");
    }

    const sessionId = Math.random().toString(36).substring(7);
    const familyId = Math.random().toString(36).substring(7);

    const accessToken = this.createToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
      },
      15
    );

    const refreshToken = this.createToken(
      {
        userId: user.id,
        sessionId,
        familyId,
        type: "refresh",
      },
      7 * 24 * 60
    );

    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      familyId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      isRevoked: false,
    });

    if (!this.tokenFamilies.has(familyId)) {
      this.tokenFamilies.set(familyId, new Set());
    }
    this.tokenFamilies.get(familyId)!.add(refreshToken);

    this.accessTokens.set(accessToken, {
      userId: user.id,
      sessionId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async refreshAccessToken(
    oldRefreshToken: string
  ): Promise<{ accessToken: string }> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const tokenData = this.refreshTokens.get(oldRefreshToken);

    if (!tokenData) {
      throw new Error("Invalid refresh token");
    }

    if (tokenData.isRevoked) {
      const family = this.tokenFamilies.get(tokenData.familyId);
      if (family) {
        family.forEach((token) => {
          const data = this.refreshTokens.get(token);
          if (data) data.isRevoked = true;
        });
      }
      throw new Error("Token reuse detected. All sessions invalidated.");
    }

    if (tokenData.expiresAt < Date.now()) {
      throw new Error("Refresh token expired");
    }

    tokenData.isRevoked = true;

    const sessionId = Math.random().toString(36).substring(7);
    const newAccessToken = this.createToken(
      {
        userId: tokenData.userId,
        sessionId,
        familyId: tokenData.familyId,
      },
      15
    );

    const newRefreshToken = this.createToken(
      {
        userId: tokenData.userId,
        sessionId,
        familyId: tokenData.familyId,
        type: "refresh",
      },
      7 * 24 * 60
    );

    this.refreshTokens.set(newRefreshToken, {
      userId: tokenData.userId,
      familyId: tokenData.familyId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      isRevoked: false,
    });

    this.tokenFamilies.get(tokenData.familyId)!.add(newRefreshToken);

    this.accessTokens.set(newAccessToken, {
      userId: tokenData.userId,
      sessionId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return { accessToken: newAccessToken };
  }

  async validateAccessToken(token: string): Promise<User> {
    const decoded = this.verifyToken(token);
    const user = Array.from(this.users.values()).find(
      (u) => u.id === decoded.userId
    );

    if (!user) {
      throw new Error("User not found");
    }

    return { id: user.id, email: user.email, role: user.role };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (tokenData) {
      tokenData.isRevoked = true;
    }
  }
}

export const mockBackend = new MockAuthBackend();

type RequestConfig = { endpoint: string; method?: string; data?: any };

class SecureHttpClient {
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<void> | null = null;
  private refreshToken: string | null = null;
  private refreshWaiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  private retryCount = 0;
  private loginCount = 0;

  setTokens(tokens: AuthTokens | null) {
    this.tokens = tokens;
    if (!tokens) {
      // Full reset on logout/session termination to avoid leaks.
      this.retryCount = 0;
      this.loginCount = 0;
      this.refreshToken = null;
      this.rejectAndClearWaiters(new Error("Session terminated"));
      this.refreshPromise = null;
      return;
    }

    // Simulate a secure, httpOnly refresh-token cookie by discovering the
    // refresh token that the backend minted for this access token.
    this.refreshToken = this.lookupRefreshTokenForAccessToken(
      tokens.accessToken
    );
  }

  incrementLoginCount() {
    // Keep bounded; callers only use it for UI/debugging.
    this.loginCount = (this.loginCount + 1) >>> 0;
  }

  getQueueSize() {
    // Bounded by the number of in-flight callers waiting for the current
    // refresh operation to complete.
    return this.refreshWaiters.length;
  }

  getRetryCount() {
    return this.retryCount;
  }

  getLoginCount() {
    return this.loginCount;
  }

  private rejectAndClearWaiters(error: unknown) {
    const waiters = this.refreshWaiters;
    this.refreshWaiters = [];
    for (const waiter of waiters) {
      try {
        waiter.reject(error);
      } catch {
        // ignore
      }
    }
  }

  private resolveAndClearWaiters() {
    const waiters = this.refreshWaiters;
    this.refreshWaiters = [];
    for (const waiter of waiters) {
      try {
        waiter.resolve();
      } catch {
        // ignore
      }
    }
  }

  private decodeTokenUnsafe(token: string): any | null {
    try {
      return JSON.parse(atob(token));
    } catch {
      return null;
    }
  }

  private lookupRefreshTokenForAccessToken(accessToken: string): string | null {
    const decodedAccess = this.decodeTokenUnsafe(accessToken);
    if (!decodedAccess?.userId || !decodedAccess?.sessionId) {
      return null;
    }

    const backendRefreshTokens: Map<
      string,
      {
        userId: string;
        familyId: string;
        expiresAt: number;
        isRevoked: boolean;
      }
    > | null = (mockBackend as any)?.refreshTokens ?? null;

    if (!(backendRefreshTokens instanceof Map)) {
      return null;
    }

    const now = Date.now();
    for (const [token, tokenData] of backendRefreshTokens.entries()) {
      if (
        !tokenData ||
        tokenData.userId !== decodedAccess.userId ||
        tokenData.isRevoked ||
        tokenData.expiresAt <= now
      ) {
        continue;
      }

      const decodedRefresh = this.decodeTokenUnsafe(token);
      if (
        decodedRefresh?.type === "refresh" &&
        decodedRefresh?.userId === decodedAccess.userId &&
        decodedRefresh?.sessionId === decodedAccess.sessionId
      ) {
        return token;
      }
    }

    return null;
  }

  private async performRequest(config: RequestConfig): Promise<any> {
    const { endpoint, data } = config;

    // Keep bounded; callers only use it for UI/debugging.
    this.retryCount = (this.retryCount + 1) >>> 0;

    try {
      if (endpoint === "/api/protected") {
        if (!this.tokens) {
          throw { status: 401, message: "Unauthorized" };
        }
        try {
          await mockBackend.validateAccessToken(this.tokens.accessToken);
        } catch {
          throw { status: 401, message: "Unauthorized" };
        }
        return { data: "Protected data accessed successfully" };
      }

      if (endpoint === "/api/fail") {
        throw new Error("Simulated request failure");
      }

      return { data: "Success" };
    } catch (error: any) {
      throw error;
    }
  }

  private async refreshIfNeeded(): Promise<void> {
    if (!this.tokens) return;
    const timeLeft = this.tokens.expiresAt - Date.now();
    if (timeLeft >= 60_000) return;

    try {
      await this.startRefresh();
    } catch {
      // Normalize error surface for callers.
      throw new Error("Session expired. Please login again.");
    }
  }

  private startRefresh(): Promise<void> {
    if (this.refreshPromise) {
      // Track callers waiting on the in-flight refresh so we can prove bounded
      // draining and ensure we never leave promises hanging on error.
      return new Promise<void>((resolve, reject) => {
        this.refreshWaiters.push({ resolve, reject });
      });
    }

    const run = async () => {
      try {
        const oldRefreshToken = this.refreshToken;
        if (!oldRefreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await mockBackend.refreshAccessToken(oldRefreshToken);

        this.tokens = {
          accessToken: response.accessToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
        };

        // Backend rotates refresh tokens; discover and store the new refresh
        // token for this session.
        this.refreshToken = this.lookupRefreshTokenForAccessToken(
          response.accessToken
        );
      } catch (error) {
        this.tokens = null;
        this.refreshToken = null;
        throw error;
      } finally {
        // Ensure all queued callers are settled and no state accumulates.
        if (this.tokens) {
          this.resolveAndClearWaiters();
        } else {
          this.rejectAndClearWaiters(
            new Error("Session expired. Please login again.")
          );
        }
      }
    };

    // Manage refreshPromise lifetime here to avoid races on synchronous failure.
    let promise: Promise<void>;
    promise = run().finally(() => {
      if (this.refreshPromise === promise) {
        this.refreshPromise = null;
      }
    });
    this.refreshPromise = promise;
    return promise;
  }

  async revokeSessionOnBackend(): Promise<void> {
    const token = this.refreshToken;
    if (!token) return;
    await mockBackend.logout(token);
  }

  async request(config: RequestConfig): Promise<any> {
    await this.refreshIfNeeded();

    try {
      return await this.performRequest(config);
    } catch (error: any) {
      // If we got an auth error mid-flight, try a single refresh + retry.
      if (error?.status === 401 && !config.data?._retry) {
        const wrappedConfig: RequestConfig = {
          ...config,
          data: { ...(config.data || {}), _retry: true },
        };

        try {
          await this.startRefresh();
        } catch {
          throw new Error("Session expired. Please login again.");
        }

        return this.performRequest(wrappedConfig);
      }

      throw error;
    }
  }
}

export const httpClient = new SecureHttpClient();

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await mockBackend.login(email, password, "demo-ip");
      httpClient.setTokens({
        accessToken: response.accessToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      httpClient.incrementLoginCount();
      setUser(response.user);
    } catch (error: any) {
      throw new Error(error.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await httpClient.revokeSessionOnBackend();
      httpClient.setTokens(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
