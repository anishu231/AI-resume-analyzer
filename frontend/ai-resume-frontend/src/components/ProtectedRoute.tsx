import { Navigate } from "react-router-dom";
import type { JSX } from "react/jsx-dev-runtime";
import { getActiveAccessToken } from "../services/auth";

export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const token = getActiveAccessToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
