import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

import { Login } from "@client/pages/Login";
import { AuthProvider, useAuth } from "@client/context/AuthContext";
import api from "@client/api/axios";

// Mock Axios
jest.mock("@client/api/axios", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    create: () => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: { headers: { common: {} } },
    }),
    defaults: { headers: { common: {} } },
    interceptors: { response: { use: jest.fn() }, request: { use: jest.fn() } },
  },
}));

// Helper component to test Logout functionality
const TestDashboard = () => {
  const { user, logout } = useAuth();
  if (!user) return <div>Logged Out</div>;
  return (
    <div>
      <span>Welcome {user.email}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe("Frontend Integration: Auth Flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("performs full login and logout cycle", async () => {
    // 1. Setup API Mocks
    (api.post as jest.Mock).mockImplementation((url) => {
      if (url === "/auth/login") {
        return Promise.resolve({
          data: {
            accessToken: "fake-jwt",
            user: { id: "1", email: "test@example.com", role: "user" },
          },
        });
      }
      if (url === "/auth/logout") {
        return Promise.resolve();
      }
      return Promise.reject(new Error("not found"));
    });

    // 2. Render Login + Test Dashboard inside AuthProvider
    render(
      <AuthProvider>
        <BrowserRouter>
          <Login />
          <TestDashboard />
        </BrowserRouter>
      </AuthProvider>
    );

    // 3. Perform Login
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    // 4. Verify Login Success (Check if Dashboard appears)
    await waitFor(() => {
      expect(screen.getByText("Welcome test@example.com")).toBeInTheDocument();
    });

    // 5. Perform Logout
    fireEvent.click(screen.getByRole("button", { name: /Logout/i }));

    // 6. Verify Logout (Check if "Logged Out" appears)
    await waitFor(() => {
      expect(screen.getByText("Logged Out")).toBeInTheDocument();
      expect(api.post).toHaveBeenCalledWith("/auth/logout");
    });
  });
});
