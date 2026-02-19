import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        setSession(data.accessToken, data.user);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();

    const handleLogout = () => logout();
    window.addEventListener("authLogout", handleLogout);
    return () => window.removeEventListener("authLogout", handleLogout);
  }, []);

  const setSession = (token: string, userData: User) => {
    setAccessToken(token);
    setUser(userData);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  };

  const login = async (email: string, pass: string) => {
    const { data } = await api.post("/auth/login", { email, password: pass });
    setSession(data.accessToken, data.user);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setAccessToken(null);
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!accessToken,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
