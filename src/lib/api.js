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
    throw new Error(`API ${options.method || "GET"} ${path} failed: ${res.status} ${body}`);
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

// Stage → client-facing phase now lives with the phase registry in
// lib/phases.js, so pure modules can map a stage without pulling in this
// fetch client. Re-exported for the callers that already import it here.
export { STAGE_TO_PHASE, phaseOf } from "./phases";
