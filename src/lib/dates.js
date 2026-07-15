// Date parsing + period bucketing for the analytics section.
// Campaign.start/end are stored as ISO ("YYYY-MM-DD"). Legacy rows that
// predated this (month-first "Mar 1", day-first "3 Jul") were normalized to
// ISO via a one-time backend migration.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePortalDate(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s) ? null : s;
  const str = String(s).trim();
  if (!ISO_DATE.test(str)) return null;
  const d = new Date(`${str}T00:00:00`);
  return isNaN(d) ? null : d;
}

// ── Range presets (screenshot spec: 30d / 3m / 6m / YTD + everything) ───────
export const RANGE_PRESETS = [
  { id: "7d",  label: "Last 7 days",   from: (now) => addDays(now, -7) },
  { id: "30d", label: "Last 30 days",  from: (now) => addDays(now, -30) },
  { id: "3m",  label: "Last 3 months", from: (now) => addMonths(now, -3) },
  { id: "6m",  label: "Last 6 months", from: (now) => addMonths(now, -6) },
  { id: "ytd", label: "Year to date",  from: (now) => new Date(now.getFullYear(), 0, 1) },
  { id: "all", label: "All time",      from: () => new Date(2000, 0, 1) },
];

export const GRANULARITIES = [
  { id: "daily",   label: "Daily" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

function addDays(d, n)   { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

export function rangeFor(presetId, now = new Date()) {
  const p = RANGE_PRESETS.find(r => r.id === presetId) || RANGE_PRESETS[2];
  return { from: p.from(now), to: now };
}

// Start of the bucket a date falls into, per granularity (weeks start Monday).
export function bucketStart(date, gran) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (gran === "monthly") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (gran === "weekly") {
    const day = (d.getDay() + 6) % 7;
    return addDays(d, -day);
  }
  return d;
}

export function nextBucket(date, gran) {
  if (gran === "monthly") return addMonths(date, 1);
  if (gran === "weekly")  return addDays(date, 7);
  return addDays(date, 1);
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function bucketLabel(date, gran) {
  if (gran === "monthly") return `${MONTH_NAMES[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`;
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/* Build the full series of buckets covering [from, to], summing each event's
   numeric fields into its bucket. Events: [{ date: Date, ...numbers }]. */
export function bucketSeries(events, { from, to }, gran, fields) {
  const buckets = [];
  const index = new Map();
  for (let t = bucketStart(from, gran); t <= to; t = nextBucket(t, gran)) {
    const b = { date: t, label: bucketLabel(t, gran) };
    fields.forEach(f => { b[f] = 0; });
    b.count = 0;
    index.set(+t, b);
    buckets.push(b);
  }
  events.forEach(ev => {
    if (ev.date < from || ev.date > to) return;
    const b = index.get(+bucketStart(ev.date, gran));
    if (!b) return;
    fields.forEach(f => { b[f] += Number(ev[f]) || 0; });
    b.count++;
  });
  return buckets;
}
