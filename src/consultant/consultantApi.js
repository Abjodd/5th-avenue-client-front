// The consultant portal's connection to the backend — kept apart from the
// brand portal (lib/api.js, AuthContext) on purpose: a consultant session is
// a different kind of login with its own token, and must never be mistaken
// for a brand's.
//
// POST /api/auth/consultant-login returns a signed token; every other call
// sends it as `Authorization: Bearer …` (or `?t=` on links the browser opens
// itself). The token decides whose record is read — see
// 5th-internal-back/routes/consultantPortal.js.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const CONSULTANT_KEY = "5av_consultant_session";

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(CONSULTANT_KEY) || "null");
    if (!s?.token) return null;
    if (s.expiresAt && Date.now() > s.expiresAt) { localStorage.removeItem(CONSULTANT_KEY); return null; }
    return s;
  } catch { return null; }
}
const saveSession = (s) => { try { localStorage.setItem(CONSULTANT_KEY, JSON.stringify(s)); } catch { /* private mode */ } };
export const clearSession = () => { try { localStorage.removeItem(CONSULTANT_KEY); } catch { /* ignore */ } };

export class SessionEnded extends Error {}

async function call(path, { method = "GET", body } = {}) {
  const s = getSession();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) { clearSession(); throw new SessionEnded("Please sign in again."); }
  if (!res.ok) {
    let msg = `Something went wrong (${res.status}).`;
    try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/consultant-login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.user?.token) return { ok: false, error: data.error || "Couldn't sign in — try again." };
  const u = data.user;
  saveSession({ token: u.token, expiresAt: Date.now() + (u.tokenDays || 7) * 864e5, name: u.name, email: u.email, consultantName: u.consultantName });
  return { ok: true, user: u };
}

export const warmUp = () => { fetch(`${BASE}/api/health`).catch(() => {}); };

export const ConsultantAPI = {
  me: () => call("/api/consultant-portal/me"),
  setPicture: (avatarImage) => call("/api/consultant-portal/avatar", { method: "PUT", body: { avatarImage } }),
  documents: () => call("/api/consultant-portal/documents"),
  upload: (doc) => call("/api/consultant-portal/documents", { method: "POST", body: doc }),
  removeDocument: (id) => call(`/api/consultant-portal/documents/${id}`, { method: "DELETE" }),
  fileUrl: (id, download) => `${BASE}/api/consultant-portal/documents/${id}/file?t=${encodeURIComponent(getSession()?.token || "")}${download ? "&download=1" : ""}`,
  pictureUrl: (c) => (c?.hasAvatar ? `${BASE}/api/consultants/${encodeURIComponent(c.id)}/avatar?v=${encodeURIComponent(c.avatarUpdatedAt || "")}` : null),
  brandLogoUrl: (b) => (b?.hasLogo ? `${BASE}/api/clients/${encodeURIComponent(b.id)}/avatar?v=${encodeURIComponent(b.logoUpdatedAt || "")}` : null),
};
