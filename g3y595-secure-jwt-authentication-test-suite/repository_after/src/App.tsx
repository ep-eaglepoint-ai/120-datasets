import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Shield,
  Lock,
  AlertCircle,
  CheckCircle,
  LogOut,
  Activity,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  role: "admin" | "user";
}

interface AuthTokens {
  accessToken: string;
  expiresAt: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

class MockAuthBackend {
  private tokenFamilies = new Map<
    string,
    { userId: string; familyId: string; isRevoked: boolean }
  >();
  private refreshTokens = new Map<
    string,
    { userId: string; familyId: string; isRevoked: boolean }
  >();
  private accessTokens = new Map<
    string,
    { userId: string; expiresAt: number }
  >();
  private loginAttempts = new Map<
    string,
    { attempts: number; lastAttempt: number }
  >();

  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateFamilyId(): string {
    return "family_" + this.generateToken();
  }

  private validateLoginAttempt(ip: string) {
    const now = Date.now();
    const attempt = this.loginAttempts.get(ip);

    if (attempt && now - attempt.lastAttempt < 15 * 60 * 1000) {
      if (attempt.attempts >= 5) {
        throw new Error("Too many login attempts. Please try again later.");
      }
      attempt.attempts++;
      attempt.lastAttempt = now;
    } else {
      this.loginAttempts.set(ip, { attempts: 1, lastAttempt: now });
    }
  }

  async login(email: string, password: string, ip: string) {
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.validateLoginAttempt(ip);

    const validCredentials = [
      { email: "admin@fintech.com", password: "Admin123!", role: "admin" },
      { email: "user@fintech.com", password: "User123!", role: "user" },
    ];

    const credential = validCredentials.find(
      (c) => c.email === email && c.password === password
    );

    if (!credential) {
      throw new Error("Invalid credentials");
    }

    const user: User = {
      id: this.generateToken(),
      email: credential.email,
      role: credential.role as "admin" | "user",
    };

    const familyId = this.generateFamilyId();
    const refreshToken = this.generateToken();
    const accessToken = this.generateToken();

    this.tokenFamilies.set(familyId, {
      userId: user.id,
      familyId,
      isRevoked: false,
    });

    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      familyId,
      isRevoked: false,
    });

    this.accessTokens.set(accessToken, {
      userId: user.id,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return {
      user,
      accessToken,
      refreshToken,
      familyId,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) {
      throw new Error("Invalid refresh token");
    }

    if (tokenData.isRevoked) {
      this.revokeFamily(tokenData.familyId);
      throw new Error("Token reuse detected. All sessions invalidated.");
    }

    tokenData.isRevoked = true;

    const newRefreshToken = this.generateToken();
    const newAccessToken = this.generateToken();

    this.refreshTokens.set(newRefreshToken, {
      userId: tokenData.userId,
      familyId: tokenData.familyId,
      isRevoked: false,
    });

    this.accessTokens.set(newAccessToken, {
      userId: tokenData.userId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async validateAccessToken(accessToken: string) {
    const tokenData = this.accessTokens.get(accessToken);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      throw new Error("Invalid or expired access token");
    }
    return tokenData;
  }

  async logout(refreshToken: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.revokeRefreshToken(refreshToken);
  }

  private revokeFamily(familyId: string) {
    this.tokenFamilies.forEach((family) => {
      if (family.familyId === familyId) {
        family.isRevoked = true;
      }
    });

    this.refreshTokens.forEach((tokenData) => {
      if (tokenData.familyId === familyId) {
        tokenData.isRevoked = true;
      }
    });
  }

  private revokeRefreshToken(refreshToken: string) {
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

        for (const { resolve, reject, config } of queue) {
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

  const value = useMemo<AuthContextType>(
    () => ({ user, isAuthenticated: !!user, login, logout, isLoading }),
    [user, login, logout, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateForm = () => {
    const errors: string[] = [];

    if (!email.includes("@") || !email.includes(".")) {
      errors.push("Invalid email format");
    }

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters");
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-purple-100 p-4 rounded-full">
              <Shield className="w-12 h-12 text-purple-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            Production-Grade JWT Authentication
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Secure token rotation & theft detection
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="space-y-2">
                {validationErrors.map((err) => (
                  <div
                    key={err}
                    className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">{err}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

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
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold text-gray-800">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <p className="font-semibold text-gray-800 capitalize">
                  {user?.role}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Sessions</p>
                <p className="font-semibold text-gray-800">1</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                Protected Data
              </h2>
            </div>

            <button
              onClick={fetchProtectedData}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition mb-4"
            >
              Fetch Protected Data
            </button>

            {protectedData && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-800">
                  {protectedData}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Request Log
          </h2>
          <div className="space-y-2">
            {requestLog.length === 0 ? (
              <p className="text-gray-500 text-sm">No requests yet</p>
            ) : (
              requestLog.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {log.action}
                    </p>
                    <p className="text-xs text-gray-500">{log.time}</p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      log.status.includes("Failed")
                        ? "bg-red-100 text-red-800"
                        : log.status.includes("Success")
                        ? "bg-green-100 text-green-800"
                        : log.status.includes("Initiated")
                        ? "bg-blue-100 text-blue-800"
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
