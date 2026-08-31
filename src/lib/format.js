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

// Money, on the Indian scale: 75000 → "₹75,000", 750000 → "₹7.5L",
// 12000000 → "₹1.2Cr". No "K" tier — a media budget is quoted in lakhs and
// crores here, and "₹75K" next to "₹7.5L" reads as two unrelated scales.
// Below a lakh the full grouped number is short enough to print, and it's
// exact: the K tier rounded ₹75,400 and ₹75,600 to the same "₹75K".
// Mirrors fmtINR in the internal app (5th-internal-front src/lib/format.js).
export const fmtINR = (n) => {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "—";
  const v = Number(n), a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${+(a/1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${sign}₹${+(a/1e5).toFixed(1)}L`;
  return `${sign}₹${a.toLocaleString("en-IN")}`;
};

// Cost per view. Neither fmtINR's lakh/crore scale nor a flat two decimals
// works here: a real CPV is routinely a fraction of a paisa (₹0.005264,
// ₹0.03578), which toFixed(2) collapses to a uniform "₹0.01" — while printing
// all six decimals gives the reader a number they must count zeros in.
//
// So: two significant digits past the leading zeros, at any magnitude.
// 0.005264 → ₹0.0053, 0.03578 → ₹0.036, and at/above ₹1 it settles back to the
// ordinary ₹1.25. Rounded, not truncated — truncating would understate the
// cost of a view every time.
const CPV_SIGNIFICANT = 2;

// toFixed, not toPrecision: toPrecision returns exponent notation ("5.3e-3")
// on exactly the small numbers this exists for.
function cpvDecimals(a) {
  if (!(a > 0) || a >= 1) return CPV_SIGNIFICANT;
  // The exponent counts the zeros between the point and the first real digit.
  return Math.min(20, -Math.floor(Math.log10(a)) - 1 + CPV_SIGNIFICANT);
}

/**
 * fmtCPV with its precision pinned to `target`.
 *
 * AnimatedNumber calls its formatter on every frame from 0 upward, so a
 * magnitude-adaptive formatter re-decides its decimal count sixty times a
 * second and the tile visibly changes width on the way up. Locking the
 * decimals to where the number is GOING leaves only the value moving.
 */
export const fmtCPVTo = (target) => {
  const decimals = cpvDecimals(Math.abs(Number(target) || 0));
  return (n) => {
    const v = Number(n);
    if (n == null || n === "" || !Number.isFinite(v)) return "—";
    return `${v < 0 ? "-" : ""}₹${Math.abs(v).toFixed(decimals)}`;
  };
};

export const fmtCPV = (n) => fmtCPVTo(n)(n);

export const initials = (name) =>
  (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

// Compact axis label for a growth point's "YYYY-MM-DD" date, e.g. "Aug 16".
// Deliberately not prettyDate: an axis tick has no room for a year, and every
// point on one of these charts is inside the same few weeks anyway.
//
// Shared because the campaign's Growth tab and the Overview's
// account-wide curve plot the same series — two copies of this is how their
// axes start disagreeing about how a day is written.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayLabel = (d) => {
  const [, m, day] = String(d).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
};

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
