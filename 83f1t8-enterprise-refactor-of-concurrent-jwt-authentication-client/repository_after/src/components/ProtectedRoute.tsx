import React from "react";
import { useAuth } from "../authCore";
import { LoginForm } from "./LoginForm";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
};
