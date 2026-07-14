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

export const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e7) return `₹${(n/1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n/1e3).toFixed(0)}K`;
  return `₹${n}`;
};

export const initials = (name) =>
  (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
