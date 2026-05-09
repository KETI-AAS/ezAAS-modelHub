"use client";

import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wraps content that should only be visible to authenticated users.
 * Auth-based routing is handled inside AuthContext, so this component
 * simply suppresses rendering when the user is not authenticated.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;
