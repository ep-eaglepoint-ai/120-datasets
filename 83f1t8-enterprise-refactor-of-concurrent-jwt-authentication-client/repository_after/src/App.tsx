import React from "react";

import { AuthProvider } from "./authCore";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./components/Dashboard";

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
