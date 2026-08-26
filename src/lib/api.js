// Fetch wrapper for the shared Fifth-internal-back backend (Express + MongoDB),
// same pattern as Fifth-internal-front/src/lib/api.js. The portal is read-only;
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
    // brand. Mirrors Fifth-internal-front/src/lib/api.js.
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

  // The brand's live campaign reels, with the video/poster/caption pulled from
  // Instagram server-side.
  //
  // This is a database read, not a proxied API call: the backend stores the
  // media in its reel_cache collection and refreshes it on a schedule, so the
  // route costs nothing per view no matter how often the page is opened or how
  // recently the server restarted. That last part is why it changed — the
  // cache used to live in process memory, so every deploy or idle recycle made
  // the next page load re-buy the whole shelf from HikerAPI.
  //
  // Which means usePortalReels() refetching on every mount of /portal/assets
  // is fine, and deliberately left alone: it is one cheap Mongo query, and it
  // is what makes a newly delivered reel show up without a hard reload.
  // See Fifth-internal-back/portalReels.js.
  reels: (clientName) =>
    request(`/api/portal/reels?client=${encodeURIComponent(clientName)}`),

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
 * The portal is otherwise read-only — this is the exception, scoped narrowly:
 * a user may change their own photo, contact details and password, nothing
 * else. The fields deciding what this login can SEE (brand, username) belong
 * to the founder's Access & Credentials page. The server holds the allowlist;
 * these are just the matching calls.
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

  // The member's own details (name, title, phone). Goes to a portal-specific
  // route, not the founder's credential PATCH: that one accepts `brandId`,
  // which is the field that decides whose data this login can read. The server
  // holds the real allowlist — see PORTAL_EDITABLE in routes/auth.js — this is
  // just the matching client.
  updateProfile: (id, patch) =>
    request(`/api/portal/account/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // The member's own sign-in password. The current one travels too, because
  // that is what authorises the change — there is no session token, so the id
  // alone must not be enough. Returns nothing: no session field changes.
  changePassword: (id, currentPassword, newPassword) =>
    request(`/api/portal/account/${encodeURIComponent(id)}/password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
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

  /**
   * The BRAND's logo, which stands in for a member who hasn't set a photo of
   * their own — so a colleague at Nike shows the Nike mark rather than two
   * grey initials, and the two of them are visibly from the same company.
   *
   * That inheritance is the choice itself: there is no stored "use the brand
   * logo" flag, because the absence of a personal photo already means exactly
   * that. Uploading one overrides it, removing it returns to the logo, and
   * neither can drift out of step with a separate boolean.
   *
   * `brandHasLogo` / `brandLogoUpdatedAt` ride the login payload (see
   * portal-login in routes/auth.js), so this costs no extra request.
   */
  brandLogoUrl: (user) => {
    if (!user?.brandId || !user?.brandHasLogo) return null;
    const v = user.brandLogoUpdatedAt ? `?v=${encodeURIComponent(user.brandLogoUpdatedAt)}` : "";
    return `${BASE}/api/clients/${encodeURIComponent(user.brandId)}/avatar${v}`;
  },
};

// Stage → client-facing phase now lives with the phase registry in
// lib/phases.js, so pure modules can map a stage without pulling in this
// fetch client. Re-exported for the callers that already import it here.
export { STAGE_TO_PHASE, phaseOf } from "./phases";
