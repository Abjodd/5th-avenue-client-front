/**
 * PerformanceSection — Analytics panel for the client portal Overview page.
 * Three panels:
 *   1. Reach vs Spend dual-axis line chart (toggles to Engagement vs Spend)
 *   2. Funnel — the fluid Reach → Views → Engagements stream
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
import { Funnel } from "./charts";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// `totalCreators` is bucketed alongside the metrics so a period can be asked
// whether it had a ROSTER at all — see audienceKnown below. Without it a
// campaign that is booked but not yet cast is indistinguishable from one whose
// audience genuinely measured zero.
const SERIES_FIELDS = ["spend", "reach", "engagements", "views", "totalCreators"];

/**
 * Does this bucket have an audience figure at all?
 *
 * Spend is committed the moment a campaign is booked, but reach only exists
 * once creators are on it. A month holding one un-cast campaign therefore
 * reports real spend and a reach of zero — which the chart drew as a line
 * diving to the floor and the tile reported as "▼100%", i.e. a total collapse
 * in audience, on a campaign that simply hasn't started. Those buckets are
 * left out of the audience line and out of the audience trend instead; spend,
 * which really did happen, still counts.
 */
const audienceKnown = (row) => (row?.totalCreators || 0) > 0;

// Ring diameter. Radii derive from it so the donut stays in proportion at any
// size, and it is big enough to hold the period total at a readable weight.
const DONUT = 220;

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
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="rounded-[16px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div className="microlabel">{label}</div>
          {label === "CPV" && (
            <div className="relative">
              <button
                type="button"
                title="This CPV is for all campaigns in the selected period. For a campaign-specific CPV, open the specific campaign page."
                aria-label="CPV info"
                onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}
                onFocus={() => setShowInfo(true)} onBlur={() => setShowInfo(false)}
                className="inline-flex size-3.5 items-center justify-center rounded-full border border-line text-[8px] font-bold text-mute transition-colors hover:bg-accent/[0.12] hover:text-accent"
              >
                i
              </button>
              {showInfo && (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-line bg-[--color-glass] p-2 text-[11px] text-sub shadow-md">
                  This CPV is for all campaigns in the selected period. For a campaign-specific CPV, open the specific campaign page.
                </div>
              )}
            </div>
          )}
        </div>
        {!loading && delta != null && <TrendBadge delta={delta} P={P}/>}
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

function fmtCPV5(value) {
  if (value == null || !Number.isFinite(value)) return "0.00000";
  return Number(value).toFixed(5);
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
  // Which service the cursor is on — the ring and the legend drive it both
  // ways, so pointing at either one reads the same slice.
  const [hoverSvc, setHoverSvc] = useState(null);

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
      // The backend still calls measured post views "impressions"; the
      // portal says views, so the rename lives here and nowhere else.
      .map(ev => ({ ...ev, views: ev.impressions, date: parsePortalDate(ev.date) }))
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

  // What the chart plots: the same buckets, with the audience metrics blanked
  // out wherever there was no roster to measure. Spend is untouched — it was
  // committed whether or not anyone has been cast yet.
  const chartRows = useMemo(() => series.map(row => (
    audienceKnown(row)
      ? row
      : { ...row, reach: null, engagements: null, views: null }
  )), [series]);

  const totals = useMemo(() => {
    const sum = k => events.reduce((s, ev) => s + (ev[k] || 0), 0);
    const spend = sum("spend"), views = sum("views");
    return { views, reach: sum("reach"), eng: sum("engagements"), spend, cpv: views > 0 ? spend / views : 0 };
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
    // Audience deltas need a roster on BOTH sides of the comparison. Comparing
    // a measured month against a booked-but-uncast one produces a −100% that
    // describes the calendar, not the work.
    const audience = audienceKnown(last) && audienceKnown(prev);
    const pctAudience = k => (audience ? pct(k) : null);
    return {
      views: pctAudience("views"), reach: pctAudience("reach"),
      eng: pctAudience("engagements"), spend: pct("spend"),
    };
  }, [series]);

  // Audience metrics are blanked wherever no creators were cast (see
  // audienceKnown), so the left-hand line can have fewer points than the
  // spend line — one point draws as a lone dot with nothing to join it to.
  // Counted here so the chart can say that outright instead of leaving the
  // reader to wonder what the stray marker is.
  const plottedAudience = series.reduce((n, row) => n + (audienceKnown(row) ? 1 : 0), 0);

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
  const active = donutSlices.find(s => s.name === hoverSvc) || null;

  /* Funnel stages in delivery order: the creators' combined audience, how
     many views that produced, and how many of those viewers engaged.

     Scaled to the LARGEST stage, not to reach. Reach is the follower base, but
     views are measured from the posts themselves — a reel that travels beyond
     its creator's followers genuinely outruns it (500K followers, 3.6M views),
     and scaling to reach pinned that stage at 730% of the track. */
  const funnelStages = useMemo(() => [
    { stage: "Reach",       value: totals.reach, display: fmtNum(totals.reach), color: P.pink   },
    { stage: "Views",       value: totals.views, display: fmtNum(totals.views), color: P.accent },
    { stage: "Engagements", value: totals.eng,   display: fmtNum(totals.eng),   color: P.amber  },
  ], [totals, P]);

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
          <StatTile label="Views"          value={totals.views}  loading={isLoading} color={P.accent} delta={trend?.views}  deltaLabel={trendUnit} P={P}/>
          <StatTile label="Engagements"    value={totals.eng}    loading={isLoading} color={P.amber}  delta={trend?.eng}    deltaLabel={trendUnit} P={P}/>
          <StatTile label="Total Spend"    value={totals.spend}  format={fmtINR} loading={isLoading} color={P.purple} delta={trend?.spend} deltaLabel={trendUnit} P={P}/>
            {/* No trend badge on CPV: a falling cost per view is the good
              outcome, and the shared badge paints every drop red. */}
          <StatTile label="CPV"            value={totals.cpv}    format={fmtCPV5} loading={isLoading} color={P.green} P={P}/>
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
              {toggle === "reach" ? "Reach · left axis" : "Engagements · left axis"}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-ink">
              <span className="inline-block h-px w-6 rounded" style={{ background: P.purple, height: 2 }}/>
              Spend · right axis
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
              <ComposedChart data={chartRows} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
                  // A month with no roster has no audience figure, so the line
                  // stops rather than being drawn down to zero and back.
                  connectNulls={false}
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

          {series.length > 1 && plottedAudience < series.length && (
            <p className="mt-2 text-[10px] text-mute">
              {toggle === "reach" ? "Reach" : "Engagements"} is plotted for {plottedAudience} of {series.length}{" "}
              {trendUnit}s — the {series.length - plottedAudience} without a creator on them yet have spend but no
              audience to measure, so the line stops rather than dropping to zero.
              {plottedAudience === 1 && " With a single point there is nothing to join it to, so it shows as one marker."}
            </p>
          )}
        </div>

        {/* Row 2: Funnel + Spend Split side by side */}
        <div className="grid gap-4 lg:grid-cols-2">

          <div className="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md">
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Funnel</div>
            <p className="mb-4 text-[10.5px] text-mute">Audience → Exposure → Engagement · width scaled to the largest stage</p>
            {isLoading
              ? <div className="flex h-[140px] items-center justify-center text-[12px] text-mute">Loading…</div>
              : <Funnel stages={funnelStages} />}
          </div>

          <div className="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md">
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Spend Split</div>
            <p className="mb-2 text-[10.5px] text-mute">By service · selected period</p>

            {isLoading ? (
              <div className="flex h-[240px] items-center justify-center text-[12px] text-mute">Loading…</div>
            ) : donutSlices.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-[12px] text-mute">No spend data</div>
            ) : (
              /* justify-center on both axes: the ring used to be pinned left
                 of a legend that was usually one line long, which left the
                 panel visibly lopsided against the funnel beside it. */
              <div className="flex flex-col items-center justify-center gap-6 py-2 sm:flex-row sm:gap-8">
                <div className="relative shrink-0">
                  {/* No cx/cy: Recharts centres on the box by default, and the
                      old hardcoded 75,75 inside a 160px box sat the ring two
                      pixels up and left of its own label. */}
                  <PieChart width={DONUT} height={DONUT}>
                    <Pie data={donutSlices} innerRadius={DONUT * 0.31} outerRadius={DONUT * 0.46}
                      dataKey="value" paddingAngle={2} strokeWidth={0}
                      onMouseEnter={(_, i) => setHoverSvc(donutSlices[i].name)}
                      onMouseLeave={() => setHoverSvc(null)}>
                      {donutSlices.map(s => (
                        <Cell key={s.name} fill={s.color}
                          opacity={!hoverSvc || hoverSvc === s.name ? 1 : 0.28}
                          style={{ transition: "opacity 200ms" }}/>
                      ))}
                    </Pie>
                  </PieChart>
                  {/* The hole answers whatever the cursor is asking: the
                      period's total, or the service under the pointer. */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <div className="text-[22px] font-bold leading-none" style={{ color: active?.color || "var(--color-ink)" }}>
                      {fmtINR(active ? active.value : totalSpend)}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-[8.5px] font-semibold uppercase leading-tight tracking-[0.1em] text-mute">
                      {active ? active.name : "Total"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {donutSlices.map(s => (
                    <button key={s.name} type="button"
                      // Focus as well as hover: the row is a focusable control,
                      // so tabbing to it has to light the same slice a cursor
                      // would rather than leaving a dead stop in the order.
                      onMouseEnter={() => setHoverSvc(s.name)} onMouseLeave={() => setHoverSvc(null)}
                      onFocus={() => setHoverSvc(s.name)} onBlur={() => setHoverSvc(null)}
                      className={`flex items-center justify-between gap-6 rounded-lg px-2 py-1 text-left transition-colors duration-200 ${hoverSvc === s.name ? "bg-accent/[0.06]" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }}/>
                        <span className="text-[11.5px] text-ink">{s.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="tnum block text-[12px] font-semibold text-ink">{fmtINR(s.value)}</span>
                        {/* Share of period spend — the reason to draw a ring
                            rather than a list in the first place. */}
                        <span className="tnum block text-[9.5px] text-mute">{((s.value / totalSpend) * 100).toFixed(0)}%</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-[10px] text-mute">
          Reach = creator follower sum.{" "}
          {measuredMix.measured > 0 ? (
            <>
              Views and engagements are measured from live post metrics
              {measuredMix.measured < measuredMix.total
                ? ` for ${measuredMix.measured} of ${measuredMix.total} creators; the rest are estimated until their posts are fetched.`
                : " across every creator on the roster."}{" "}
            </>
          ) : (
            <>Views and engagements are estimated from follower counts and avgER until post metrics are fetched. </>
          )}
          External CPV = committed spend ÷ views. Views can exceed reach when a post
          travels beyond the creator&rsquo;s own followers.
        </p>
      </div>
    </div>
  );
}
