/**
 * 5th Avenue — Client Portal AuthContext
 * Same structure as 5th-internal-front/src/context/AuthContext.jsx: the user
 * directory lives client-side and the password check happens here (replace
 * with a backend /api/portal/login issuing a JWT with clientName later).
 *
 * Each portal user is a brand representative and carries the clientName /
 * clientId their login is scoped to — every API call and page derives its
 * data from user.clientName, so Brand A only ever sees Brand A.
 */
import { createContext, useContext, useState, useCallback } from "react";

// ── BRAND USER DIRECTORY ─────────────────────────────────────────────────────
// clientName must match Campaign.client in the backend; clientId matches
// Client._id (see 5th-internal-back/seed_clients.js).
export const PORTAL_USERS = [
  { id:"pu1", name:"Rahul Sharma", email:"rahul@freshbitefoods.com", password:"freshbite123",  clientId:"fb", clientName:"FreshBite Foods",  avatar:"RS", title:"Owner" },
  { id:"pu2", name:"Kavya Menon",  email:"kavya@nutriblend.in",      password:"nutriblend123", clientId:"nb", clientName:"NutriBlend India", avatar:"KM", title:"Marketing Head" },
];

// ── CONTEXT ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("5av_portal_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = useCallback((email, password) => {
    const found = PORTAL_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    );
    if (!found) return { ok: false, error: "Invalid email or password." };
    const { password: _, ...safe } = found;
    setUser(safe);
    sessionStorage.setItem("5av_portal_user", JSON.stringify(safe));
    return { ok: true, user: safe };
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
