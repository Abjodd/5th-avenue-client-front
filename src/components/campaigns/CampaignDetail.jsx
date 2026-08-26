// src/components/campaigns/CampaignDetail.jsx — a campaign, opened in the
// main view rather than in a drawer over the board. Overview / Brief /
// Creators / Growth / Queries tabs. A campaign carries a roster, a brief, a
// sentiment read and several charts; 680px of drawer over a blurred board was
// never enough room for any of it, and it hid the page you came from.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Target, Users, MessageSquareQuote, Package, IndianRupee, CalendarRange,
  FileText, Eye, Heart, MessageCircle, Share2, FileSignature, Clapperboard, Check,
} from "lucide-react";
import { useApp } from "../../context";
import { PHASES } from "../../lib/phases";
import { PHASE_ICONS } from "../../lib/phaseIcons";
import { chartTheme } from "../../lib/chartTheme";
import { fmtNum, fmtCPV, prettyDate, dayLabel } from "../../lib/format";
import { Dot } from "../Dot";
import { StatusPill, StatusLegend } from "../StatusPill";
import AnimatedNumber from "../AnimatedNumber";
import { STATUS_MAP, ACTIONABLE_STATUSES, BCOLORS, chipOn } from "./mapping";

const useP = () => useApp().P;

/* ═══ PHASE TRACKER ═══ */
function PhaseTracker({ currentPhase }) {
  const P = useP();
  const idx = PHASES.findIndex(p => p.id === currentPhase);
  return (
    <div className="mb-4 rounded-[18px] border border-line bg-[--color-glass] px-6 py-5 shadow-card backdrop-blur-xl">
      <div className="flex items-center">
        {PHASES.map((p, i) => {
          const isCur = i === idx, isDone = i < idx;
          /* The last phase is an end state, not a stop along the way. Landing on
             it was painted with the in-progress accent — a finished campaign
             showing a blue node and a pulsing dot, reading as "still working on
             it" when every phase behind it had already gone green. It gets the
             same green as the cleared phases, and no pulse: nothing is in
             flight any more. */
          const isEnd = isCur && p.id === "completed";
          const green = isDone || isEnd;
          const Icon = PHASE_ICONS[p.id];
          return (
            <div key={p.id} className="flex flex-1 items-center">
              <div className="relative flex flex-1 flex-col items-center gap-[6px]">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 340, damping: 24 }}
                  className={`flex size-10 items-center justify-center rounded-[12px] border-2 ${green?"border-green bg-green/[0.08] text-green":isCur?"border-accent bg-accent/[0.08] text-accent":"border-ink/5 bg-well text-mute"}`}
                  style={{ boxShadow: isEnd ? `0 0 16px ${P.green}35` : isCur ? `0 0 16px ${P.accent}35` : isDone ? `0 2px 8px ${P.green}20` : "none" }}>
                  {/* A cleared phase becomes a tick; the rest keep their own
                      mark, tinted by state rather than by an emoji's palette. */}
                  {isDone ? <Check size={18} strokeWidth={2.6} /> : <Icon size={18} strokeWidth={1.9} />}
                </motion.div>
                <span className={`text-center text-[10.5px] uppercase tracking-[0.04em] ${isEnd?"font-bold text-green":isCur?"font-bold text-ink":isDone?"font-medium text-green":"font-normal text-mute"}`}>{p.label}</span>
                {isCur && !isEnd && <div className="pulse absolute -top-1 right-[20%] size-2 rounded-full bg-accent"/>}
              </div>
              {i < PHASES.length-1 && (<div className={`mb-5 h-0.5 max-w-10 flex-[0_0_100%] rounded-full transition-colors duration-300 ${isDone?"bg-green":"bg-ink/[0.05]"}`}/>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ BUDGET CARD ═══ */
// Plain figure only — the DB doesn't store an operational budget split, so
// none is invented here. A real split can return once the backend has one.
//
// `pending` is a campaign that was raised before a budget was agreed. It reads
// smaller and in amber, with a line saying so: the same card printing a bold
// "To be confirmed" at 18px would give a non-figure the visual weight of a
// figure, on a card whose whole job is to state one.
function BudgetCard({ value, pending }) {
  return (
    <div className="rounded-[14px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Budget</div>
      {pending ? (
        <>
          <div className="mt-1 text-[13px] font-semibold text-amber">To be confirmed</div>
          <div className="mt-0.5 text-[10px] leading-snug text-sub">Not yet agreed — the campaign is running in the meantime.</div>
        </>
      ) : (
        <div className="mt-1 text-[18px] font-bold text-ink">{value}</div>
      )}
    </div>
  );
}

/* ═══ HBARS ═══ */
function HBars({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 0.1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-right text-[10px] text-sub">{d.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-well">
            <motion.div className="h-full min-w-0.5 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${(d.value/max)*100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
              style={{ background: BCOLORS[i % BCOLORS.length] }}/>
          </div>
          <span className="w-8 shrink-0 text-[10px] font-semibold text-ink">{typeof d.value === "number" && d.value % 1 ? d.value.toFixed(1) : d.value}{d.suffix || ""}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══ METRIC CARD ════════════════════════════════════════════════════════════
   A figure, and optionally one of two ways to go deeper: an inline breakdown
   (`breakdowns`) or a jump elsewhere (`onOpen`).

   Only a card that OWNS its row gets the inline breakdown. In a three-up grid
   the expansion stretches its two neighbours to match, so opening the roster
   split left Budget and Deliverables as tall empty boxes — which is why
   Creators now sends you to the Creators tab, where the same roster is listed
   in full rather than as three bars. */
function MetricCard({ label, value, breakdowns, onOpen, suffix = "" }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(breakdowns ? Object.keys(breakdowns)[0] : null);
  const live = value !== "—" && value !== "0";
  const has = breakdowns && Object.keys(breakdowns).length > 0 && live;
  const jumps = !!onOpen && live;
  return (
    <div className={`rounded-[14px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md ${has||jumps?"group cursor-pointer":""}`}
      onClick={jumps ? onOpen : () => has && setOpen(!open)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
        {has && <span className="text-[9px] text-accent">{open ? "▴" : "▾"}</span>}
        {jumps && <span className="text-[11px] text-accent opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">→</span>}
      </div>
      <div className={`mt-1 text-[18px] font-bold ${value==="—"||value==="0"?"text-donetxt":"text-ink"}`}>{value}</div>
      <AnimatePresence initial={false}>
        {open && breakdowns && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-2.5 border-t border-line pt-2.5">
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.keys(breakdowns).map(f => (
                  <button key={f} onClick={e => { e.stopPropagation(); setFilter(f); }}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-all duration-150 ${filter===f?chipOn:"border-line bg-transparent text-mute"}`}>{f}</button>
                ))}
              </div>
              <HBars data={suffix ? (breakdowns[filter]||[]).map(d => ({ ...d, suffix })) : breakdowns[filter]||[]}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ LIVE PERFORMANCE — the three figures a brand actually reads ═══════════
   Views, what they earned, and what a view cost — on one line.

   It used to spread views / likes / comments / shares across four equal tiles,
   which gave three components of a single number the same standing as the
   number itself, and then restated CPV in a detached card below,
   away from the views it is computed from. Likes, comments and shares haven't
   gone anywhere: they're one hover inside the total they add up to.

   CPV here is budget ÷ views, shown to six decimal places rather than
   rounded to a currency-style two — at typical view counts a campaign's
   real cost-per-view is a fraction of a paisa, and rounding to 2dp collapses
   most campaigns to the same "₹0.00". */
function LivePerformance({ totals, lastFetched, cpv }) {
  const P = useP();
  const [openBd, setOpenBd] = useState(false);
  if (!totals) return null;

  const parts = [
    ["Likes", totals.likes, Heart],
    ["Comments", totals.comments, MessageCircle],
    ["Shares", totals.forwards, Share2],
  ].filter(([, v]) => v > 0);
  const eng = parts.reduce((sum, [, v]) => sum + v, 0);

  const tiles = [
    totals.views > 0 && { label: "Views", node: <AnimatedNumber value={totals.views} format={fmtNum} duration={900}/> },
    eng > 0 && { label: "Engagements", node: <AnimatedNumber value={eng} format={fmtNum} duration={900}/>, parts },
    // cpv is null until the campaign has both a budget and measured views, so
    // this drops out on its own rather than printing an invented rate. Shown
    // to 6dp (not run through fmtCPV's currency rounding) since budget/views
    // is routinely a sub-paisa number.
    cpv != null && { label: "CPV", node: `₹${cpv.toFixed(6)}` },
  ].filter(Boolean);
  if (!tiles.length) return null;

  return (
    // z-20 is what makes the breakdown readable: the cards below carry
    // backdrop-blur, so in DOM order they painted over a popover that had only
    // a local z-index inside this panel's own blur-induced stacking context.
    <div className="relative z-20 mb-3 mt-2 rounded-[16px] border border-line bg-[--color-glass] shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5">
          <Dot color={P.green} sz={6}/><span className="microlabel">Live performance</span>
        </span>
        {lastFetched && <span className="text-[10px] text-mute">updated {prettyDate(lastFetched)}</span>}
      </div>
      <div className="grid divide-x divide-line" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
        {tiles.map(t => (
          <div key={t.label} className="relative px-4 py-3"
            onMouseEnter={() => t.parts && setOpenBd(true)}
            onMouseLeave={() => setOpenBd(false)}>
            <div className="tnum text-[19px] font-bold leading-none text-ink">{t.node}</div>
            <div className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-mute">
              {/* The dotted rule is the only thing telling you the total opens
                  — without it the breakdown is a feature you find by accident. */}
              <span className={t.parts ? "cursor-help border-b border-dotted border-mute/60 pb-px" : ""}>{t.label}</span>
              {t.parts && (
                <span className="inline-flex items-center justify-center size-4 rounded-full border border-mute/40 text-[8px] font-bold text-mute">i</span>
              )}
            </div>
            {/* The breakdown unfurls sideways into the tile's own empty half,
                not downward. Stacked under the figure it was taller than the
                row and hung over the Budget / Creators / Deliverables cards —
                covering the thing you might click next to read three numbers.
                Laid out in a line it fits beside the total, inside the panel.

                Hover-only by nature, so it never appears on touch, which is
                also where a tile is too narrow to hold it. */}
            <AnimatePresence>
              {t.parts && openBd && (
                <motion.div
                  initial={{ opacity: 0, x: -8, y: "-50%" }} animate={{ opacity: 1, x: 0, y: "-50%" }} exit={{ opacity: 0, x: -8, y: "-50%" }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-panel pointer-events-none absolute right-3 top-1/2 z-30 flex items-center gap-3.5 rounded-[12px] px-3.5 py-2 shadow-[0_10px_26px_rgba(25,22,17,0.13)]">
                  {t.parts.map(([label, v, Icon]) => (
                    <div key={label} className="flex items-center gap-1.5 whitespace-nowrap">
                      <Icon size={12} strokeWidth={2} className="shrink-0 text-mute"/>
                      <div>
                        <div className="tnum text-[12.5px] font-semibold leading-none text-ink">{fmtNum(v)}</div>
                        {/* A share that rounds to zero still isn't zero — comments are
                            routinely a fraction of a percent of engagements, and
                            printing "0%" next to 3K reads as a broken number. */}
                        <div className="mt-[3px] text-[8.5px] font-semibold uppercase tracking-[0.06em] text-mute">
                          {label} · {(v / eng) * 100 < 0.5 ? "<1%" : `${Math.round((v / eng) * 100)}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ GROWTH — how the campaign's live posts built up over time ═══════════════
   One point per day that has a reading, from the append-only history the
   backend records on every post-metrics refresh (trackingHistory.js). Until
   that existed, each refresh overwrote the previous numbers, so this view was
   impossible: the campaign only ever had a "now".

   Cumulative totals, so the area only ever climbs — a dip would mean a creator
   went unmeasured, which growthSeries() carries forward specifically to avoid.
   Views and engagements share an axis-free area chart rather than a dual axis:
   the shape of the build is the point here, and the exact numbers are one
   hover away. */
function GrowthChart({ growth, perCreator }) {
  const P = useP();
  const { axisProps, gridStroke, tooltipStyle } = chartTheme(P);
  const [metric, setMetric] = useState("views");
  const [split, setSplit] = useState(false);

  const last = growth[growth.length - 1];
  const first = growth[0];
  const gained = last[metric] - first[metric];
  const color = metric === "views" ? P.accent : P.pink;
  const label = metric === "views" ? "Views" : "Engagements";

  // One colour per creator. Cycled rather than hashed: a roster is small, and
  // the legend is right there, so stable-per-name matters less than the lines
  // being easy to tell apart.
  const LINE_COLORS = [P.accent, P.pink, P.teal, P.amber, P.purple, P.green];
  const canSplit = perCreator.series.length > 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Total {label.toLowerCase()}</div>
          <div className="mt-1 text-[26px] font-bold leading-none" style={{ color }}>
            <AnimatedNumber value={last[metric]} format={fmtNum} duration={900}/>
          </div>
          <div className="mt-1.5 text-[11px] text-sub">
            {/* Growth across the window we have readings for — NOT "since the
                post went live". The first point is the first measurement, which
                may already have been well after posting. */}
            +{fmtNum(gained)} since {dayLabel(first.date)} · {growth.length} readings
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex rounded-full bg-well p-0.5">
            {[["views", "Views"], ["engagements", "Engagements"]].map(([id, l]) => (
              <button key={id} onClick={() => setMetric(id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-200 ${metric===id?"bg-[--color-glass] text-accent shadow-sm":"text-mute hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
          {/* Only offered when there is more than one creator — "per creator"
              on a single-creator roster is the same chart with extra words. */}
          {canSplit && (
            <div className="flex rounded-full bg-well p-0.5">
              {[[false, "Combined"], [true, "Per creator"]].map(([id, l]) => (
                <button key={String(id)} onClick={() => setSplit(id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-200 ${split===id?"bg-[--color-glass] text-accent shadow-sm":"text-mute hover:text-ink"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        {split ? (
          <LineChart data={perCreator.rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false}/>
            <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel}
              scale="point" padding={{ left: 0, right: 0 }} minTickGap={18}/>
            <YAxis {...axisProps} tickFormatter={fmtNum} width={46}/>
            <Tooltip {...tooltipStyle} labelFormatter={dayLabel} formatter={(v) => fmtNum(v)}/>
            {perCreator.series.map((s, i) => (
              <Line key={s.key} type="monotone"
                dataKey={`${s.key}_${metric}`} name={s.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.2}
                // Gaps are real: a creator has no line before their first
                // reading, and connectNulls would draw one from nowhere.
                connectNulls={false}
                dot={perCreator.rows.length <= 20 ? { r: 2.5, strokeWidth: 2, stroke: P.surface } : false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: P.surface }}/>
            ))}
          </LineChart>
        ) : (
          <AreaChart data={growth} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28}/>
                <stop offset="100%" stopColor={color} stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} vertical={false}/>
            {/* scale="point" so the series starts hard against the left edge
                instead of being inset by half a band. */}
            <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel}
              scale="point" padding={{ left: 0, right: 0 }} minTickGap={18}/>
            <YAxis {...axisProps} tickFormatter={fmtNum} width={46}/>
            <Tooltip {...tooltipStyle} labelFormatter={dayLabel} formatter={(v) => [fmtNum(v), label]}/>
            <Area type="monotone" dataKey={metric} name={label}
              stroke={color} strokeWidth={2.5} fill="url(#growthFill)"
              dot={growth.length <= 20 ? { r: 3, fill: color, strokeWidth: 2, stroke: P.surface } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: P.surface }}/>
          </AreaChart>
        )}
      </ResponsiveContainer>

      {/* Legend only in split mode; one line needs no key. */}
      {split && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {perCreator.series.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink">
              <span className="inline-block h-[2px] w-5 rounded"
                style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}/>
              {s.name}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-mute">
        Cumulative totals {split ? "per creator" : "across every live post on this campaign"}, recorded
        each time post metrics are refreshed. Creators measured on different days carry their
        last known figure forward, so the line reflects reach building rather than
        the refresh schedule.
      </p>
    </div>
  );
}

/* ═══ SENTIMENT — positivityScore gradient bar + per-creator commentAnalysis ═══ */
function SentimentStrip({ avgPositivity, creators }) {
  const P = useP();
  const quotes = (creators || []).filter(cr => cr.tracking?.commentAnalysis);
  if (avgPositivity == null && !quotes.length) return null;
  return (
    <div className="mb-3 rounded-[16px] border border-line bg-[--color-glass] px-4 py-3.5 shadow-sm backdrop-blur-md">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-mute">Audience Sentiment</div>
      {avgPositivity != null && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] text-sub">Comment positivity</span>
            <span className="text-[15px] font-bold" style={{ color: avgPositivity >= 66 ? P.green : avgPositivity >= 40 ? P.amber : P.red }}>
              <AnimatedNumber value={avgPositivity} format={v => `${Math.round(v)}/100`} duration={900}/>
            </span>
          </div>
          <div className="relative h-[7px] rounded-full" style={{ background: `linear-gradient(to right, ${P.red}55, ${P.amber}55, ${P.green}55)` }}>
            <motion.div
              className="absolute -top-[3px] h-[13px] w-[3px] rounded-full bg-ink shadow-[0_1px_4px_rgba(25,22,17,0.4)]"
              initial={{ left: 0 }} animate={{ left: `${Math.min(100, Math.max(0, avgPositivity))}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}/>
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-mute"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
        </div>
      )}
      {quotes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {quotes.map((cr, i) => (
            <div key={i} className="rounded-[12px] border border-line bg-[--color-glass] px-3 py-2 shadow-sm">
              <div className="text-[11.5px] italic leading-normal text-ink">"{cr.tracking.commentAnalysis}"</div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-mute">
                <span className="font-semibold text-accent">{cr.name}</span>
                {cr.tracking.positivityScore != null && <span>· positivity {cr.tracking.positivityScore}/100</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ OBSERVATIONS + STRATEGY INSIGHTS ═══ */
function Observations({ creators, topAssets }) {
  const obs = [];
  if (topAssets?.length) { const best = topAssets[0]; obs.push(`Top performer: ${best.creator} with ${best.label.split("—")[1]?.trim() || "strong results"}.`); }
  if (creators?.length > 1) { const rates = creators.filter(c => c.engRate && c.engRate !== "—").map(c => ({ n: c.name, r: parseFloat(c.engRate) })); if (rates.length) { const top = rates.sort((a, b) => b.r - a.r)[0]; obs.push(`Highest engagement: ${top.n} at ${top.r}%.`); const avg = (rates.reduce((s, r) => s + r.r, 0) / rates.length).toFixed(1); obs.push(`Average creator engagement: ${avg}% across ${rates.length} creators.`); } }
  if (creators?.length) { const niches = {}; creators.forEach(c => { niches[c.niche] = (niches[c.niche] || 0) + 1; }); const topN = Object.entries(niches).sort((a, b) => b[1] - a[1])[0]; if (topN) obs.push(`Most represented niche: ${topN[0]} (${topN[1]} creator${topN[1] > 1 ? "s" : ""}).`); }
  if (creators?.length) { const platforms = {}; creators.forEach(c => { platforms[c.platform] = (platforms[c.platform] || 0) + 1; }); const topP = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]; if (topP) obs.push(`Primary platform: ${topP[0]} (${topP[1]} of ${creators.length} creators).`); }
  if (!obs.length) return null;

  // Generate strategy insights by connecting observations
  const strategies = [];
  if (creators?.length > 1) {
    const rates = creators.filter(c => c.engRate && c.engRate !== "—").map(c => ({ n: c.name, r: parseFloat(c.engRate), niche: c.niche, size: c.size, platform: c.platform }));
    if (rates.length > 1) {
      const top = rates.sort((a, b) => b.r - a.r)[0];
      const bottom = rates[rates.length - 1];
      if (top.r > bottom.r * 1.3) { strategies.push(`${top.niche} creators are outperforming others — consider increasing allocation to this niche in future campaigns.`); }
      const igCount = rates.filter(r => r.platform === "Instagram").length;
      const ytCount = rates.filter(r => r.platform === "YouTube").length;
      if (igCount > 0 && ytCount > 0) {
        const igAvg = rates.filter(r => r.platform === "Instagram").reduce((s, r) => s + r.r, 0) / igCount;
        const ytAvg = rates.filter(r => r.platform === "YouTube").reduce((s, r) => s + r.r, 0) / ytCount;
        if (ytAvg > igAvg * 1.1) strategies.push(`YouTube creators show ${((ytAvg / igAvg - 1) * 100).toFixed(0)}% higher engagement than Instagram — consider shifting budget toward long-form content.`);
        else if (igAvg > ytAvg * 1.1) strategies.push(`Instagram Reels driving ${((igAvg / ytAvg - 1) * 100).toFixed(0)}% higher engagement — double down on short-form content.`);
      }
    }
    const sizes = {}; rates.forEach(r => { if (!sizes[r.size]) sizes[r.size] = { total: 0, count: 0 }; sizes[r.size].total += r.r; sizes[r.size].count++; });
    const sizeAvgs = Object.entries(sizes).map(([k, v]) => ({ size: k, avg: v.total / v.count })).sort((a, b) => b.avg - a.avg);
    if (sizeAvgs.length > 1 && sizeAvgs[0].avg > sizeAvgs[sizeAvgs.length - 1].avg * 1.2) {
      strategies.push(`${sizeAvgs[0].size} creators deliver the best engagement-to-cost ratio — prioritise this tier for ROI-focused campaigns.`);
    }
  }
  if (topAssets?.length > 1) { strategies.push(`Repurpose top-performing assets as paid ad creatives to maximise reach with proven content.`); }
  if (creators?.length >= 3) {
    const regions = {}; creators.forEach(c => { regions[c.region] = (regions[c.region] || 0) + 1; });
    const regionCount = Object.keys(regions).length;
    if (regionCount <= 2) strategies.push(`Current creators are concentrated in ${regionCount} region${regionCount > 1 ? "s" : ""}. Expanding to new regions could unlock untapped audiences.`);
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Observations</div>
      <div className={`rounded-[14px] border border-line bg-[--color-glass] px-4 py-3 shadow-sm backdrop-blur-md ${strategies.length?"mb-3":""}`}>
        {obs.map((o, i) => (
          <div key={i} className={`flex items-start gap-1.5 ${i < obs.length-1 ? "mb-1.5" : ""}`}>
            <span className="mt-[3px] shrink-0 text-[10px] text-accent">●</span>
            <span className="text-[12px] leading-normal text-ink">{o}</span>
          </div>
        ))}
      </div>
      {strategies.length > 0 && (<>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Strategy Insights</div>
        <div className="rounded-[14px] border border-accent/[0.1] bg-accent/[0.03] px-4 py-3 shadow-sm backdrop-blur-md">
          {strategies.map((s, i) => (
            <div key={i} className={`flex items-start gap-1.5 ${i < strategies.length-1 ? "mb-1.5" : ""}`}>
              <span className="mt-0.5 shrink-0 text-[11px] text-amber">→</span>
              <span className="text-[12px] leading-relaxed text-ink">{s}</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

/* ═══ CREATOR ROW — independent approvals + live tracking data ═══ */
function CreatorRow({ cr, idx, userRole, onUpdateApproval }) {
  const P = useP();
  const st = STATUS_MAP[cr.status] || STATUS_MAP.yet_to_pick;
  const actionable = ["pending_brand", "in_negotiation"].includes(cr.status);
  const [expanded, setExpanded] = useState(false);
  const a = cr.approval || { exec: null, mgmt: null, execLocked: false, mgmtLocked: false };
  const bothLocked = a.execLocked && a.mgmtLocked;
  const autoResult = bothLocked ? (a.exec === "tick" && a.mgmt === "tick" ? "approved" : "rejected") : null;
  const t = cr.tracking;

  const renderApprovalUI = (role, label) => {
    const isOwn = (role === "exec" && userRole === "execution") || (role === "mgmt" && userRole === "management");
    const val = a[role]; const locked = a[`${role}Locked`];
    return (
      <div className="flex items-center gap-1">
        <span className="w-9 text-[10px] font-semibold text-mute">{label}</span>
        {locked ? (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${val==="tick"?"text-green":"text-red"} ${isOwn?"":"opacity-50"}`}>
            {val === "tick" ? "✓ Yes" : "✗ No"}<span className="ml-0.5 text-[9px] text-mute">locked</span>
          </span>
        ) : (isOwn ? (
          <div className="flex gap-1">
            <button onClick={() => onUpdateApproval(idx, role, "tick")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-green transition-all duration-150 ${val==="tick"?"border-green bg-green/[0.08] shadow-sm":"border-line bg-transparent hover:border-green/40"}`}>✓</button>
            <button onClick={() => onUpdateApproval(idx, role, "cross")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-red transition-all duration-150 ${val==="cross"?"border-red bg-red/[0.08] shadow-sm":"border-line bg-transparent hover:border-red/40"}`}>✗</button>
            {val && <button onClick={() => onUpdateApproval(idx, role + "Lock", true)} className="rounded-full border border-accent/15 bg-accent/[0.06] px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm">Lock</button>}
          </div>
        ) : (
          <span className={`text-[11px] opacity-50 ${val==="tick"?"text-green":val==="cross"?"text-red":"text-mute"}`}>{val === "tick" ? "✓" : "✗"}{val ? " (" + label + ")" : "pending"}</span>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.035, 0.4), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-2 rounded-[16px] border bg-[--color-glass] px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: actionable ? P.amber + "25" : autoResult === "approved" ? P.green + "25" : autoResult === "rejected" ? P.red + "20" : "var(--color-line)" }}>
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] text-[12.5px] font-semibold text-accent shadow-sm">{cr.avatar || cr.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-ink">{cr.name}</span>
            {/* Only an anchor when a profile URL could actually be derived. An
                <a> with no href still renders accent-coloured with a hover
                underline, so it reads as a link and does nothing — worse than
                plain text. */}
            {cr.url
              ? <a href={cr.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] text-accent no-underline hover:underline">{cr.handle}</a>
              : <span className="text-[12px] text-sub">{cr.handle}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-[12px] text-sub">
            <span>{cr.followers}</span><span>{cr.platform}</span>
            {/* Collab / Non-Collab — whether the post is co-authored and carries
                the brand's own handle, or goes up on the creator's account
                alone. A pill rather than another plain span: everything else on
                this line is a measurement of the creator, and this is a term of
                the deal. Absent until someone has decided (it is set on the
                internal Creators tab and gates the lock), and an undecided
                creator shows nothing rather than a dash. */}
            {cr.collab && (
              <span title="How this post goes up — a paid collaboration carries the brand's handle"
                className="rounded-full border border-line bg-well/70 px-2 py-px text-[10.5px] font-medium text-sub">
                {cr.collab}
              </span>
            )}
            {/* Posts live / posts owed — only shown once the creator is locked,
                because that's the point the commitment exists. */}
            {cr.locked && (
              <span
                title={`${cr.deliverablesPosted} of ${cr.deliverableTarget} deliverable${cr.deliverableTarget === 1 ? "" : "s"} live`}
                className={cr.deliverablesPosted >= cr.deliverableTarget ? "font-medium text-green" : ""}
              >
                {cr.deliverables} posted
              </span>
            )}
            <span className="font-medium text-accent">ER: {cr.engRate}</span>
            {cr.avgLikes != null && <span>♥ {fmtNum(cr.avgLikes)} avg</span>}
          </div>
        </div>
        {autoResult && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] shadow-sm ${autoResult==="approved"?"bg-green/[0.08] text-green":"bg-red/[0.06] text-red"}`}>{autoResult}</span>}
        <StatusPill tier={st.t}>{st.label}</StatusPill>
      </div>
      <button onClick={() => setExpanded(!expanded)} className="mt-1.5 p-0 text-[11px] font-medium text-accent transition-opacity hover:opacity-70">{expanded ? "Show less ▴" : "See more ▾"}</button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-1.5 flex flex-col gap-1 border-t border-line pt-2">
              <div className="flex flex-wrap gap-2.5 text-[11px] text-sub"><span>Niche: <b className="text-ink">{cr.niche}</b></span><span>Size: <b className="text-ink">{cr.size}</b></span><span>State: <b className="text-ink">{cr.region}</b></span><span>Language: <b className="text-ink">{cr.language}</b></span></div>
              <div className="mt-0.5 flex flex-wrap gap-3.5 text-[12px]">
                <span className="text-mute">Brief: <AssetState asset={cr.briefAsset} Icon={FileSignature} /></span>
                <span className="text-mute">Video: <AssetState asset={cr.videoAsset} Icon={Clapperboard} /></span>
              </div>
              {/* Live block — only when this creator's post is actually up */}
              {cr.live && (
                <div className="mt-1.5 rounded-[12px] border border-line bg-well/50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2.5 text-[11.5px]">
                    <span className="flex items-center gap-1.5"><Dot color={P.green} sz={5}/><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Live</span></span>
                    <a href={cr.live.postUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="rounded-full border border-line bg-[--color-glass] px-2.5 py-0.5 font-semibold text-accent no-underline transition-colors hover:border-accent/30">View post ↗</a>
                    {cr.live.postedDate && <span className="text-mute">posted {prettyDate(cr.live.postedDate)}</span>}
                    {cr.tracking?.positivityScore != null && (
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-sm"
                        style={{ color: cr.tracking.positivityScore >= 66 ? P.green : cr.tracking.positivityScore >= 40 ? P.amber : P.red,
                          background: (cr.tracking.positivityScore >= 66 ? P.green : cr.tracking.positivityScore >= 40 ? P.amber : P.red) + "14" }}>
                        {cr.tracking.positivityScore}/100 positive
                      </span>
                    )}
                  </div>
                  {/* Line icons, not emoji: these four sit in a row, and an
                      emoji set renders at its own size and colour on every
                      platform — so the row arrived ragged, in whatever hues the
                      OS font shipped. */}
                  {t && (t.views || t.likes || t.comments || t.forwards) ? (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-sub">
                      {t.views != null && <Metric Icon={Eye} value={t.views} label="views" />}
                      {t.likes != null && <Metric Icon={Heart} value={t.likes} label="likes" />}
                      {t.comments != null && <Metric Icon={MessageCircle} value={t.comments} label="comments" />}
                      {t.forwards != null && <Metric Icon={Share2} value={t.forwards} label="shares" />}
                    </div>
                  ) : null}
                  {t?.commentAnalysis && <div className="mt-1.5 text-[11px] italic leading-normal text-ink">"{t.commentAnalysis}"</div>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {actionable && !autoResult && (
        <div className="mt-2 flex items-center gap-4 border-t border-line pt-2">
          {renderApprovalUI("exec", "Exec")}{renderApprovalUI("mgmt", "Mgmt")}
        </div>
      )}
    </motion.div>
  );
}

/* Where a concept or demo has got to, tinted by the same tier vocabulary the
   status pills use. The file link is an enhancement, not the fact — see
   assetView() in mapping.js for why asking only "is there a link?" told brands
   their signed-off brief had never been uploaded. */
const ASSET_TIER_CLS = {
  neutral:  "text-mute",
  progress: "text-accent",
  action:   "text-amber",
  done:     "text-green",
};

function AssetState({ asset, Icon }) {
  const cls = ASSET_TIER_CLS[asset?.t] || "text-mute";
  const body = <><Icon size={13} strokeWidth={1.9} />{asset?.label || "Not received"}</>;
  return asset?.url ? (
    <a href={asset.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className={`inline-flex items-center gap-1 align-middle font-medium no-underline hover:underline ${cls}`}>
      {body} <span className="text-[10px]">↗</span>
    </a>
  ) : (
    <span className={`inline-flex items-center gap-1 align-middle font-medium ${cls}`}>{body}</span>
  );
}

/* One measured number on a live post: icon, value, unit. Shared so the four
   never drift apart in size or spacing. */
function Metric({ Icon, value, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} strokeWidth={1.9} className="text-mute" />
      <b className="text-ink">{fmtNum(value)}</b> {label}
    </span>
  );
}

/* ═══ BRIEF PAGE ═══
   One icon per field, and it names the FIELD, not its status.

   There used to be a status glyph beside every label — an hourglass on all six
   rows while a brief was pending, a tick on all six once it locked. It could
   never say anything else: mapping.js derives `vars` from the single
   `briefLocked` flag, so all six were identical to each other and identical to
   the banner directly above them. Six copies of one fact, in an emoji that
   renders differently on every platform.

   These icons earn their place instead: they make the brief scannable, so
   someone hunting for the budget finds it by shape rather than by reading six
   uppercase labels. Status stays in exactly one place — the banner. */
const BRIEF_FIELDS = [
  ["Objective",       "objective",      Target],
  ["Target Audience", "targetAudience", Users],
  ["Key Messages",    "keyMessages",    MessageSquareQuote],
  ["Deliverables",    "deliverables",   Package],
  ["Budget",          "budget",         IndianRupee],
  ["Timeline",        "timeline",       CalendarRange],
];

function BriefPage({ lockedBrief, pendingBrief }) {
  const P = useP();
  const brief = lockedBrief || pendingBrief;
  if (!brief) return (
    <div className="px-5 py-12 text-center text-mute">
      <FileText size={26} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
      <div className="text-[13px]">No brief created yet</div>
    </div>
  );
  const isLocked = !!lockedBrief;
  return (
    <div>
      <div className={`mb-3 flex items-center gap-1.5 rounded-[12px] border px-3 py-2 backdrop-blur-sm ${isLocked?"border-green/[0.12] bg-green/[0.03]":"border-amber/[0.12] bg-amber/[0.03]"}`}>
        {/* No date beside "Locked". It used to read `Locked ${brief.approvedOn}`
            and there is no such field — not on the campaign, not in the brief,
            not anywhere in the payload — so it rendered the literal word
            "undefined" the moment the lock flag was ever true. The one record of
            WHEN it was signed off is the campaign timeline, which the portal
            route strips before it leaves the building (server.js
            CAMPAIGN_PRIVATE). Saying less is the honest option until the backend
            exposes the date. */}
        <Dot color={isLocked ? P.green : P.amber}/><span className={`text-[12px] font-medium ${isLocked?"text-green":"text-amber"}`}>{isLocked ? "Signed off by 5th Avenue" : "Waiting — under review by 5th Avenue"}</span>
        <span className="ml-auto text-[10.5px] italic text-mute">{isLocked ? "Read-only" : "Pending approval"}</span>
      </div>
      {BRIEF_FIELDS.map(([label, key, Icon]) => {
        const val = brief[key];
        return (
          <div key={key} className="group mb-1.5 flex items-start gap-3 rounded-[12px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-accent/25">
            {/* The icon tile picks up the accent on hover — the row reads as a
                thing you can look at, without animating on a page someone is
                trying to read. */}
            <span className="mt-[2px] flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-well/70 text-mute transition-colors duration-200 group-hover:bg-accent/[0.08] group-hover:text-accent">
              <Icon size={14} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}</div>
              <div className={`text-[13px] leading-normal ${val?"text-ink":"italic text-mute"}`}>{val || "Awaiting input"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ CAMPAIGN DETAIL ═══ */
export default function CampaignDetail({ campaign: c, onClose, userRole }) {
  const P = useP();
  const [tab, setTab] = useState("overview");
  const [creators, setCreators] = useState(c.creators || []);

  const updateApproval = (idx, role, val) => {
    setCreators(prev => prev.map((cr, i) => {
      if (i !== idx) return cr;
      const a = { ...cr.approval };
      if (role.endsWith("Lock")) { a[role.replace("Lock", "") + "Locked"] = true; } else { a[role] = val; }
      return { ...cr, approval: a };
    }));
  };

  const isAEO = c.service === "AEO"; const numCr = creators.length;
  /* Deliverables come off the campaign view-model (mapping.js → portalMetrics
     totalDeliverables), not off a per-creator display string. This used to
     regex the digits out of `cr.deliverables`, which mapping.js hardcoded to
     "—" for every creator — so this tile read 0 on every campaign. */
  const numDel = c.deliverablesTotal ?? 0;
  const numDelPosted = c.deliverablesPosted ?? 0;
  const needsAction = creators.filter(cr => ACTIONABLE_STATUSES.includes(cr.status));

  const engByCreator = creators.filter(c2 => c2.engRate !== "—").map(c2 => ({ label: c2.name.split(" ")[0], value: parseFloat(c2.engRate) }));
  const engByNiche = (() => { const g = {}, c2 = {}; creators.forEach(cr => { if (cr.engRate !== "—") { const n = cr.niche; g[n] = (g[n] || 0) + parseFloat(cr.engRate); c2[n] = (c2[n] || 0) + 1; } }); return Object.entries(g).map(([k, v]) => ({ label: k, value: Math.round((v / c2[k]) * 10) / 10 })); })();
  const engBD = creators.length ? { creator: engByCreator, niche: engByNiche } : null;

  /* Growth needs at least two days of readings to be a line rather than a dot,
     which growthSeries() enforces by returning [] below that — so the tab
     appears only once there is something to plot. */
  const growth = c.growth || [];
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "brief", label: "Brief" },
    ...(!isAEO ? [{ id: "creators", label: "Creators", count: numCr || null }] : []),
    ...(growth.length ? [{ id: "growth", label: "Growth" }] : []),
    ...(c.queries ? [{ id: "queries", label: "Queries" }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="pb-10">
      <div className="glass-panel overflow-hidden rounded-[20px]">
        <div className="border-b border-line px-6 pt-5">
          <button onClick={onClose} className="mb-3 flex items-center gap-1 rounded-full border border-line bg-well/70 px-3 py-1.5 text-[11px] text-sub transition-all duration-150 hover:-translate-x-0.5 hover:text-ink">
            ← All campaigns
          </button>
          <div className="mb-2.5">
            <h2 className="font-serif text-[26px] italic font-semibold text-ink">{c.name}</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-accent">{c.service}</span>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-normal text-sub">{c.brief}</p>
          </div>
          {needsAction.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-[12px] border border-amber/[0.12] bg-amber/[0.04] px-3 py-2 backdrop-blur-sm">
              <Dot color={P.amber}/><span className="flex-1 text-[12px] text-amber">{needsAction.length} need{needsAction.length === 1 ? "s" : ""} input</span>
              <button onClick={() => setTab("creators")} className="text-[11px] font-medium text-accent hover:underline">Review →</button>
            </div>
          )}
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1 px-3 py-2 text-[11.5px] font-medium transition-colors duration-200 ${tab===t.id?"text-accent":"text-mute hover:text-ink"}`}>
                {t.label}
                {t.count != null && <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${tab===t.id?"bg-accent/[0.1] text-accent":"bg-well text-mute"}`}>{t.count}</span>}
                {tab === t.id && <motion.span layoutId="detail-tab" className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }}/>}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: "easeOut" }}>
              {tab === "overview" && (
                <div>
                  <PhaseTracker currentPhase={c.phase}/>
                  <LivePerformance totals={c.trackTotals} lastFetched={c.lastFetched} cpv={c.cpv}/>
                  <SentimentStrip avgPositivity={c.avgPositivity} creators={creators}/>
                  {/* Budget / roster / delivery — the commitments. What the
                      campaign has RETURNED (views, engagements, cost per view)
                      is stated once, together, in Live Performance above; CPV
                      used to sit down here, a row away from the views it is
                      divided by. */}
                  <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <BudgetCard value={c.budget} pending={c.budgetPending} creators={creators}/>
                    {/* The roster is a list, not three bars — this opens the
                        Creators tab, which shows every creator with their
                        niche, tier and state on the row. AEO campaigns have no
                        such tab, so there the count is just a count. */}
                    <MetricCard label="Creators" value={`${numCr}`} onOpen={!isAEO && numCr ? () => setTab("creators") : undefined}/>
                    {/* "n / N" — posts live against posts committed. A bare
                        total hid the only part a brand acts on: how much of
                        what they paid for has actually gone out. */}
                    <MetricCard label="Deliverables" value={numDel ? `${numDelPosted}/${numDel}` : "—"}/>
                  </div>
                  <div className="group cursor-pointer relative">
                    <MetricCard label="Engagement Rate" value={c.engRate} breakdowns={engBD} suffix="%"/>
                    {engBD && <div className="absolute top-3 right-3 text-[12px] text-mute opacity-60 group-hover:opacity-100 transition-opacity">Hover or click to explore</div>}
                  </div>
                  <div className="mb-3 mt-2 rounded-[16px] border border-line bg-[--color-glass] px-4 py-3 shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Timeline</div><div className="mt-0.5 text-[12.5px] font-medium text-ink">{prettyDate(c.start)} — {prettyDate(c.end)}</div></div>
                      <span className="text-[12.5px] font-semibold text-accent">{c.progress}%</span>
                    </div>
                    <div className="mt-2 h-[5px] rounded-full bg-well">
                      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${c.progress}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}/>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-4 rounded-[14px] border border-line bg-[--color-glass] px-4 py-2.5 shadow-sm backdrop-blur-sm">
                    {[["Service", c.service], ["Region", c.region]].map(([k, v]) => (<div key={k}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{k}</div><div className="mt-px text-[12px] font-medium text-ink">{v}</div></div>))}
                  </div>
                  {c.topAssets?.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Top Performing Assets</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {c.topAssets.map((a2, i) => (
                          <div key={i} className="flex min-w-[130px] flex-col items-center gap-1 rounded-[16px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                            <div className="flex size-[38px] items-center justify-center rounded-full bg-accent/[0.1] text-[13px] font-bold text-accent">{a2.avatar}</div>
                            <span className="text-[11px] font-medium text-ink">{a2.creator}</span><span className="text-[10.5px] text-accent">{a2.handle}</span><span className="text-[10px] text-sub">{a2.label}</span>
                            <a href={a2.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="rounded-full bg-accent/[0.07] px-2 py-0.5 text-[10px] text-accent no-underline hover:bg-accent/[0.12]">View →</a>
                          </div>
                        ))}
                      </div>
                      <Observations creators={creators} topAssets={c.topAssets}/>
                    </div>
                  )}
                  {!c.topAssets?.length && creators.length > 0 && <Observations creators={creators} topAssets={c.topAssets}/>}
                </div>
              )}

              {tab === "brief" && <BriefPage lockedBrief={c.lockedBrief} pendingBrief={c.pendingBrief}/>}

              {tab === "creators" && (
                <div>
                  <div className="mb-2.5 flex items-center gap-1.5 rounded-full border border-accent/[0.06] bg-accent/[0.02] px-3 py-1.5">
                    <span className="text-[10.5px] text-sub">Viewing as</span><span className="rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{userRole === "management" ? "Mgmt" : "Exec"}</span>
                    <div className="ml-auto"><StatusLegend/></div>
                  </div>
                  {/* Empty roster: was three bouncing 👤 emoji. A campaign that
                      hasn't been cast yet is a normal state, not a moment that
                      wants a jiggling animation — and it left the reader
                      without the one thing worth saying, which is what happens
                      next. */}
                  {creators.length > 0 ? creators.map((cr, i) => <CreatorRow key={i} cr={cr} idx={i} userRole={userRole} onUpdateApproval={updateApproval}/>) : (
                    <div className="px-5 py-[34px] text-center">
                      <Users size={24} strokeWidth={1.5} className="mx-auto mb-2 text-mute opacity-40" />
                      <div className="text-[12.5px] font-medium text-ink">No creators yet</div>
                      <div className="mt-1 text-[11.5px] text-mute">We're building the shortlist — they'll appear here as each one is confirmed.</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "growth" && (
                <GrowthChart growth={growth}
                  perCreator={c.growthPerCreator || { rows: [], series: [] }}/>
              )}

              {tab === "queries" && c.queries?.map((q, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2 rounded-[12px] border border-line bg-[--color-glass] px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
                  <div className="flex-[2]"><div className="text-[12.5px] font-medium text-ink">{q.query}</div><div className="mt-px text-[11px] text-mute">{q.volume}</div></div>
                  <div className="flex items-center gap-1">{<Dot color={q.status === "live" ? P.green : P.amber}/>}<span className="text-[11px] capitalize text-sub">{q.status}</span></div>
                  <span className={`text-[11px] ${q.position !== "—" ? "font-semibold text-green" : "font-normal text-mute"}`}>{q.position}</span>
                  <span className="text-[11px] text-mute">{q.engine}</span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}