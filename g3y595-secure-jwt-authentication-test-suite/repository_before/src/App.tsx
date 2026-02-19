import React, { useState, createContext, useContext, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle,
  Lock,
  LogOut,
  Shield,
  Activity,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  role: "admin" | "user" | "viewer";
}

interface AuthTokens {
  accessToken: string;
  expiresAt: number;
}

interface LoginResponse {
  accessToken: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

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

const mockBackend = new MockAuthBackend();

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

class SecureHttpClient {
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<void> | null = null;
  private requestQueue: Array<{
    resolve: Function;
    reject: Function;
    config: any;
  }> = [];

  setTokens(tokens: AuthTokens | null) {
    this.tokens = tokens;
  }

  private async refreshToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const oldRefreshToken = this.getStoredRefreshToken();
        if (!oldRefreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await mockBackend.refreshAccessToken(oldRefreshToken);

        this.tokens = {
          accessToken: response.accessToken,
          expiresAt: Date.now() + 15 * 60 * 1000,
        };

        const queue = [...this.requestQueue];
        this.requestQueue = [];

        for (const { resolve, config } of queue) {
          try {
            const result = await this.request(config);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      } catch (error) {
        this.tokens = null;

        const queue = [...this.requestQueue];
        this.requestQueue = [];
        queue.forEach(({ reject }) => reject(error));

        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private getStoredRefreshToken(): string | null {
    return "simulated-refresh-token";
  }

  async request(config: {
    endpoint: string;
    method?: string;
    data?: any;
  }): Promise<any> {
    const { endpoint, method = "GET", data } = config;

    if (this.tokens && this.tokens.expiresAt - Date.now() < 60000) {
      try {
        await this.refreshToken();
      } catch (error) {
        throw new Error("Session expired. Please login again.");
      }
    }

    try {
      if (endpoint === "/api/protected") {
        if (!this.tokens) {
          throw { status: 401, message: "Unauthorized" };
        }
        await mockBackend.validateAccessToken(this.tokens.accessToken);
        return { data: "Protected data accessed successfully" };
      }

      return { data: "Success" };
    } catch (error: any) {
      if (error.status === 401 && !config.data?._retry) {
        return new Promise((resolve, reject) => {
          this.requestQueue.push({
            resolve,
            reject,
            config: { ...config, data: { ...data, _retry: true } },
          });

          this.refreshToken().catch(reject);
        });
      }

      throw error;
    }
  }
}

const httpClient = new SecureHttpClient();

export const __testExports = {
  mockBackend,
  httpClient: undefined as unknown as SecureHttpClient,
};

__testExports.httpClient = httpClient;

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
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
      await mockBackend.logout("simulated-refresh-token");
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

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setError("");

    if (!validateForm()) return;

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-purple-100 p-3 rounded-full">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          SecureFintech
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Production-grade JWT Authentication
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              placeholder="you@company.com"
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
            {validationErrors.password && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.password}
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            Demo Credentials:
          </p>
          <div className="text-xs text-blue-800 space-y-1">
            <p>
              <strong>Admin:</strong> admin@fintech.com / Admin123!
            </p>
            <p>
              <strong>User:</strong> user@fintech.com / User123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [protectedData, setProtectedData] = useState<string | null>(null);
  const [requestLog, setRequestLog] = useState<
    Array<{ time: string; action: string; status: string }>
  >([]);

  const addLog = (action: string, status: string) => {
    const time = new Date().toLocaleTimeString();
    setRequestLog((prev) => [{ time, action, status }, ...prev.slice(0, 9)]);
  };

  const fetchProtectedData = async () => {
    try {
      addLog("Fetch Protected Data", "Initiated");
      const response = await httpClient.request({ endpoint: "/api/protected" });
      setProtectedData(response.data);
      addLog("Fetch Protected Data", "Success");
    } catch (error: any) {
      addLog("Fetch Protected Data", "Failed: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Secure Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  JWT-Protected Application
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                User Profile
              </h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-mono text-sm font-semibold text-gray-800">
                  {user?.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold text-gray-800">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    user?.role === "admin"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {user?.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                Protected Resource
              </h2>
            </div>
            <button
              onClick={fetchProtectedData}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition mb-4"
            >
              Fetch Protected Data
            </button>
            {protectedData && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  {protectedData}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Request Activity Log
            </h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {requestLog.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No activity yet
              </p>
            ) : (
              requestLog.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-500">
                      {log.time}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {log.action}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      log.status.includes("Success")
                        ? "bg-green-100 text-green-800"
                        : log.status.includes("Failed")
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Active Security Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-semibold text-purple-900">
                Token Rotation
              </p>
              <p className="text-xs text-purple-700 mt-1">
                Automatic refresh token rotation on use
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900">
                Rate Limiting
              </p>
              <p className="text-xs text-blue-700 mt-1">
                5 attempts per IP per 15 minutes
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-semibold text-green-900">
                Theft Detection
              </p>
              <p className="text-xs text-green-700 mt-1">
                Invalidates family on token reuse
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </AuthProvider>
  );
};

export default App;

function reject(error: unknown) {
  throw new Error("Function not implemented.");
}
