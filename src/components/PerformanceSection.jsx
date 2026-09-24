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
import { PieChart, Pie, Cell } from "recharts";
import { useApp } from "../context";
import { rangeFor, parsePortalDate } from "../lib/dates";
import { fmtNum, fmtINRExact, fmtShare } from "../lib/format";
import { Funnel } from "./charts";
import { FlipCard, FlipSummary } from "./portal/FlipCard";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Ring diameter. Radii derive from it so the donut stays in proportion at any
// size, and it is big enough to hold the period total at a readable weight.
const DONUT = 260;

// Service→colour for the donut — reuses the app's palette (see context.js).
function serviceColor(name, P) {
  const n = name.toLowerCase();
  if (n.includes("influencer")) return P.accent;
  if (n.includes("aeo")) return P.green;
  if (n.includes("performance") || n.includes("ads")) return P.pink;
  if (n.includes("offline")) return P.amber;
  return P.purple;
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
  const { user } = useAuth();
  // What this section fetches by — see scopeParams in lib/api.js.
  const brandId = user?.brandId;
  const clientName = clientNameProp || user?.clientName;

  const [preset] = useState("6m"); // fixed; the period control was removed
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

  const totals = useMemo(() => {
    const sum = k => events.reduce((s, ev) => s + (ev[k] || 0), 0);
    const spend = sum("spend"), views = sum("views");
    return { views, reach: sum("reach"), eng: sum("engagements"), spend, cpv: views > 0 ? spend / views : 0 };
  }, [events]);

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
    <div className="mt-4">
      {/* Just the section name now — no card, no period control. The fetch
          still scopes to the last six months (`preset` below); there is
          simply no longer a way to change it from here. */}
      <div className="mb-5">
        <h3 className="font-serif text-[19px] italic font-semibold text-ink">Performance</h3>
        <p className="mt-0.5 text-[12.5px] text-sub">Funnel and spend split · last 6 months</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red/20 bg-red/[0.06] px-4 py-2.5 text-[12px] text-red">
          Could not load analytics — is the backend running? ({error})
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">

        <FlipCard
          cardClassName="overflow-hidden rounded-[16px] border border-line bg-glass p-6 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md"
          back={
            <FlipSummary
              padding="p-4"
              title="Funnel"
              hint="Audience → Exposure → Engagement, scaled to the largest stage."
              points={funnelPoints}
            />
          }
        >
          <div className="mb-[3px] font-serif text-[16px] italic font-semibold text-ink">Funnel</div>
          <p className="mb-5 text-[11px] text-mute">Audience → Exposure → Engagement · width scaled to the largest stage</p>
          {isLoading
            ? <div className="flex h-[220px] items-center justify-center text-[12px] text-mute">Loading…</div>
            : <Funnel stages={funnelStages} />}
        </FlipCard>

        <FlipCard
          cardClassName="overflow-hidden rounded-[16px] border border-line bg-glass p-6 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md"
          back={
            <FlipSummary
              padding="p-4"
              title="Spend Split"
              hint={donutSlices.length ? `${fmtINRExact(totalSpend)} committed across ${donutSlices.length} service${donutSlices.length === 1 ? "" : "s"} in the selected period.` : "No spend recorded for the selected period."}
              points={spendSplitPoints}
            />
          }
        >
          <div className="mb-[3px] font-serif text-[16px] italic font-semibold text-ink">Spend Split</div>
          <p className="mb-3 text-[11px] text-mute">By service · selected period</p>

          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-[12px] text-mute">Loading…</div>
          ) : donutSlices.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-[12px] text-mute">No spend data</div>
          ) : (
            /* justify-center on both axes: the ring used to be pinned left
               of a legend that was usually one line long, which left the
               panel visibly lopsided against the funnel beside it. */
            <div className="flex flex-col items-center justify-center gap-7 py-2 sm:flex-row sm:gap-10">
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
                  <div className="text-[26px] font-bold leading-none" style={{ color: active?.color || "var(--color-ink)" }}>
                    {fmtINRExact(active ? active.value : totalSpend)}
                  </div>
                  <div className="mt-2 line-clamp-2 text-[9.5px] font-semibold uppercase leading-tight tracking-[0.1em] text-mute">
                    {active ? active.name : "Total"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {donutSlices.map(s => (
                  <button key={s.name} type="button"
                    // Focus as well as hover: the row is a focusable control,
                    // so tabbing to it has to light the same slice a cursor
                    // would rather than leaving a dead stop in the order.
                    onMouseEnter={() => setHoverSvc(s.name)} onMouseLeave={() => setHoverSvc(null)}
                    onFocus={() => setHoverSvc(s.name)} onBlur={() => setHoverSvc(null)}
                    className={`flex items-center justify-between gap-8 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-200 ${hoverSvc === s.name ? "bg-accent/[0.06]" : ""}`}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-3 shrink-0 rounded-[3px]" style={{ background: s.color }}/>
                      <span className="text-[12.5px] text-ink">{s.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="tnum block text-[13px] font-semibold text-ink">{fmtINRExact(s.value)}</span>
                      {/* Share of period spend — the reason to draw a ring
                          rather than a list in the first place. */}
                      <span className="tnum block text-[10px] text-mute">{((s.value / totalSpend) * 100).toFixed(0)}%</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </FlipCard>
      </div>
    </div>
  );
}
