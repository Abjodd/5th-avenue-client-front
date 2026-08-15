// Fetch wrapper for the shared 5th-internal-back backend (Express + MongoDB),
// same pattern as 5th-internal-front/src/lib/api.js. The portal is read-only;
// which client's data is fetched is decided by the logged-in brand user
// (useAuth().user.clientName) — nothing is hardcoded here anymore.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`API ${options.method || "GET"} ${path} failed: ${res.status} ${body}`);
    // Structured fields so a caller can show the backend's own message (e.g.
    // "Profile photo must be 2MB or smaller.") instead of the raw URL-and-status
    // string, which is a debugging aid, not something to put in front of a
    // brand. Mirrors 5th-internal-front/src/lib/api.js.
    err.status = res.status;
    try { err.body = JSON.parse(body); } catch { err.body = null; }
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const PortalAPI = {
  // All campaigns (with sanitized embedded creators) for the given client —
  // pass the logged-in user's clientName so each brand only sees its own data.
  campaigns: (clientName) =>
    request(`/api/portal/campaigns?client=${encodeURIComponent(clientName)}`),

  // The brand's own company record (allowlisted server-side — the internal
  // audit scoring, competitor mapping and package details never leave). Powers
  // Settings → Company.
  client: (clientName) =>
    request(`/api/portal/client?client=${encodeURIComponent(clientName)}`),

  // Pre-aggregated analytics timeseries + spend split.
  // from / to are ISO strings (optional — defaults to YTD on the backend).
  analytics: (clientName, from, to) => {
    const params = new URLSearchParams({ client: clientName });
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);
    return request(`/api/portal/analytics?${params}`);
  },
};

/**
 * The signed-in brand user's own credential record.
 *
 * The portal is otherwise strictly read-only — this is the single exception,
 * and it is scoped as narrowly as that fact deserves: a user may change THEIR
 * OWN profile photo and nothing else. Every other field on the record (brand,
 * username, title, role) is the agency's to set, and lives behind the founder's
 * Access & Credentials page.
 *
 * Hits the same /api/brand-credentials routes the internal app uses, because
 * they are the same documents.
 */
export const AccountAPI = {
  // Deliberately takes the photo alone rather than a patch object: this is the
  // portal's only write, and a general-purpose update() here would be an open
  // door to fields the brand is not allowed to set on itself.
  updatePhoto: (id, avatarImage) =>
    request(`/api/brand-credentials/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ avatarImage }),
    }),

  // Null when the record has no photo, so the caller renders initials instead
  // of firing a request that is certain to 404. `?v=` busts the image's
  // one-year immutable cache the moment the photo changes.
  avatarUrl: (account) => {
    const id = typeof account === "string" ? account : account?.id;
    if (!id || (typeof account === "object" && !account?.hasAvatar)) return null;
    const v = typeof account === "object" && account?.avatarUpdatedAt
      ? `?v=${encodeURIComponent(account.avatarUpdatedAt)}`
      : "";
    return `${BASE}/api/brand-credentials/${encodeURIComponent(id)}/avatar${v}`;
  },
};

// Stage → client-facing phase now lives with the phase registry in
// lib/phases.js, so pure modules can map a stage without pulling in this
// fetch client. Re-exported for the callers that already import it here.
export { STAGE_TO_PHASE, phaseOf } from "./phases";
