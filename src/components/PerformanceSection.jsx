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
import { fmtNum, fmtINR, fmtINRExact, fmtCPVTo, fmtCPV, fmtShare } from "../lib/format";
import { Funnel } from "./charts";
import { InfoHint } from "./portal/Shell";
import { FlipCard, FlipSummary } from "./portal/FlipCard";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/* What each view of the dual-axis chart is for. Kept to a line or two: it sits
   under the chart as a full-width footer, and a paragraph there pushed the
   chart itself down the panel and read as something to get past rather than
   something to read. Keyed by the toggle so a third view is one entry here. */
const CHART_BLURB = {
  reach: "Reach is the combined following of the creators live in each period; spend is what was committed in the same one. Climbing together means the budget is buying audience.",
  engagement: "Engagements are the likes, comments and shares your live posts earned; spend is what was committed in the same period. Outpacing spend means the work is doing the lifting.",
};

/* Dash pattern for the spend line, shared with its legend swatch so the key
   looks like the line it describes. Spend is dashed as well as differently
   coloured because hue alone fails on a printout, a pasted screenshot, or a
   monochrome display. */
const SPEND_DASH = "6 4";

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

/* No period-over-period ▲/▼ badge here. The tiles report the total for the
   period the reader chose; a delta against the previous bucket answered a
   different question than the number it sat on, and on a young account it
   mostly reported where the data starts (see audienceKnown above). */
function StatTile({ label, value, format = fmtNum, loading, color, info, back }) {
  const chrome = "rounded-[16px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md";
  const face = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="microlabel">{label}</div>
        {info && <InfoHint label={`${label} info`}>{info}</InfoHint>}
      </div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color }}>
        {loading ? "…" : <AnimatedNumber value={value} format={format} duration={900}/>}
      </div>
    </>
  );
  // No flip while loading — nothing to summarise yet, and it would flip back
  // to a stale front the instant the real number lands.
  if (back && !loading) {
    return (
      <FlipCard back={back} cardClassName={chrome} radius={16}>
        {face}
      </FlipCard>
    );
  }
  return <div className={chrome}>{face}</div>;
}

/* A key entry. The swatch is an SVG line rather than a coloured <span> so it
   can carry the same dash as the series it stands for — a solid block beside a
   dashed line is a key describing something else. */
function Legend({ color, dash, children }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink">
      <svg width="24" height="2" aria-hidden="true" className="shrink-0 overflow-visible">
        <line x1="0" y1="1" x2="24" y2="1" stroke={color} strokeWidth="2.5"
          strokeDasharray={dash} strokeLinecap="round"/>
      </svg>
      {children}
    </span>
  );
}

function neutralShade(color, alpha) {
  if (typeof color !== "string") return color;
  const match = color.replace("#", "").match(/^([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return color;
  const hex = match[1].length === 3
    ? match[1].split("").map((ch) => ch + ch).join("")
    : match[1];
  const value = parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PerformanceSection({ clientName: clientNameProp }) {
  const { P } = useApp();
  const { axisProps, gridStroke, tooltipStyle } = chartTheme(P);
  /* One source for both series' colours, so the line, its dot, its legend
     swatch and the single-bucket fallback cannot drift apart — which is what
     had happened: both lines drew in P.neutral while the legend showed a
     hardcoded #3B82F6/#9CA3AF, describing colours on no line. Cool vs warm
     rather than two neighbouring blues, so the lines stay separable where they
     cross and survive red/green colour blindness. */
  const LINE = { audience: P.accent, spend: P.gold };
  const { user } = useAuth();
  // What this section fetches by — see scopeParams in lib/api.js.
  const brandId = user?.brandId;
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
    if (!brandId && !clientName) return;
    setAnalytics(null);
    setError(null);
    PortalAPI.analytics(
      { brandId, clientName },
      range.from.toISOString(),
      range.to.toISOString()
    )
      .then(setAnalytics)
      .catch(e => setError(e.message));
  }, [brandId, clientName, range.from.toISOString(), range.to.toISOString()]);

  const spendByService = analytics?.spendByService || {};

  // Backend returns one dated event per campaign (already range-filtered);
  // build the chart series here per the selected interval so the Daily /
  // Weekly / Monthly toggle re-slices instantly without refetching.
  //
  // `live: false` events are campaigns with nothing posted yet. They are
  // dropped from every figure on this panel — spend is committed at booking
  // but performance starts at the first post, so leaving them in charted real
  // budget against no audience and divided CPV by views nobody had earned.
  // `!== false` rather than `=== true`: a payload predating the flag can't be
  // gated, and silently blanking it would be worse than not gating.
  const events = useMemo(() =>
    (analytics?.events || [])
      .filter(ev => ev.live !== false)
      // The backend still calls measured post views "impressions"; the
      // portal says views, so the rename lives here and nowhere else.
      .map(ev => ({ ...ev, views: ev.impressions, date: parsePortalDate(ev.date) }))
      .filter(ev => ev.date)
  , [analytics]);

  // What the panel is NOT reporting, so it can say so rather than presenting a
  // partial account as the whole one. Pre-aggregated server-side on the same
  // rule as spendByService.
  const excluded = analytics?.excluded || null;

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
    // Trimmed at BOTH ends: an empty bucket before the first campaign and an
    // empty one after the last are both periods with no data, not periods that
    // performed at zero — and either one drawn as 0 is a cliff on the line.
    return buildTimeSeries(events, { from, to: range.to }, chartInterval, SERIES_FIELDS,
      { trimLeading: true, trimTrailing: true });
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
    { stage: "Reach",       value: totals.reach, display: fmtNum(totals.reach), color: neutralShade(P.neutral, 0.88) },
    { stage: "Views",       value: totals.views, display: fmtNum(totals.views), color: neutralShade(P.neutral, 0.7) },
    { stage: "Engagements", value: totals.eng,   display: fmtNum(totals.eng),   color: neutralShade(P.neutral, 0.55) },
  ], [totals, P]);

  // What the dual-axis line actually SAYS, not what it plots a second time as
  // a table. Compares the metric on the left axis against spend on the right
  // one across the same window the chart draws — first plotted point vs
  // last — so the flip answers "is the budget working" rather than repeating
  // the two totals the front already prints in the KPI strip above it.
  const trendPoints = useMemo(() => {
    const metricKey = toggle === "reach" ? "reach" : "engagements";
    const metricLabel = toggle === "reach" ? "Reach" : "Engagements";
    const known = chartRows.filter((r) => r[metricKey] != null);
    const pts = [];

    if (known.length >= 2 && chartRows.length >= 2) {
      const first = known[0], last = known[known.length - 1];
      const spendFirst = chartRows[0].spend || 0;
      const spendLast = chartRows[chartRows.length - 1].spend || 0;
      const metricChange = first[metricKey] > 0 ? ((last[metricKey] - first[metricKey]) / first[metricKey]) * 100 : null;
      const spendChange = spendFirst > 0 ? ((spendLast - spendFirst) / spendFirst) * 100 : null;

      if (metricChange != null && spendChange != null) {
        if (metricChange >= 0 && spendChange >= 0) {
          pts.push(
            metricChange >= spendChange
              ? `${metricLabel} has grown faster than spend across this window — the budget is reaching more per rupee than it was at the start.`
              : `Spend has grown faster than ${metricLabel.toLowerCase()} across this window — the same budget is buying less than it was at the start.`
          );
        } else if (metricChange < 0 && spendChange >= 0) {
          pts.push(`Spend is up over this window while ${metricLabel.toLowerCase()} is down — worth a look at what changed.`);
        } else if (metricChange >= 0 && spendChange < 0) {
          pts.push(`${metricLabel} held up even as spend came down over this window — an efficient stretch.`);
        } else {
          pts.push(`Both spend and ${metricLabel.toLowerCase()} pulled back over this window.`);
        }
      }
    } else if (known.length === 1) {
      pts.push(`Only one ${trendUnit} with an audience figure falls in this window — not enough to read a direction yet.`);
    } else {
      pts.push("No audience figure is plotted yet for this window — spend is committed, but no creators have been cast to measure against it.");
    }

    if (totals.cpv > 0) {
      pts.push(`Overall this period, that works out to ${fmtCPV(totals.cpv)} per view across ${fmtNum(totals.views)} views.`);
    }
    return pts;
  }, [chartRows, toggle, totals, trendUnit]);

  // The funnel's own read: how much of the reach converted to a view, and how
  // much of that view converted to an action — the two ratios the three bars
  // exist to make visible, stated once instead of the three totals it already
  // shows.
  const funnelPoints = useMemo(() => {
    const { reach, views, eng } = totals;
    const pts = [];
    if (reach > 0 && views > 0) {
      const ratio = views / reach;
      pts.push(
        ratio >= 1
          ? `Views ran at ${ratio.toFixed(1)}× reach — posts travelled well beyond the creators' own followers.`
          : `Views came in at ${fmtShare(ratio * 100)} of reach — most of what was seen stayed inside the creators' existing followers.`
      );
    }
    if (views > 0 && eng > 0) {
      const er = (eng / views) * 100;
      pts.push(`${fmtShare(er)} of views turned into a like, comment or share — roughly ${Math.max(1, Math.round(100 / er))} views per engagement.`);
    }
    if (!pts.length) pts.push("Not enough measured activity yet to read a funnel here.");
    return pts;
  }, [totals]);

  // Spend Split's own read: which service the period's budget actually went
  // to and how concentrated that is, rather than re-listing every slice's
  // rupee value beside a ring that already shows it.
  const spendSplitPoints = useMemo(() => {
    if (!donutSlices.length || totalSpend <= 0) return [];
    const sorted = [...donutSlices].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const topShare = (top.value / totalSpend) * 100;
    const pts = [];
    pts.push(
      sorted.length === 1
        ? `All of this period's spend went to ${top.name}.`
        : `${top.name} took the largest share at ${fmtShare(topShare)} of the period's spend.`
    );
    if (sorted.length > 1) {
      const top2Share = ((sorted[0].value + sorted[1].value) / totalSpend) * 100;
      pts.push(
        top2Share >= 75
          ? `${sorted[0].name} and ${sorted[1].name} together account for ${fmtShare(top2Share)} of it — spend is concentrated in a couple of services rather than spread thin.`
          : `The rest is spread across ${sorted.length - 1} other service${sorted.length - 1 === 1 ? "" : "s"} — no single line dominates the period.`
      );
    }
    return pts;
  }, [donutSlices, totalSpend]);

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

        {/* KPI stat strip — the period's totals, flat. */}
        <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {/* Same figure as the Overview's "Combined audience" tile, so the
              same neutral treatment — a coloured hue on it claimed a status
              the number doesn't carry. */}
          <StatTile label="Total Reach"    value={totals.reach}  loading={isLoading} color={P.neutral}
            back={<FlipSummary padding="px-3.5 py-3" title="Total Reach"
              hint="Combined following of creators live this period." />}/>
          <StatTile label="Views"          value={totals.views}  loading={isLoading} color={P.neutral}
            back={<FlipSummary padding="px-3.5 py-3" title="Views"
              hint={measuredMix.measured > 0
                ? (measuredMix.measured < measuredMix.total ? "Measured for some creators; rest estimated." : "Measured across the whole roster.")
                : "Estimated until post metrics are fetched."} />}/>
          <StatTile label="Engagements"    value={totals.eng}    loading={isLoading} color={P.neutral}
            back={<FlipSummary padding="px-3.5 py-3" title="Engagements"
              hint="Likes, comments & shares on live posts." />}/>
          <StatTile label="Total Spend"    value={totals.spend}  format={fmtINRExact} loading={isLoading} color={P.neutral}
            back={<FlipSummary padding="px-3.5 py-3" title="Total Spend"
              hint="Committed across campaigns counted this period." />}/>
          {/* The only rate on a strip of totals, and the only figure here where
              lower is better — hence the one tile carrying a hue. fmtCPVTo,
              not fmtCPV, so the count-up doesn't re-decide its decimal count
              every frame; see lib/format.js. */}
          <StatTile label="CPV"            value={totals.cpv}    format={fmtCPVTo(totals.cpv)} loading={isLoading} color={P.green}
            info="Cost per view across every campaign in the selected period — committed spend ÷ measured views, to two significant digits. For one campaign's own CPV, open that campaign."
            back={<FlipSummary padding="px-3.5 py-3" title="Cost per view"
              hint={`${fmtINRExact(totals.spend)} ÷ ${fmtNum(totals.views)} views`} />}/>
        </div>

        {/* Says what the figures above leave out. Without it the panel reports
            a smaller spend than the board shows committed, with nothing to
            explain the difference. */}
        {!isLoading && excluded?.campaigns > 0 && (
          <p className="mb-4 -mt-1 text-[10.5px] text-mute">
            {excluded.campaigns} campaign{excluded.campaigns === 1 ? " has" : "s have"} no post live yet
            {excluded.spend > 0 && <> ({fmtINRExact(excluded.spend)} committed)</>} and {excluded.campaigns === 1 ? "is" : "are"} left
            out of every figure here — {excluded.campaigns === 1 ? "it joins" : "they join"} the moment {excluded.campaigns === 1 ? "its" : "their"} first post goes up.
          </p>
        )}

        {/* Row 1: Dual-axis line chart */}
        <FlipCard
          className="mb-4"
          cardClassName="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md"
          back={
            <FlipSummary
              padding="p-4"
              title={toggle === "reach" ? "Reach vs Spend" : "Engagement vs Spend"}
              hint={CHART_BLURB[toggle]}
              points={trendPoints}
              note={series.length > 1 ? `Plotted across ${series.length} ${intervalLabel} bucket${series.length === 1 ? "" : "s"}, ${plottedAudience} with an audience figure.` : undefined}
            />
          }
        >
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

          <div className="mb-3 flex flex-wrap gap-5">
            <Legend color={LINE.audience}>
              {toggle === "reach" ? "Reach · left axis" : "Engagements · left axis"}
            </Legend>
            <Legend color={LINE.spend} dash={SPEND_DASH}>Spend · right axis</Legend>
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
                    style={{ color: LINE.audience }}>
                    {fmtNum(toggle === "reach" ? series[0].reach : series[0].engagements)}
                  </div>
                  <div className="mt-1.5 text-[11px] text-sub">
                    {toggle === "reach" ? "Reach" : "Engagements"}
                  </div>
                </div>
                <div>
                  <div className="text-[26px] font-bold leading-none" style={{ color: LINE.spend }}>
                    {fmtINRExact(series[0].spend)}
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
                  formatter={(v, name) => name === "Spend" ? [fmtINRExact(v), name] : [fmtNum(v), name]}
                />
                {/* Dot rings take P.surface, not "#fff" — white rings on the
                    dark theme read as pinholes punched through the line. */}
                <Line yAxisId="left" type="monotone"
                  dataKey={toggle === "reach" ? "reach" : "engagements"}
                  name={toggle === "reach" ? "Reach" : "Engagements"}
                  stroke={LINE.audience}
                  strokeWidth={2.5}
                  // A month with no roster has no audience figure, so the line
                  // stops rather than being drawn down to zero and back.
                  connectNulls={false}
                  dot={showDots ? { r: 4, fill: LINE.audience, strokeWidth: 2, stroke: P.surface } : false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: P.surface }} />
                <Line yAxisId="right" type="monotone"
                  dataKey="spend" name="Spend"
                  stroke={LINE.spend}
                  strokeWidth={2.5}
                  strokeDasharray={SPEND_DASH}
                  dot={showDots ? { r: 4, fill: LINE.spend, strokeWidth: 2, stroke: P.surface } : false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: P.surface }} />
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

          {/* Full-width footer under the chart, swapping with the toggle — the
              two views answer different questions, and one caption for both
              left the reader to work out which they were looking at. */}
          <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-sub">
            {CHART_BLURB[toggle]}
          </p>
        </FlipCard>

        {/* Row 2: Funnel + Spend Split side by side */}
        <div className="grid gap-4 lg:grid-cols-2">

          <FlipCard
            cardClassName="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md"
            back={
              <FlipSummary
                padding="p-4"
                title="Funnel"
                hint="Audience → Exposure → Engagement, scaled to the largest stage."
                points={funnelPoints}
              />
            }
          >
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Funnel</div>
            <p className="mb-4 text-[10.5px] text-mute">Audience → Exposure → Engagement · width scaled to the largest stage</p>
            {isLoading
              ? <div className="flex h-[140px] items-center justify-center text-[12px] text-mute">Loading…</div>
              : <Funnel stages={funnelStages} />}
          </FlipCard>

          <FlipCard
            cardClassName="overflow-hidden rounded-[16px] border border-line bg-[--color-glass] p-4 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md"
            back={
              <FlipSummary
                padding="p-4"
                title="Spend Split"
                hint={donutSlices.length ? `${fmtINRExact(totalSpend)} committed across ${donutSlices.length} service${donutSlices.length === 1 ? "" : "s"} in the selected period.` : "No spend recorded for the selected period."}
                points={spendSplitPoints}
              />
            }
          >
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
                      {fmtINRExact(active ? active.value : totalSpend)}
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
                        <span className="tnum block text-[12px] font-semibold text-ink">{fmtINRExact(s.value)}</span>
                        {/* Share of period spend — the reason to draw a ring
                            rather than a list in the first place. */}
                        <span className="tnum block text-[9.5px] text-mute">{((s.value / totalSpend) * 100).toFixed(0)}%</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FlipCard>
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
