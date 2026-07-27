// Shared formatting/normalisation helpers. Followers are stored
// inconsistently in the DB ("820K", "1.2M", 85653399, "33"), so everything
// funnels through parseFollowers before math is done on it.

export function parseFollowers(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().toUpperCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([KM])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === "M" ? n * 1e6 : m[2] === "K" ? n * 1e3 : n;
}

export function sizeOf(followers) {
  if (followers >= 1e6) return "Mega";
  if (followers >= 100e3) return "Macro";
  if (followers >= 10e3) return "Micro";
  return "Nano";
}

export const fmtNum = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(Math.round(n));
};

// Lakhs in, not rupees — the marketing site's headline figures are authored in
// lakhs (see lib/marketing/data/landing-copy.ts), so they need their own
// formatter rather than fmtINR's rupee scale.
export const fmtL = (n) =>
  n >= 100 ? `₹${(n / 100).toFixed(1)}Cr` : `₹${n.toFixed(n < 10 ? 1 : 0)}L`;

export const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e7) return `₹${(n/1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n/1e3).toFixed(0)}K`;
  return `₹${n}`;
};

export const initials = (name) =>
  (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

// Campaign start/end are stored as ISO ("YYYY-MM-DD") — pretty-print for
// display, passing anything else (e.g. the "TBD" sentinel, or legacy
// non-ISO strings not yet migrated) through unchanged.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function prettyDate(s) {
  if (ISO_DATE.test(s || ""))
    return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  // Full ISO timestamps (createdAt, tracking.lastFetched, …) parse too;
  // anything unparseable ("TBD", free text) is echoed as-is.
  const t = Date.parse(s || "");
  return isNaN(t)
    ? (s || "—")
    : new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
