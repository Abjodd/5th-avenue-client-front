/**
 * 5th Avenue — Client Portal AuthContext
 * Logs in against the shared 5th-internal-back backend's brand-credential
 * system (BrandCredential model, POST /api/auth/portal-login) — the same
 * store the founder-only Auth page in 5th-internal-front manages. There is
 * no separate client-side user directory: the backend resolves the login's
 * brandId to a real Client document and returns clientName, so every page
 * here derives its data from user.clientName and a brand can only ever see
 * its own data.
 */
import { createContext, useContext, useState, useCallback } from "react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("5av_portal_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${BASE}/api/auth/portal-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || "Invalid email or password." };
      setUser(body.user);
      sessionStorage.setItem("5av_portal_user", JSON.stringify(body.user));
      return { ok: true, user: body.user };
    } catch {
      return { ok: false, error: "Could not reach the server. Please try again." };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("5av_portal_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
