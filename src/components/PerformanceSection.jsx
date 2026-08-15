/**
 * PerformanceSection — Analytics panel for the client portal Overview page.
 * Three panels:
 *   1. Reach vs Spend dual-axis line chart (toggles to Engagement vs Spend)
 *   2. Funnel — horizontal bars: Impressions → Reach → Engagements → Clicks
 *   3. Spend Split — donut chart by service
 *
 * Data flows from /api/portal/analytics (real MongoDB campaigns) — filtered
 * by the selected period. Falls back to derived zeros if the backend is
 * unreachable so the UI never hard-crashes.
 *
 * Fully theme-aware (light/dark) — every color, including Recharts axes and
 * tooltips, is derived from the active palette (see chartTheme() / P below).
 */
import { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import PeriodFilter from "./PeriodFilter";
import AnimatedNumber from "./AnimatedNumber";
import { useApp } from "../context";
import { rangeFor, buildTimeSeries, parsePortalDate, INTERVALS } from "../lib/dates";
import { chartTheme } from "../lib/chartTheme";
import { fmtNum, fmtINR } from "../lib/format";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const SERIES_FIELDS = ["spend", "reach", "engagements", "impressions", "clicks"];

// Service→colour for the donut — reuses the app's palette (see context.js).
function serviceColor(name, P) {
  const n = name.toLowerCase();
  if (n.includes("influencer")) return P.accent;
  if (n.includes("aeo")) return P.green;
  if (n.includes("performance") || n.includes("ads")) return P.pink;
  if (n.includes("offline")) return P.amber;
  return P.purple;
}

/* Period-over-period trend badge — null delta (no prior-bucket data, or the
   very first period) renders nothing rather than a misleading "0%". */
function TrendBadge({ delta, P }) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const flat = Math.abs(delta) < 0.5;
  const up = delta > 0;
  const tone = flat ? P.mute : up ? P.green : P.red;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold" style={{ color: tone }}>
      {flat ? "→" : up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function StatTile({ label, value, format = fmtNum, loading, color, delta, deltaLabel, P }) {
  return (
    <div className="rounded-[16px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="microlabel">{label}</div>
        {!loading && <TrendBadge delta={delta} P={P}/>}
      </div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color }}>
        {loading ? "…" : <AnimatedNumber value={value} format={format} duration={900}/>}
      </div>
      {!loading && delta != null && Number.isFinite(delta) && (
        <div className="mt-0.5 text-[9.5px] text-mute">vs previous {deltaLabel}</div>
      )}
    </div>
  );
}

function FunnelRow({ label, value, pct, step, color, isFirst, index = 0 }) {
  const rose = step != null && step > 0;
  return (
    <div>
      <div className="mb-[5px] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-ink">
          {label}
          {!isFirst && step != null && (
            <span className={`text-[10px] font-semibold ${rose ? "text-green" : "text-red"}`}>
              {rose ? "▲" : "▼"} {Math.abs(step).toFixed(1)}% {rose ? "rise" : "drop"}
            </span>
          )}
        </span>
        <span className="text-[13px] font-bold" style={{ color }}>{fmtNum(value)}</span>
      </div>
      <div className="relative h-[18px] overflow-hidden rounded-sm bg-well">
        <motion.div className="absolute inset-y-0 left-0 rounded-sm"
          initial={{ width: 0 }} whileInView={{ width: `${Math.min(pct, 100)}%` }}
          viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.1 }}
          style={{ background: color, opacity: 0.85 }}/>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink">
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function PerformanceSection({ clientName: clientNameProp }) {
  const { P } = useApp();
  const { axisProps, gridStroke, tooltipStyle } = chartTheme(P);
  const { user } = useAuth();
  const clientName = clientNameProp || user?.clientName;

  const [preset, setPreset]     = useState("6m");
  // Chart interval = time-axis bucket size (daily | weekly | monthly).
  // Named chartInterval so the setter doesn't shadow window.setInterval.
  const [chartInterval, setChartInterval] = useState("monthly");
  const [toggle, setToggle]   = useState("reach");  // "reach" | "engagement"
  const [analytics, setAnalytics] = useState(null);  // null = loading
  const [error, setError]     = useState(null);

  const range = useMemo(() => rangeFor(preset), [preset]);

  useEffect(() => {
    if (!clientName) return;
    setAnalytics(null);
    setError(null);
    PortalAPI.analytics(
      clientName,
      range.from.toISOString(),
      range.to.toISOString()
    )
      .then(setAnalytics)
      .catch(e => setError(e.message));
  }, [clientName, range.from.toISOString(), range.to.toISOString()]);

  const spendByService = analytics?.spendByService || {};

  // Backend returns one dated event per campaign (already range-filtered);
  // build the chart series here per the selected interval so the Daily /
  // Weekly / Monthly toggle re-slices instantly without refetching.
  const events = useMemo(() =>
    (analytics?.events || [])
      .map(ev => ({ ...ev, date: parsePortalDate(ev.date) }))
      .filter(ev => ev.date)
  , [analytics]);

  const series = useMemo(() => {
    if (!events.length) return [];
    // "All time" starts the window at 2000 — clamp to the first real event
    // so a daily view doesn't generate decades of empty chart points.
    const from = preset === "all"
      ? new Date(Math.min(...events.map(ev => +ev.date)))
      : range.from;
    // trimLeading: the line starts at the first bucket that actually has
    // activity rather than at the left edge of the chosen window — see
    // buildTimeSeries for why leading zeros misrepresent the trend.
    return buildTimeSeries(events, { from, to: range.to }, chartInterval, SERIES_FIELDS, { trimLeading: true });
  }, [events, preset, range, chartInterval]);

  const totals = useMemo(() => {
    const sum = k => events.reduce((s, ev) => s + (ev[k] || 0), 0);
    return { imp: sum("impressions"), reach: sum("reach"), eng: sum("engagements"), clicks: sum("clicks"), spend: sum("spend") };
  }, [events]);

  // How much of the period is real measurement vs follower-based estimate.
  // Drives the footnote, so a brand can tell the two apart at a glance.
  const measuredMix = useMemo(() => events.reduce(
    (a, ev) => ({
      measured: a.measured + (ev.measuredCreators || 0),
      total: a.total + (ev.totalCreators || 0),
    }),
    { measured: 0, total: 0 },
  ), [events]);

  // Period-over-period trend: last bucket vs the one before it, reusing the
  // series already built for the chart (no extra fetch). Skipped when either
  // bucket has no real events — a 0→N or N→0 jump isn't a meaningful trend,
  // it's just where the data happens to start/stop.
  const trend = useMemo(() => {
    if (series.length < 2) return null;
    const last = series[series.length - 1], prev = series[series.length - 2];
    if (!last.count || !prev.count) return null;
    const pct = k => (prev[k] > 0 ? ((last[k] - prev[k]) / prev[k]) * 100 : null);
    return { imp: pct("impressions"), reach: pct("reach"), eng: pct("engagements"), clicks: pct("clicks"), spend: pct("spend") };
  }, [series]);

  const intervalLabel = INTERVALS.find(iv => iv.id === chartInterval)?.label.toLowerCase() || chartInterval;
  const trendUnit = { daily: "day", weekly: "week", monthly: "month" }[chartInterval] || intervalLabel;
  // Dots clutter dense series (e.g. daily over 6 months) — hide them there.
  const showDots = series.length <= 45;

  const donutSlices = useMemo(() =>
    Object.entries(spendByService)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: serviceColor(name, P) }))
  , [spendByService, P]);

  const totalSpend = donutSlices.reduce((s, d) => s + d.value, 0);

  /* Funnel stages run in delivery order: the creators' combined audience, how
     many views that actually produced, how many of those engaged, and an
     estimated click-through.

     Bars are scaled to the LARGEST stage, not to reach. Reach is the follower
     base, but impressions are now measured from the posts themselves — and a
     reel that travels beyond its creator's followers genuinely outruns it
     (Nike's roster: 500K followers, 3.6M views). Scaling to reach pinned that
     bar at 730% of its track and read as a rendering fault. The step change
     between stages is likewise signed: a stage bigger than the one above it is
     a rise, not a "-630% drop". */
  const funnelRows = useMemo(() => {
    const rows = [
      { label: "Reach",       value: totals.reach,  color: P.pink   },
      { label: "Impressions", value: totals.imp,    color: P.accent },
      { label: "Engagements", value: totals.eng,    color: P.amber  },
      { label: "Clicks",      value: totals.clicks, color: P.green  },
    ];
    const top = Math.max(...rows.map(r => r.value), 0) || 1;
    return rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].value : null;
      return {
        ...r,
        pct: (r.value / top) * 100,
        // Positive = grew against the stage above, negative = fell away.
        // Null when the previous stage is 0, where a ratio means nothing.
        step: prev ? ((r.value - prev) / prev) * 100 : null,
        isFirst: i === 0,
      };
    });
  }, [totals, P]);

  const isLoading = analytics === null && !error;

  return (
    <div className="au mt-4 overflow-hidden rounded-[20px] border border-line bg-[--color-glass] shadow-[0_2px_20px_rgba(25,22,17,0.04)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_10px_36px_rgba(25,22,17,0.06)]">

      {/* Header + period filter */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h3 className="font-serif text-[19px] italic font-semibold text-ink">Performance</h3>
          <p className="mt-0.5 text-[12.5px] text-sub">Dual-axis · {intervalLabel} view · overall trend</p>
        </div>
        <PeriodFilter preset={preset} onPreset={setPreset} interval={chartInterval} onInterval={setChartInterval} />
      </div>

      <div className="px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red/20 bg-red/[0.06] px-4 py-2.5 text-[12px] text-red">
            Could not load analytics — is the backend running? ({error})
          </div>
        )}

        {/* KPI stat strip — each tile's ▲/▼ badge compares the most recent
            {intervalLabel} bucket against the one before it, so a brand can
            tell at a glance whether reach/spend/engagement is trending up or
            down, not just what the flat total is. */}
        <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          <StatTile label="Total Reach"    value={totals.reach}  loading={isLoading} color={P.pink}   delta={trend?.reach}  deltaLabel={trendUnit} P={P}/>
          <StatTile label="Impressions"    value={totals.imp}    loading={isLoading} color={P.accent} delta={trend?.imp}    deltaLabel={trendUnit} P={P}/>
          <StatTile label="Engagements"    value={totals.eng}    loading={isLoading} color={P.amber}  delta={trend?.eng}    deltaLabel={trendUnit} P={P}/>
          <StatTile label="Clicks (est.)"  value={totals.clicks} loading={isLoading} color={P.green}  delta={trend?.clicks} deltaLabel={trendUnit} P={P}/>
          <StatTile label="Total Spend"    value={totals.spend}  format={fmtINR} loading={isLoading} color={P.purple} delta={trend?.spend} deltaLabel={trendUnit} P={P}/>
        </div>

        {/* Row 1: Dual-axis line chart */}
        <div className="mb-4 overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-serif text-[15px] italic font-semibold text-ink">
                {toggle === "reach" ? "Reach vs Spend" : "Engagement vs Spend"}
              </div>
              <div className="mt-0.5 text-[10.5px] text-mute">Dual-axis · {intervalLabel} view · overall trend</div>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-line">
              {[["reach", "Reach vs Spend"], ["engagement", "Engagement vs Spend"]].map(([id, label]) => (
                <button key={id} onClick={() => setToggle(id)}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    toggle === id ? "bg-accent/[0.08] text-accent" : "text-mute hover:text-ink"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex gap-5">
            <span className="flex items-center gap-1.5 text-[11px] text-ink">
              <span className="inline-block h-px w-6 rounded" style={{ background: toggle==="reach" ? P.pink : P.amber, height: 2 }}/>
              {toggle === "reach" ? "Reach (M) · left axis" : "Engagements · left axis"}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-ink">
              <span className="inline-block h-px w-6 rounded" style={{ background: P.purple, height: 2 }}/>
              Spend (₹L) · right axis
            </span>
          </div>

          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center text-[12px] text-mute">Loading…</div>
          ) : series.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-[12px] text-mute">No data for the selected period</div>
          ) : series.length === 1 ? (
            /* One bucket is not a trend. Recharts centres a lone point in the
               plot area, which is what produced a single dot marooned in the
               middle of an otherwise empty panel — it reads as a broken chart
               rather than as "this brand has run one campaign". d3's point
               scale can't be talked out of it either: it centres at align 0.5
               and recharts exposes no way to change that. So state the period's
               numbers plainly, left-aligned, and say what a trend would need. */
            <div className="flex h-[200px] flex-col justify-center gap-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
                {series[0].label}
              </div>
              <div className="flex flex-wrap gap-10">
                <div>
                  <div className="text-[26px] font-bold leading-none"
                    style={{ color: toggle === "reach" ? P.pink : P.amber }}>
                    {fmtNum(toggle === "reach" ? series[0].reach : series[0].engagements)}
                  </div>
                  <div className="mt-1.5 text-[11px] text-sub">
                    {toggle === "reach" ? "Reach" : "Engagements"}
                  </div>
                </div>
                <div>
                  <div className="text-[26px] font-bold leading-none" style={{ color: P.purple }}>
                    {fmtINR(series[0].spend)}
                  </div>
                  <div className="mt-1.5 text-[11px] text-sub">Spend</div>
                </div>
              </div>
              <p className="text-[10.5px] text-mute">
                Only one {trendUnit} of activity falls in this period — a trend line needs at least two.
                Widen the period, or switch to a finer interval, to plot it.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={series} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={20} interval="preserveStartEnd"
                  scale="point" padding={{ left: 0, right: 0 }} />
                <YAxis yAxisId="left"  {...axisProps} tickFormatter={v => fmtNum(v)} width={44} />
                <YAxis yAxisId="right" {...axisProps} orientation="right" tickFormatter={v => fmtINR(v)} width={52} />
                <Tooltip {...tooltipStyle}
                  formatter={(v, name) => name === "Spend" ? [fmtINR(v), name] : [fmtNum(v), name]}
                />
                <Line yAxisId="left" type="monotone"
                  dataKey={toggle === "reach" ? "reach" : "engagements"}
                  name={toggle === "reach" ? "Reach" : "Engagements"}
                  stroke={toggle === "reach" ? P.pink : P.amber}
                  strokeWidth={2.5}
                  dot={showDots ? { r: 4, fill: toggle==="reach" ? P.pink : P.amber, strokeWidth: 2, stroke: "#fff" } : false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
                <Line yAxisId="right" type="monotone"
                  dataKey="spend" name="Spend"
                  stroke={P.purple}
                  strokeWidth={2.5}
                  dot={showDots ? { r: 4, fill: P.purple, strokeWidth: 2, stroke: "#fff" } : false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Row 2: Funnel + Spend Split side by side */}
        <div className="grid gap-4 lg:grid-cols-2">

          <div className="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md">
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Funnel</div>
            <p className="mb-4 text-[10.5px] text-mute">Audience → Exposure → Engagement → Click · bars scaled to the largest stage</p>
            {isLoading ? (
              <div className="flex h-[140px] items-center justify-center text-[12px] text-mute">Loading…</div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {funnelRows.map((r, i) => <FunnelRow key={r.label} {...r} index={i} />)}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md">
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Spend Split</div>
            <p className="mb-2 text-[10.5px] text-mute">By service · selected period</p>

            {isLoading ? (
              <div className="flex h-[180px] items-center justify-center text-[12px] text-mute">Loading…</div>
            ) : donutSlices.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-[12px] text-mute">No spend data</div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={donutSlices} cx={75} cy={75} innerRadius={48} outerRadius={72}
                      dataKey="value" paddingAngle={2} strokeWidth={0}>
                      {donutSlices.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[19px] font-bold leading-none text-ink">{fmtINR(totalSpend)}</div>
                    <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-mute">TOTAL</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {donutSlices.map(s => (
                    <div key={s.name} className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: s.color }}/>
                        <span className="text-[11.5px] text-ink">{s.name}</span>
                      </div>
                      <span className="text-[12px] font-semibold text-ink">{fmtINR(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* The old note called every number an estimate. That was true when it
            was written and is not any more — impressions and engagements come
            from the posts themselves wherever they have been fetched, so the
            note now reports which of the two the reader is actually looking at
            rather than understating real measurements. */}
        <p className="mt-3 text-[10px] text-mute">
          Reach = creator follower sum.{" "}
          {measuredMix.measured > 0 && (
            <>
              Impressions and engagements are measured from live post metrics
              {measuredMix.measured < measuredMix.total
                ? ` for ${measuredMix.measured} of ${measuredMix.total} creators; the rest are estimated until their posts are fetched.`
                : " across every creator on the roster."}{" "}
            </>
          )}
          {measuredMix.measured === 0 && (
            <>Impressions ≈ reach × 12%, engagements derived from avgER — estimates until post metrics are fetched. </>
          )}
          Clicks ≈ engagements × 8%, always an estimate. Impressions can exceed reach when a post
          travels beyond the creator&rsquo;s own followers.
        </p>
      </div>
    </div>
  );
}
