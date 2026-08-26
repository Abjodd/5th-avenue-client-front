// Same pattern as 5th-internal-front/src/routes/ProtectedRoute.jsx —
// anything wrapped in this redirects to /login until a brand user signs in.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
