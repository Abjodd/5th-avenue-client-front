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
  { id: "1d",  label: "Today",         from: (now) => startOfDay(now) },
  { id: "7d",  label: "Last 7 days",   from: (now) => addDays(now, -7) },
  { id: "30d", label: "Last 30 days",  from: (now) => addDays(now, -30) },
  { id: "3m",  label: "Last 3 months", from: (now) => addMonths(now, -3) },
  { id: "6m",  label: "Last 6 months", from: (now) => addMonths(now, -6) },
  { id: "ytd", label: "Year to date",  from: (now) => new Date(now.getFullYear(), 0, 1) },
  { id: "all", label: "All time",      from: () => new Date(2000, 0, 1) },
];

// How fine the chart's time axis is sliced: one point per day, week, or month.
export const INTERVALS = [
  { id: "daily",   label: "Daily" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

function addDays(d, n)   { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function startOfDay(d)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d)     { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

/* A hand-picked window is encoded into the same string the presets use —
   "custom:2026-07-01:2026-08-26". Every caller keeps passing one id around and
   rangeFor() stays the only place that turns an id into dates, so nothing
   downstream (the fetch effect, the persisted value) needed a second field. */
const CUSTOM = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

export const customPreset = (from, to) => `custom:${from}:${to}`;

export function parseCustom(presetId) {
  const m = CUSTOM.exec(presetId || "");
  return m ? { from: m[1], to: m[2] } : null;
}

export function rangeFor(presetId, now = new Date()) {
  const custom = parseCustom(presetId);
  // Inclusive of the end date: picking the same day at both ends has to mean
  // that whole day, not a zero-width window.
  if (custom) return { from: parsePortalDate(custom.from), to: endOfDay(parsePortalDate(custom.to)) };
  const p = RANGE_PRESETS.find(r => r.id === presetId) || RANGE_PRESETS[3];
  return { from: p.from(now), to: now };
}

// A "bucket" is one slot on the chart's time axis — one day, one week, or one
// month depending on the interval. Every dated event lands in exactly one
// bucket; the helpers below find a date's bucket, step to the next one, and
// label it for the axis. (Weeks start Monday.)
export function bucketStart(date, interval) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (interval === "monthly") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (interval === "weekly") {
    const day = (d.getDay() + 6) % 7;
    return addDays(d, -day);
  }
  return d;
}

export function nextBucket(date, interval) {
  if (interval === "monthly") return addMonths(date, 1);
  if (interval === "weekly")  return addDays(date, 7);
  return addDays(date, 1);
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function bucketLabel(date, interval) {
  if (interval === "monthly") return `${MONTH_NAMES[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`;
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/* Turn dated events into a chart-ready time series: one row per bucket
   covering [from, to] (empty buckets in the MIDDLE included, so the axis has no
   gaps), with each event's numeric fields summed into the bucket its date falls
   in. Events: [{ date: Date, ...numbers }].

   `trimLeading` drops empty buckets BEFORE the first real one. The selected
   period is a window the reader chose, not a claim that anything happened at
   the start of it — a brand whose first campaign began in June but who is
   looking at "last 6 months" was getting five flat months pinned to zero and
   then a line, which reads as a collapse in performance rather than as an
   absence of history. Worse, those zeros are real data points to the y-axis, so
   the scale started at 0 and squashed the part of the chart that had something
   in it.

   Only LEADING buckets are trimmed. A gap in the middle is a genuine quiet
   month and has to stay, and trailing empties are the current period still
   filling in. */
export function buildTimeSeries(events, { from, to }, interval, fields, { trimLeading = false } = {}) {
  const series = [];
  const index = new Map();
  for (let t = bucketStart(from, interval); t <= to; t = nextBucket(t, interval)) {
    const row = { date: t, label: bucketLabel(t, interval) };
    fields.forEach(f => { row[f] = 0; });
    row.count = 0;
    index.set(+t, row);
    series.push(row);
  }
  events.forEach(ev => {
    if (ev.date < from || ev.date > to) return;
    const row = index.get(+bucketStart(ev.date, interval));
    if (!row) return;
    fields.forEach(f => { row[f] += Number(ev[f]) || 0; });
    row.count++;
  });
  if (!trimLeading) return series;
  const first = series.findIndex(r => r.count > 0);
  // No events at all: hand back the empty frame rather than an empty array, so
  // the chart still draws its axes instead of switching to a "no data" panel.
  return first <= 0 ? series : series.slice(first);
}
