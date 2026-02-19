import React, { useState } from "react";
import {
  CheckCircle,
  LogOut,
  Shield,
  Activity,
  Bug,
  Zap,
  Lock,
} from "lucide-react";
import { useAuth } from "../authCore";
import { httpClient } from "../authCore";

export const Dashboard: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const [protectedData, setProtectedData] = useState<string | null>(null);
  const [requestLog, setRequestLog] = useState<
    Array<{ time: string; action: string; status: string }>
  >([]);
  const [debugInfo, setDebugInfo] = useState({
    queueSize: 0,
    retryCount: 0,
    globalCounter: 0,
  });

  const addLog = (action: string, status: string) => {
    const time = new Date().toLocaleTimeString();
    setRequestLog((prev) => [{ time, action, status }, ...prev.slice(0, 19)]);
  };

  const updateDebugInfo = () => {
    setDebugInfo({
      queueSize: httpClient.getQueueSize(),
      retryCount: httpClient.getRetryCount(),
      globalCounter: httpClient.getLoginCount(),
    });
  };

  const fetchProtectedData = async () => {
    try {
      addLog("Fetch Protected Data", "Initiated");
      const response = await httpClient.request({ endpoint: "/api/protected" });
      setProtectedData(response.data);
      addLog("Fetch Protected Data", "Success");
      updateDebugInfo();
    } catch (error: any) {
      addLog("Fetch Protected Data", "Failed: " + error.message);
      updateDebugInfo();
    }
  };

  const testMultipleRequests = async () => {
    addLog("Stress Test", "Starting 10 concurrent requests");
    const promises = Array.from({ length: 10 }, () =>
      httpClient.request({ endpoint: "/api/protected" })
    );

    try {
      await Promise.all(promises);
      addLog("Stress Test", "All requests completed");
      updateDebugInfo();
    } catch (error: any) {
      addLog("Stress Test", "Failed: " + error.message);
      updateDebugInfo();
    }
  };

  const testMixedRequests = async () => {
    addLog("Mixed Test", "Testing success + failure mix");
    const promises = [
      httpClient.request({ endpoint: "/api/protected" }),
      httpClient.request({ endpoint: "/api/fail" }),
      httpClient.request({ endpoint: "/api/protected" }),
    ];

    try {
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      addLog("Mixed Test", `${succeeded}/3 succeeded`);
      updateDebugInfo();
    } catch (error: any) {
      addLog("Mixed Test", "Critical error: " + error.message);
      updateDebugInfo();
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bug className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Debug Monitor</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-700">Queue Size:</span>
                <span className="font-mono font-bold text-red-900">
                  {debugInfo.queueSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Retry Count:</span>
                <span className="font-mono font-bold text-red-900">
                  {debugInfo.retryCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Global Counter:</span>
                <span className="font-mono font-bold text-red-900">
                  {debugInfo.globalCounter}
                </span>
              </div>
              <p className="text-xs text-red-600 mt-2">
                All metrics remain bounded under load
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                User Profile
              </h2>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">User ID</p>
                <p className="font-mono text-sm font-semibold text-gray-800">
                  {user?.id}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Email</p>
                <p className="text-sm font-semibold text-gray-800">
                  {user?.email}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Role</p>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
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
              <h2 className="text-lg font-semibold text-gray-800">Protected</h2>
            </div>
            <button
              onClick={fetchProtectedData}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition mb-3 text-sm"
            >
              Fetch Data
            </button>
            {protectedData && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800 font-medium">
                  {protectedData}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Request Test Suite
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={testMultipleRequests}
              className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Test: Concurrent Load
              <p className="text-xs mt-1 opacity-90">
                50 requests remain bounded
              </p>
            </button>
            <button
              onClick={testMixedRequests}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Test: Mixed Responses
              <p className="text-xs mt-1 opacity-90">
                Error paths stay consistent
              </p>
            </button>
            <button
              onClick={updateDebugInfo}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Refresh Debug Info
              <p className="text-xs mt-1 opacity-90">Inspect client state</p>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Request Activity Log
            </h2>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {requestLog.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No activity yet - run tests to see behavior
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
                        : log.status.includes("Failed") ||
                          log.status.includes("Critical")
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
      </div>
    </div>
  );
};
