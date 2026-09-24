// src/components/campaigns/CampaignDetail.jsx — a campaign, opened in the
// main view rather than in a drawer over the board. Overview / Brief /
// Creators / Growth / Queries tabs. A campaign carries a roster, a brief, a
// sentiment read and several charts; 680px of drawer over a blurred board was
// never enough room for any of it, and it hid the page you came from.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  Target, Users, MessageSquareQuote, Package, IndianRupee, CalendarRange,
  FileText, Eye, Heart, MessageCircle, Share2, Check, X, Sparkles,
  CheckCircle2, XCircle, Wrench, MapPin, Cake, Lock, ChevronDown,
} from "lucide-react";
import { useApp } from "../../context";
import { useAuth } from "../../context/AuthContext";
import { PortalAPI } from "../../lib/api";
import { PHASES } from "../../lib/phases";
import { PHASE_ICONS } from "../../lib/phaseIcons";
import { chartTheme } from "../../lib/chartTheme";
import { fmtNum, fmtINR, fmtCPV, fmtShare, prettyDate, dayLabel } from "../../lib/format";
import { Dot } from "../Dot";
import { StatusPill, StatusLegend } from "../StatusPill";
import AnimatedNumber from "../AnimatedNumber";
import { STATUS_MAP, ACTIONABLE_STATUSES, LIVE_WAIT_LABELS, LIVE_WAIT_TIER, BCOLORS, chipOn, toAssetComments, hasAudienceData } from "./mapping";
import { budgetLines } from "../../lib/portalMetrics";
import AssetReview, { ASSETS } from "./AssetReview";

const useP = () => useApp().P;

/* ═══ PHASE TRACKER ═══ */
function PhaseTracker({ currentPhase }) {
  const P = useP();
  const idx = PHASES.findIndex(p => p.id === currentPhase);
  return (
    <div className="mb-4 rounded-[18px] border border-line bg-glass px-6 py-5 shadow-card backdrop-blur-xl">
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
// The figure, and — on hover — what it was spent on, creator by creator.
//
// The split is REAL now, which is the whole reason this card can carry one: the
// internal roster prices each creator for the client (`clientCost` there), and
// the backend maps that onto each creator's `cost` on the portal wire. What the
// agency itself pays a creator is a different number and is not on the wire at
// all — nothing here can, or should, add up to it.
//
// Priced creators only. An unpriced one is left out rather than listed at ₹0,
// and the footer counts the rows against the whole roster ("1 of 2 creators"),
// so a partial split is legible as a partial split instead of quietly
// under-stating the spend. The card holds
// its own total for the same reason: the listed rows rarely sum to `value` (an
// unpriced creator, or budget that isn't creator spend at all), and a
// breakdown that silently disagreed with the number above it would read as an
// error in one of the two.
//
// `pending` is a campaign that was raised before a budget was agreed. It reads
// smaller and in amber, with a line saying so: the same card printing a bold
// "To be confirmed" at 18px would give a non-figure the visual weight of a
// figure, on a card whose whole job is to state one. No breakdown there either
// — a split of a budget nobody has agreed is a split of nothing.
function BudgetCard({ value, budgetNum = 0, agencyFee = null, pending, creators = [] }) {
  const [open, setOpen] = useState(false);
  // The split, its shares and its reconciliation all come from budgetLines()
  // (lib/portalMetrics.js) — the same call the Billing page makes, so the hover
  // here and the table there can never quote a brand different numbers.
  const { rows, listed, itemised, rosterCount, base } =
    budgetLines({ budget: budgetNum, agencyFee, creators });
  const has = !pending && rows.length > 0 && base > 0;
  return (
    // relative + z-20 for the same reason LivePerformance carries them: every
    // card on this grid is backdrop-blurred, and a blur creates a stacking
    // context that a popover with only a local z-index paints underneath.
    <div className={`relative rounded-[14px] border border-line bg-glass px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md ${has ? "z-20" : ""}`}
      onMouseEnter={() => has && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex items-center gap-1">
        {/* The dotted rule is the only thing telling you the total opens —
            without it the breakdown is a feature you find by accident. Same
            convention as the Engagements tile in Live performance. */}
        <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] text-mute ${has ? "cursor-help border-b border-dotted border-mute/60 pb-px" : ""}`}>Budget</span>
        {has && <span className="inline-flex size-4 items-center justify-center rounded-full border border-mute/40 text-[8px] font-bold text-mute">i</span>}
      </div>
      {pending ? (
        <>
          <div className="mt-1 text-[13px] font-semibold text-amber">To be confirmed</div>
          <div className="mt-0.5 text-[10px] leading-snug text-sub">Not yet agreed — the campaign is running in the meantime.</div>
        </>
      ) : (
        <div className="mt-1 text-[18px] font-bold text-ink">{value}</div>
      )}
      {/* Downward: this card is leftmost of a three-up row with no empty half to
          unfurl into. Opaque `bg-modal`, not .glass-panel — the card's own
          backdrop-blur makes it a backdrop root, so a nested backdrop-filter has
          nothing to sample and the card below read straight through.
          Pointer events stay on: the popover is a DOM child, so entering it
          never fires the card's mouseleave, which is what lets it scroll. */}
      <AnimatePresence>
        {has && open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-30 mt-1.5 w-[268px] rounded-[14px] border border-line bg-modal px-3.5 py-3 shadow-modal">
            <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">By creator</div>
            {/* Capped, not paginated — a 20-creator roster scrolls inside the
                popover rather than growing it past the card it hangs off. */}
            <div className="flex max-h-[184px] flex-col gap-2 overflow-y-auto">
              {rows.map((r, i) => {
                return (
                  <div key={`${r.key}-${i}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${r.fee ? "text-sub" : "text-ink"}`}>{r.label}</span>
                      <span className="tnum shrink-0 text-[11px] font-semibold text-ink">{fmtINR(r.amount)}</span>
                    </div>
                    {/* The bar is what makes this a breakdown rather than a
                        list of numbers — same device, same palette, as every
                        other split on this page (HBars). */}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-well">
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${Math.min(Math.max(r.share ?? 0, 2), 100)}%` }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                          style={{ background: r.fee ? "var(--color-mute)" : BCOLORS[i % BCOLORS.length] }}/>
                      </div>
                      <span className="tnum w-8 shrink-0 text-right text-[9px] text-mute">{fmtShare(r.share)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-line pt-2 text-[9.5px] text-mute">
              {/* Counts the rows against the whole roster, and totals them.
                  The rows rarely add up to the budget above — a creator with no
                  price agreed yet, or budget that was never creator spend — and
                  a breakdown that quietly disagreed with the figure it hangs off
                  would read as one of the two being wrong. "n of N creators" is
                  what makes a partial split legible as a partial split.

                  Deliberately not "itemised" / "pending" / "priced": this is
                  read by a brand, not by the account team, and the honest thing
                  to say is simply how many of their creators the split covers. */}
              <span>{itemised} of {rosterCount} creator{rosterCount === 1 ? "" : "s"} · {fmtShare((listed / base) * 100)} of budget</span>
              <span className="tnum font-semibold text-ink">{fmtINR(listed)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className={`rounded-[14px] border border-line bg-glass px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md ${has||jumps?"group cursor-pointer":""}`}
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

   CPV here is budget ÷ views. At typical view counts that is a fraction of a
   paisa, so a currency-style two decimals collapses most campaigns to the
   same "₹0.00" — but six decimals is a number you have to count zeros in to
   read. fmtCPV keeps two significant digits past the leading zeros instead
   (₹0.005264 → ₹0.0053), which is the same rule the Overview's CPV tile
   uses, so the two screens can't disagree about what a view cost. */
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
    // this drops out on its own rather than printing an invented rate. Green
    // is the hue the Overview's CPV tile carries, so a brand reading both
    // recognises the same measure.
    cpv != null && { label: "CPV", node: fmtCPV(cpv), color: P.green },
  ].filter(Boolean);
  if (!tiles.length) return null;

  return (
    // z-20 is what makes the breakdown readable: the cards below carry
    // backdrop-blur, so in DOM order they painted over a popover that had only
    // a local z-index inside this panel's own blur-induced stacking context.
    <div className="relative z-20 mb-3 mt-2 rounded-[16px] border border-line bg-glass shadow-sm backdrop-blur-md">
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
            <div className="tnum text-[19px] font-bold leading-none text-ink" style={{ color: t.color }}>{t.node}</div>
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
                          {label} · {fmtShare((v / eng) * 100)}
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
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-200 ${metric===id?"bg-glass text-accent shadow-sm":"text-mute hover:text-ink"}`}>
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
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-200 ${split===id?"bg-glass text-accent shadow-sm":"text-mute hover:text-ink"}`}>
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
    <div className="mb-3 rounded-[16px] border border-line bg-glass px-4 py-3.5 shadow-sm backdrop-blur-md">
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
            <div key={i} className="rounded-[12px] border border-line bg-glass px-3 py-2 shadow-sm">
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
const CAMPAIGN_INSIGHT_FIELDS = [
  { key: "whatWorked", label: "What Worked", icon: CheckCircle2 },
  { key: "whatDidntWork", label: "What Didn't Work", icon: XCircle },
  { key: "nextActions", label: "Next Actions", icon: Target },
  { key: "areasToImprove", label: "Areas to Improve", icon: Wrench },
];

function CampaignInsights({ insights }) {
  if (!insights) return null;
  const filled = CAMPAIGN_INSIGHT_FIELDS.filter((f) => String(insights[f.key] || "").trim());
  if (!filled.length) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaign Insights</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filled.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-[14px] border border-accent/[0.1] bg-accent/[0.03] px-4 py-3.5 shadow-sm backdrop-blur-md">
            <div className="mb-1.5 flex items-center gap-2">
              <Icon size={15} strokeWidth={2.2} className="shrink-0 text-accent"/>
              <span className="text-[14px] font-bold leading-snug text-ink">{label}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-sub">{insights[key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <div className={`rounded-[14px] border border-line bg-glass px-4 py-3 shadow-sm backdrop-blur-md ${strategies.length?"mb-3":""}`}>
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

/* One reviewable asset on a creator row: the way in, and the state beside it.
   The button says what you can do; the label says whether you need to. */
function AssetButton({ label, Icon, asset, onOpen }) {
  const notes = asset.comments.length;
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={onOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-1 text-[11.5px] font-semibold text-accent shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-accent/30 hover:shadow-md">
        <Icon size={13} strokeWidth={1.9} /> {label}
        {notes > 0 && (
          <span className="rounded-full bg-accent/[0.12] px-1.5 text-[10px] font-bold leading-[15px]">{notes}</span>
        )}
      </button>
      <span className={`text-[11.5px] font-medium ${ASSET_TIER_CLS[asset.t] || "text-mute"}`}>{asset.label}</span>
    </span>
  );
}

/* ═══ LIVE POST ═══
   What this creator's post actually did — the link and its figures, rendered
   on the row itself rather than inside a disclosure. Only ever mounted when
   something is up, so it never has to say "not live yet". */
function LivePost({ cr }) {
  const P = useP();
  const t = cr.tracking;
  const pos = t?.positivityScore;
  const posColor = pos == null ? null : pos >= 66 ? P.green : pos >= 40 ? P.amber : P.red;
  return (
    <div className="mt-2 rounded-[12px] border border-green/20 bg-green/[0.04] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2.5 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <Dot color={P.green} sz={5}/>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Live</span>
        </span>
        <a href={cr.live.postUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="rounded-full border border-line bg-glass px-2.5 py-0.5 font-semibold text-accent no-underline transition-colors hover:border-accent/30">View post ↗</a>
        {cr.live.postedDate && <span className="text-mute">posted {prettyDate(cr.live.postedDate)}</span>}
        {pos != null && (
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-sm"
            style={{ color: posColor, background: posColor + "14" }}>
            {pos}/100 positive
          </span>
        )}
      </div>
      {/* Line icons, not emoji: these four sit in a row, and an emoji set
          renders at its own size and colour on every platform. */}
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
  );
}

/* ═══ ADVANCE STATS TOGGLE ═══
   Sits beside "Viewing as" at the top of the Creators tab. Its enabled state
   is never a client-side guess: `available` comes straight off
   advanceStatsAvailable (mapping.js), which is only true when at least one
   creator on this campaign actually carries audience data — and the backend
   only ever sends that data once the internal team has switched "Ship to
   client" on for this campaign. So a disabled toggle here means exactly what
   its tooltip says: nobody has turned this on for you yet, not a bug. */
function AdvanceStatsToggle({ enabled, available, onToggle }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="relative"
      onMouseEnter={() => !available && setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}>
      <button type="button" onClick={() => available && onToggle()} disabled={!available}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
          !available
            ? "cursor-not-allowed border-line bg-well/60 text-mute"
            : enabled
              ? "border-accent/30 bg-accent/[0.1] text-accent shadow-sm"
              : "border-line bg-glass text-sub hover:border-accent/30 hover:text-accent"
        }`}>
        {available ? <Sparkles size={12} strokeWidth={2.2}/> : <Lock size={11} strokeWidth={2.2}/>}
        Advance Stats
        <span className={`relative inline-flex h-[15px] w-[26px] shrink-0 items-center rounded-full transition-colors duration-200 ${enabled ? "bg-accent" : "bg-black/15"}`}>
          <span className={`absolute size-[11px] rounded-full bg-white shadow transition-all duration-200 ${enabled ? "left-[13px]" : "left-[2px]"}`}/>
        </span>
      </button>
      <AnimatePresence>
        {showTip && !available && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-1.5 w-[218px] rounded-[10px] border border-line bg-modal px-3 py-2.5 text-[10.5px] leading-snug text-sub shadow-modal">
            <span className="font-semibold text-ink">Premium feature.</span> Ask your Fifth Avenue account manager to enable Advance Stats for this campaign.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Small centered placeholder for a chart card with nothing to draw — the
   selected creator(s) can have SOME audience fields filled in and not
   others (gender done, locations never added), and an empty chart shape
   drawn from zeros would look like a bug rather than an honest "no data
   here yet". */
function NoAudienceData({ label }) {
  return <div className="flex h-[132px] items-center justify-center px-2 text-center text-[10.5px] leading-snug text-mute">No {label} data on file for the selected creator(s) yet.</div>;
}

/* One of the three demographic groups — no card, no border, no fill. Just an
   icon + label heading so Location/Gender/Age still read as three distinct
   things, sitting directly on the page rather than boxed off from it. The
   three sit side by side in a grid, so a thin vertical rule between columns
   (not around each one) is what separates them instead. */
function AudienceCard({ tint, Icon, label, children }) {
  return (
    <div className="lg:px-5 lg:first:pl-1 lg:last:pr-1">
      <div className="mb-3 flex items-center gap-1.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${tint}22`, color: tint }}>
          <Icon size={12} strokeWidth={2.2}/>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink">{label}</span>
      </div>
      {children}
    </div>
  );
}

const pctFmt = (v) => `${typeof v === "number" && v % 1 ? v.toFixed(1) : Math.round(v)}%`;

// Gender and Age's own fixed hex set — mint → teal → navy → periwinkle →
// lavender, matching the brand reference the client team supplied, kept
// apart from the app's general P-token chart palette (BCOLORS) on purpose:
// this screen has its own look, the way an airy pastel set once did before
// this replaced it. Still run through the six-check method (dataviz skill)
// against both the skill's default surface and this app's own — the
// contrast warning on a couple of slots is why every chart here also
// carries a direct-label legend underneath it. Stored as a paletteIndex
// (identity), not a literal color, so a bucket nobody filled in dropping
// out of combineCounts's filtered result never reshuffles the colors of
// the buckets that stayed, which a position-based index into the palette
// would do.
// The last two steps (periwinkle/lavender) sit close together for
// full-color vision (ΔE 9.3 — the usual floor is 15); acceptable here only
// because every slice already carries a name + % label below the chart,
// not color alone.
const CATEGORY_PALETTE = () => ["#A5E4C5", "#309AAF", "#1F628F", "#969CEA", "#B4BAEA"];

const GENDER_META = [
  { key: "female", name: "Female", paletteIndex: 0 },
  { key: "male", name: "Male", paletteIndex: 1 },
  { key: "other", name: "Other", paletteIndex: 2 },
];
const AGE_META = [
  { key: "13-17", name: "13–17", paletteIndex: 0 },
  { key: "18-24", name: "18–24", paletteIndex: 1 },
  { key: "25-34", name: "25–34", paletteIndex: 2 },
  { key: "35-44", name: "35–44", paletteIndex: 3 },
  { key: "45-64", name: "45–64", paletteIndex: 4 },
];

/* Combine one Location's share across a set of selected creators,
   follower-weighted so an 820K-follower creator's split outweighs a 5K
   one's. A creator who never filled that particular box in contributes
   nothing rather than a zero — `getRaw` returning null/undefined/"" drops
   them from the average instead of dragging it down, which is the
   difference between "no data" and "0%". Also returns the combined
   ESTIMATED follower count for this value, summed directly from each
   contributor's own followers × their own share. Gender and Age don't use
   this — see combineCounts below, which answers a different question
   (a bucket's share of every bucket's headcount, not of the followers
   behind it alone). */
function combineField(selected, getRaw) {
  const contributions = selected
    .map((cr) => {
      const raw = getRaw(cr);
      const val = raw == null || raw === "" ? null : Number(raw);
      if (val == null || !Number.isFinite(val)) return null;
      const followers = cr.followersNum || 0;
      // Each creator's own percentage turned into a headcount for this field
      // FIRST — an 820K-follower creator's 60% is 492,000 people, a 5K
      // creator's 60% is 3,000. Kept unrounded here; only the number we
      // actually display gets rounded, below.
      return { followers, count: (followers * val) / 100 };
    })
    .filter(Boolean);
  if (!contributions.length) return { value: null, est: null };
  const totalFollowers = contributions.reduce((s, c) => s + c.followers, 0);
  // No follower count on file for anyone contributing means there is no
  // headcount to derive a number-based share from — and averaging the raw
  // percentages instead is exactly the thing this is meant to avoid, so this
  // reads as no data rather than a disguised percentage average.
  if (!totalFollowers) return { value: null, est: null };
  const totalCount = contributions.reduce((s, c) => s + c.count, 0);
  // The combined percentage is DERIVED from the summed headcounts, never
  // averaged from the creators' own percentages directly — two creators with
  // the same 60% but wildly different audiences must not count equally.
  const value = (totalCount / totalFollowers) * 100;
  const est = Math.round(totalCount);
  return { value, est };
}

/* Gender and age are exhaustive categories — every follower in the combined
   selection is SOME gender, SOME age bracket — so a bucket's share is its own
   headcount against every bucket's headcount added together, not against the
   followers behind it (that's a different question, and combineField above
   answers it for Location, where the categories aren't exhaustive and don't
   owe anyone a 100%).
   female% = female headcount / (female + male + other headcount), and the
   same for each age bracket — which is also why the three (or five) always
   land on exactly 100% together, with no separate rescale needed afterward.
   A bucket nobody filled in for anyone selected drops out rather than
   counting as a zero. */
function combineCounts(selected, meta, getRaw) {
  const withCounts = meta.map((m) => {
    const contributions = selected
      .map((cr) => {
        const raw = getRaw(cr, m.key);
        const val = raw == null || raw === "" ? null : Number(raw);
        if (val == null || !Number.isFinite(val)) return null;
        return ((cr.followersNum || 0) * val) / 100;
      })
      .filter((v) => v != null);
    if (!contributions.length) return { ...m, count: null };
    return { ...m, count: contributions.reduce((s, v) => s + v, 0) };
  });
  const total = withCounts.reduce((s, d) => s + (d.count || 0), 0);
  if (!total) return [];
  return withCounts
    .filter((d) => d.count != null)
    .map((d) => ({ ...d, value: (d.count / total) * 100, est: Math.round(d.count) }));
}

/* The creator picker — a multi-select dropdown (checkable rows plus a Select
   all / Clear pair) rather than a native <select>, so the brand can build a
   combined view across as many creators as they want at once. Closes on an
   outside click or its own Done button; picking a row never closes it,
   since the whole point of a multi-select is picking several in a row. */
function CreatorMultiPicker({ creators, selected, onToggle, onSelectAll, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const n = selected.size;
  const single = n === 1 ? creators.find((c) => selected.has(c._key)) : null;
  const label = n === 0 ? "Select creators"
    : n === creators.length ? `All creators (${n})`
    : single ? single.name
    : `${n} creators selected`;

  return (
    <div className="relative" ref={ref}>
      <motion.button type="button" onClick={() => setOpen((o) => !o)} whileTap={{ scale: 0.98 }}
        className="flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-glass px-3.5 py-2.5 text-left shadow-sm backdrop-blur-sm transition-colors duration-150 hover:border-accent/25 sm:w-auto sm:min-w-[280px]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent/[0.14] to-accent/[0.04] text-[11px] font-semibold text-accent">
          {single ? single.avatar : n || <Users size={13} strokeWidth={1.9}/>}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{label}</span>
        <ChevronDown size={14} className={`shrink-0 text-mute transition-transform duration-200 ${open ? "rotate-180" : ""}`}/>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-30 mt-1.5 w-full overflow-hidden rounded-[12px] border border-line bg-modal shadow-modal sm:w-[320px]">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <button type="button" onClick={onSelectAll} className="text-[10.5px] font-semibold text-accent hover:underline">Select all</button>
              <button type="button" onClick={onClear} className="text-[10.5px] font-medium text-sub hover:text-ink hover:underline">Clear</button>
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {creators.map((c2) => {
                const on = selected.has(c2._key);
                return (
                  <button key={c2._key} type="button" onClick={() => onToggle(c2._key)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 ${on ? "bg-accent/[0.06]" : "hover:bg-well/70"}`}>
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ${on ? "border-accent bg-accent" : "border-line-mid bg-transparent"}`}>
                      {on && <Check size={10} strokeWidth={3} className="text-white"/>}
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] text-[10.5px] font-semibold text-accent">{c2.avatar}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-ink">{c2.name}</span>
                      <span className="block truncate text-[10.5px] text-sub">{c2.handle} · {c2.platform}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line px-3 py-2 text-right">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-accent/[0.1] px-3 py-1 text-[10.5px] font-semibold text-accent transition-colors hover:bg-accent/[0.16]">Done</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Plain flat-filled pie/donut — no gradient, no hover-grow — matching every
   other chart on this page (GrowthChart's lines, HBars' bars). `stroke={P.surface}`
   still gives every slice the 2px surface gap the dataviz method calls for
   between adjacent fills; a slight cornerRadius keeps the wedges from
   looking cut with a razor, without reading as glossy or playful. */
function AudiencePie({ data, donut, P, tooltipStyle }) {
  return (
    <ResponsiveContainer width="100%" height={158}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name"
          innerRadius={donut ? 38 : 0} outerRadius={62} paddingAngle={2} cornerRadius={donut ? 3 : 0}
          stroke={P.surface} strokeWidth={2}
          isAnimationActive animationDuration={500} animationEasing="ease-out">
          {data.map((d, i) => <Cell key={i} fill={d.color}/>)}
        </Pie>
        <Tooltip {...tooltipStyle}
          formatter={(v, n, p) => [`${pctFmt(v)}${p?.payload?.est != null ? ` · ≈${fmtNum(p.payload.est)}` : ""}`, n]}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* The three-chart grid (Location bar, Gender pie, Age donut) for a set of
   creators — shared by AudienceInsights (the combined, multi-select view
   behind the Advance Stats toggle) and CreatorRow's own "Profile" dropdown
   (a single creator, no picker, no combined-view header). Same combine math
   either way: combineField/combineCounts degrade correctly to one creator's
   own numbers when `creators` is a single-item array — a lone contributor's
   "share of the selection" is just their own figure. */
function AudienceCharts({ creators }) {
  const P = useP();
  const { tooltipStyle } = chartTheme(P);
  const palette = CATEGORY_PALETTE();
  const genderData = combineCounts(creators, GENDER_META, (cr, key) => cr.audience?.gender?.[key])
    .map((d) => ({ ...d, color: palette[d.paletteIndex] }));
  const ageData = combineCounts(creators, AGE_META, (cr, key) => cr.audience?.age?.[key])
    .map((d) => ({ ...d, color: palette[d.paletteIndex] }));
  const locNames = new Set();
  creators.forEach((cr) => (cr.audience?.locations || []).forEach((l) => l?.name && locNames.add(l.name)));
  // One series, one hue, matching this card's own icon (P.accent) above it —
  // every bar is the brand's accent blue rather than a rotating set, since
  // these bars encode one location each by position (the x-axis label),
  // not by color.
  const locData = [...locNames]
    .map((name) => ({
      name, color: P.accent,
      ...combineField(creators, (cr) => (cr.audience?.locations || []).find((l) => l?.name === name)?.pct),
    }))
    .filter((d) => d.value != null)
    .sort((x, y) => y.value - x.value)
    // Capped — a single creator can already have more than a handful of
    // locations on file, and a combined view across many creators can union
    // into a long tail of one-off cities on top of that; either way the top
    // 5 is where a brand's attention actually goes, and a taller bar chart
    // just for the tail wouldn't change the picture.
    .slice(0, 5);

  return (
    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-line/60">
      <AudienceCard tint={P.accent} Icon={MapPin} label="Location">
        {locData.length ? (
          <>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={locData} margin={{ top: 8, right: 4, left: -22, bottom: 4 }}>
                <CartesianGrid stroke={P.border} vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: P.mute, fontFamily: "Sora, sans-serif" }}
                  axisLine={false} tickLine={false} interval={0} angle={-32} textAnchor="end" height={46}/>
                <YAxis hide domain={[0, "dataMax"]}/>
                <Tooltip {...tooltipStyle}
                  formatter={(v, n, p) => [`${pctFmt(v)}${p?.payload?.est != null ? ` · ≈${fmtNum(p.payload.est)} followers` : ""}`, "Share"]}/>
                <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={34}
                  isAnimationActive animationDuration={450} animationEasing="ease-out">
                  {locData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-1.5 flex flex-col gap-1">
              {locData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-mute">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }}/>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tnum font-medium text-ink">{pctFmt(d.value)}</span>
                  {d.est != null && <span className="tnum">≈{fmtNum(d.est)}</span>}
                </div>
              ))}
            </div>
          </>
        ) : <NoAudienceData label="location"/>}
      </AudienceCard>

      <AudienceCard tint={palette[1]} Icon={Users} label="Gender">
        {genderData.length ? (
          <>
            <AudiencePie data={genderData} P={P} tooltipStyle={tooltipStyle}/>
            <div className="mt-1 flex flex-col gap-1">
              {genderData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-mute">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }}/>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tnum font-medium text-ink">{pctFmt(d.value)}</span>
                  {d.est != null && <span className="tnum">≈{fmtNum(d.est)}</span>}
                </div>
              ))}
            </div>
          </>
        ) : <NoAudienceData label="gender"/>}
      </AudienceCard>

      <AudienceCard tint={palette[2]} Icon={Cake} label="Age">
        {ageData.length ? (
          <>
            <AudiencePie data={ageData} donut P={P} tooltipStyle={tooltipStyle}/>
            <div className="mt-1 flex flex-col gap-1">
              {ageData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-mute">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }}/>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tnum font-medium text-ink">{pctFmt(d.value)}</span>
                  {d.est != null && <span className="tnum">≈{fmtNum(d.est)}</span>}
                </div>
              ))}
            </div>
          </>
        ) : <NoAudienceData label="age"/>}
      </AudienceCard>
    </div>
  );
}

/* ═══ AUDIENCE INSIGHTS — the screen behind the Advance Stats toggle ═══════
   A multi-select creator picker (every creator with data on by default), a
   summary of who's selected, and three demographic charts combined across
   all of them: a vertical bar per location, a pie for gender, a donut for
   age. Combining is follower-weighted and per-field null-aware — Location
   via combineField (a share of the followers behind it), Gender and Age via
   combineCounts (a share of every bucket's headcount added together, which
   is what makes them land on 100%) — and every percentage carries its
   estimated follower count alongside it, the same "share of a real number"
   math the internal team's own roster view does. */
function AudienceInsights({ creators }) {
  const P = useP();
  const withData = creators
    .filter((cr) => hasAudienceData(cr.audience))
    .map((cr, i) => ({ ...cr, _key: cr.ref || cr.handle || `i${i}` }));
  // Every creator with data is selected by default — the combined view
  // across the whole cast is the useful starting point, not an empty one
  // the brand has to build up row by row before seeing anything.
  const [selected, setSelected] = useState(() => new Set(withData.map((cr) => cr._key)));
  if (!withData.length) return null;

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const selectedCreators = withData.filter((cr) => selected.has(cr._key));
  const combinedFollowers = selectedCreators.reduce((s, cr) => s + (cr.followersNum || 0), 0);

  return (
    <div className="mb-4 px-1 py-2 sm:px-2">
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles size={13} strokeWidth={2.2} className="text-accent"/>
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-accent">Audience Insights</span>
      </div>

      <CreatorMultiPicker creators={withData} selected={selected} onToggle={toggle}
        onSelectAll={() => setSelected(new Set(withData.map((cr) => cr._key)))}
        onClear={() => setSelected(new Set())}/>

      {!selectedCreators.length ? (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line px-4 py-9 text-center">
          <Users size={18} strokeWidth={1.6} className="text-mute opacity-50"/>
          <div className="text-[11.5px] text-mute">Pick one or more creators above to see their audience breakdown.</div>
        </div>
      ) : (
        <>
          {/* One creator: the same facts their roster row already shows this
              brand. More than one: who's in the combined view, and how big
              it is — an overlapping avatar stack rather than a name list,
              since past four or five names a list is just noise. */}
          {selectedCreators.length === 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] border border-line bg-glass px-4 py-3 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] text-[13px] font-semibold text-accent shadow-sm">{selectedCreators[0].avatar}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-medium text-ink">{selectedCreators[0].name}</span>
                    {selectedCreators[0].url
                      ? <a href={selectedCreators[0].url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent no-underline hover:underline">{selectedCreators[0].handle}</a>
                      : <span className="text-[12px] text-sub">{selectedCreators[0].handle}</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-sub">{selectedCreators[0].platform} · {selectedCreators[0].followers} followers</div>
                </div>
              </div>
              <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
                <span><span className="text-mute">ER </span><b className="text-accent">{selectedCreators[0].engRate}</b></span>
                {selectedCreators[0].avgLikes != null && <span><span className="text-mute">Avg likes </span><b className="text-ink">{fmtNum(selectedCreators[0].avgLikes)}</b></span>}
                {selectedCreators[0].collab && <span className="rounded-full border border-line bg-well/70 px-2 py-px text-[10.5px] font-medium text-sub">{selectedCreators[0].collab}</span>}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-line bg-glass px-4 py-3 shadow-sm backdrop-blur-md">
              <div className="flex items-center -space-x-2.5">
                {selectedCreators.slice(0, 6).map((cr, i) => (
                  <span key={cr._key} className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-accent/[0.14] to-accent/[0.04] text-[10.5px] font-semibold text-accent shadow-sm"
                    style={{ border: `2px solid ${P.surface}`, zIndex: 10 - i }}>
                    {cr.avatar}
                  </span>
                ))}
                {selectedCreators.length > 6 && (
                  <span className="flex size-9 items-center justify-center rounded-full border-2 bg-well text-[10px] font-semibold text-mute" style={{ borderColor: P.surface }}>
                    +{selectedCreators.length - 6}
                  </span>
                )}
              </div>
              <div>
                <div className="text-[13px] font-medium text-ink">{selectedCreators.length} creators combined</div>
                <div className="mt-0.5 text-[11px] text-sub">≈{fmtNum(combinedFollowers)} combined followers</div>
              </div>
            </div>
          )}

          <AudienceCharts creators={selectedCreators}/>
        </>
      )}
    </div>
  );
}

/* One answer to that question. Filled and tinted when it's the standing one,
   quiet otherwise — so the pair reads as a choice with a state rather than two
   buttons that both look pressable. */
function Choice({ tone, Icon, label, active, disabled, onClick }) {
  const on  = tone === "green" ? "border-green bg-green/[0.12] text-green shadow-sm"
                               : "border-red bg-red/[0.10] text-red shadow-sm";
  const off = tone === "green" ? "border-line bg-glass text-sub hover:border-green/50 hover:text-green"
                               : "border-line bg-glass text-sub hover:border-red/50 hover:text-red";
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }} whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors duration-200 disabled:opacity-50 ${active ? on : off}`}>
      <Icon size={13} strokeWidth={2.6}/> {label}
    </motion.button>
  );
}

/* ═══ BRAND DECISION ═══
   The brand's yes or no on a creator we've put forward. One strip, two shapes:
   an open question while nobody has answered, and the answer once somebody
   has — still changeable, because a mind changed before we've reached out
   costs nothing.

   Writes the roster row's own status (shortlisted / brand_reject), so the
   internal Creators tab reads the answer where it already looks and there is
   no second field to keep in step. That is also why a decision the TEAM made
   by hand renders here identically — it is the same field.

   Replaces a pair of exec/mgmt tick boxes that only ever set component state:
   the brand could press them, and nothing left the page. */
function BrandDecision({ cr, onDecide }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const answered = !!cr.decision;
  const yes = cr.decision === "approve";

  const choose = async (decision) => {
    if (busy || decision === cr.decision) return;
    setBusy(true);
    setError(null);
    try { await onDecide(decision); }
    catch (e) { setError(e.body?.error || "Couldn't save that — try again."); }
    finally { setBusy(false); }
  };

  return (
    <motion.div layout transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`mt-2 rounded-[12px] border px-3 py-2 ${
        !answered ? "border-amber/30 bg-amber/[0.05]"
        : yes ? "border-green/20 bg-green/[0.04]" : "border-red/20 bg-red/[0.03]"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Keyed on the answer so the line swaps with a small lift instead of
            blinking between two sentences in place. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={cr.decision || "open"}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }} className="flex items-center gap-1.5 text-[11.5px]">
            {!answered ? (
              <>
                <Sparkles size={13} strokeWidth={1.9} className="text-amber"/>
                <span className="font-medium text-ink">We&rsquo;ve suggested them &mdash; are they a yes?</span>
              </>
            ) : (
              <>
                <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 18 }}
                  className={`flex size-[18px] items-center justify-center rounded-full ${yes ? "bg-green/[0.12] text-green" : "bg-red/[0.10] text-red"}`}>
                  {yes ? <Check size={11} strokeWidth={3}/> : <X size={11} strokeWidth={3}/>}
                </motion.span>
                {/* Named only when the brand made the call themselves. A status
                    the team set by hand lands on the same field, and telling
                    the brand they said something they didn't is worse than
                    saying it plainly. */}
                <span className="text-sub">
                  {yes
                    ? (cr.decidedBy ? `${cr.decidedBy} said yes to this creator` : "Approved \u2014 they\u2019re on the shortlist")
                    : (cr.decidedBy ? `${cr.decidedBy} passed on this creator` : "Not going ahead with this one")}
                </span>
              </>
            )}
          </motion.span>
        </AnimatePresence>
        <div className="ml-auto flex gap-1.5">
          <Choice tone="green" Icon={Check} label="Yes" active={yes}
            disabled={busy} onClick={() => choose("approve")}/>
          <Choice tone="red" Icon={X} label="Pass" active={answered && !yes}
            disabled={busy} onClick={() => choose("reject")}/>
        </div>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red">{error}</p>}
    </motion.div>
  );
}

/* ═══ CREATOR ROW — the brand's call, their assets, and the live post ═══ */
function CreatorRow({ cr, idx, campaignId, onDecide, onAssetComments, advanceOn }) {
  const P = useP();
  const st = STATUS_MAP[cr.status] || STATUS_MAP.yet_to_pick;
  // Independent of `st` above — a finished reel can be "Pending Creator" /
  // "Pending Team" / "Pending You" regardless of the roster status, which is
  // usually already "Video OK" or similar by the time a reel reaches this
  // stage. Absent (liveLabel undefined) until the internal board sets it.
  const liveLabel = LIVE_WAIT_LABELS[cr.liveStatus];
  const [expanded, setExpanded] = useState(false);
  // null, or the key of the asset whose review panel is open.
  const [reviewing, setReviewing] = useState(null);
  // Waiting on the brand's own yes/no — the one row state that should pull the
  // eye, because nothing on it moves until they answer.
  const pending = cr.decidable && !cr.decision;
  // A creator the brand hasn't taken on yet has no concept or cut to review, so
  // the two buttons would read "Not received" on the one row asking a question.
  const showAssets = !(pending || cr.decision === "reject");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.035, 0.4), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-2 rounded-[16px] border bg-glass px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: pending ? P.amber + "40" : cr.decision === "reject" ? P.red + "20" : "var(--color-line)" }}>
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tier={st.t}>{st.label}</StatusPill>
          {liveLabel && <StatusPill tier={LIVE_WAIT_TIER[cr.liveStatus]}>{liveLabel}</StatusPill>}
        </div>
      </div>

      {/* The brand's call, at the top of the row: while a creator is still
          theirs to accept or turn down, it is the only thing on it that needs
          them. It stays on afterwards so an answer given early can be changed
          right up until we act on it. */}
      {cr.decidable && <BrandDecision cr={cr} onDecide={(d) => onDecide(idx, d)}/>}
      {/* The live post, inline. It used to sit two clicks down inside "See
          more", which is where the brand's own results were hidden behind a
          toggle — the one thing on this row they open the page for. */}
      {cr.live && <LivePost cr={cr} />}

      {/* Both assets the brand is asked to sign off, each opening the same
          review panel. Neither is a status word any more: the state still
          reads beside the button, but the button is the thing to press. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
        {showAssets && Object.values(ASSETS).map(({ key, label, Icon }) => (
          <AssetButton key={key} label={label} Icon={Icon}
            asset={cr[`${key}Asset`]} onOpen={() => setReviewing(key)} />
        ))}
        <button onClick={() => setExpanded(!expanded)}
          className="ml-auto p-0 text-[11px] font-medium text-accent transition-opacity hover:opacity-70">
          {expanded ? "Less ▴" : "Profile ▾"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-2 flex flex-wrap gap-2.5 border-t border-line pt-2 text-[11px] text-sub">
              <span>Niche: <b className="text-ink">{cr.niche}</b></span>
              <span>Size: <b className="text-ink">{cr.size}</b></span>
              <span>State: <b className="text-ink">{cr.region}</b></span>
              <span>Language: <b className="text-ink">{cr.language}</b></span>
            </div>
            {/* This creator's own audience breakdown — the same three charts
                as the combined Audience Insights screen above, scoped to
                just them (AudienceCharts takes any set of creators; a
                single-item array is just this one's own numbers). Behind the
                same Advance Stats gate as that screen: the toggle controls
                whether audience demographics are visible at all, and a row's
                own dropdown isn't a back door around it. */}
            {advanceOn && hasAudienceData(cr.audience) && (
              <div className="mt-1 border-t border-line pt-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles size={11} strokeWidth={2.2} className="text-accent"/>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">Audience</span>
                </div>
                <AudienceCharts creators={[cr]}/>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reviewing && (
          <AssetReview key={reviewing} creator={cr} asset={reviewing} campaignId={campaignId}
            onClose={() => setReviewing(null)}
            onPosted={(asset, comments) => onAssetComments(idx, asset, comments)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* Where an asset has got to, tinted by the same tier vocabulary the status
   pills use. The file link is an enhancement, not the fact — see assetView()
   in mapping.js for why asking only "is there a link?" told brands their
   signed-off concept had never been uploaded. */
const ASSET_TIER_CLS = {
  neutral:  "text-mute",
  progress: "text-accent",
  action:   "text-amber",
  done:     "text-green",
};

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
        <Dot color={isLocked ? P.green : P.amber}/><span className={`text-[12px] font-medium ${isLocked?"text-green":"text-amber"}`}>{isLocked ? "Signed off by Fifth Avenue" : "Waiting — under review by Fifth Avenue"}</span>
        <span className="ml-auto text-[10.5px] italic text-mute">{isLocked ? "Read-only" : "Pending approval"}</span>
      </div>
      {BRIEF_FIELDS.map(([label, key, Icon]) => {
        const val = brief[key];
        return (
          <div key={key} className="group mb-1.5 flex items-start gap-3 rounded-[12px] border border-line bg-glass px-3.5 py-3 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-accent/25">
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
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [creators, setCreators] = useState(c.creators || []);
  // The Creators-tab "Advance Stats" screen. Starts closed even when it's
  // available — the roster is still the thing most brands open this tab for,
  // and the toggle is right there at the top if they want the extra screen.
  const [advanceOn, setAdvanceOn] = useState(false);

  /* The brand's yes/no on a suggested creator. Writes through to the roster
     row's status — the internal app's own vocabulary — then folds the server's
     answer back into local state so the pill and the row's tint move with it.
     Errors are left to throw: BrandDecision shows them on the row that asked. */
  const decideCreator = async (idx, decision) => {
    const cr = creators[idx];
    const { status } = await PortalAPI.decideCreator(c.id, cr.ref, decision, {
      scope: user, author: user.name, accountId: user.id,
    });
    setCreators(prev => prev.map((x, i) => i === idx
      ? { ...x, decision, rawStatus: status, status, decidedBy: user.name || "You" }
      : x));
  };

  /* The server hands back the whole thread, not just the new note, so this
     replaces rather than appends — a reply the team landed while the panel was
     open arrives with it. Mapped through the same normaliser the initial
     payload uses, so a posted note and a fetched one are one shape. */
  const setAssetComments = (idx, asset, comments) => {
    const key = `${asset}Asset`;
    setCreators(prev => prev.map((cr, i) =>
      i === idx ? { ...cr, [key]: { ...cr[key], comments: toAssetComments(comments) } } : cr));
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
                    <BudgetCard value={c.budget} budgetNum={c.budgetNum} agencyFee={c.agencyFee} pending={c.budgetPending} creators={creators}/>
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
                  <div className="mb-3 mt-2 rounded-[16px] border border-line bg-glass px-4 py-3 shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Timeline</div><div className="mt-0.5 text-[12.5px] font-medium text-ink">{prettyDate(c.start)} — {prettyDate(c.end)}</div></div>
                      {/* The DELIVERY figure, labelled — creators locked,
                          concepts and demos in, posts up. Not the same thing as
                          the phase tracker above, which reads the campaign's
                          stage: BAU is Shortlisting on the stage and 82% on the
                          work, and both are true. An unlabelled percentage on a
                          row headed "Timeline" also invited the brand to read it
                          as elapsed time, which it never was. */}
                      <div className="text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Delivery</div>
                        <div className="mt-0.5 text-[12.5px] font-semibold text-accent">{c.delivery}%</div>
                      </div>
                    </div>
                    <div className="mt-2 h-[5px] rounded-full bg-well">
                      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${c.progress}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}/>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-4 rounded-[14px] border border-line bg-glass px-4 py-2.5 shadow-sm backdrop-blur-sm">
                    {[["Service", c.service], ["Region", c.region]].map(([k, v]) => (<div key={k}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{k}</div><div className="mt-px text-[12px] font-medium text-ink">{v}</div></div>))}
                  </div>
                  {c.topAssets?.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Top Performing Assets</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {c.topAssets.map((a2, i) => (
                          <div key={i} className="flex min-w-[130px] flex-col items-center gap-1 rounded-[16px] border border-line bg-glass px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
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
                  <CampaignInsights insights={c.insights}/>
                </div>
              )}

              {tab === "brief" && <BriefPage lockedBrief={c.lockedBrief} pendingBrief={c.pendingBrief}/>}

              {tab === "creators" && (
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5 rounded-full border border-accent/[0.06] bg-accent/[0.02] px-3 py-1.5">
                    <span className="text-[10.5px] text-sub">Viewing as</span><span className="rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{userRole === "management" ? "Mgmt" : "Exec"}</span>
                    <div className="ml-auto flex items-center gap-2.5">
                      <AdvanceStatsToggle enabled={advanceOn} available={!!c.advanceStatsAvailable} onToggle={() => setAdvanceOn((o) => !o)}/>
                      <StatusLegend/>
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {advanceOn && c.advanceStatsAvailable && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                        <AudienceInsights creators={creators}/>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Empty roster: was three bouncing 👤 emoji. A campaign that
                      hasn't been cast yet is a normal state, not a moment that
                      wants a jiggling animation — and it left the reader
                      without the one thing worth saying, which is what happens
                      next. */}
                  {creators.length > 0 ? creators.map((cr, i) => (
                    <CreatorRow key={i} cr={cr} idx={i} campaignId={c.id}
                      onDecide={decideCreator} onAssetComments={setAssetComments}
                      advanceOn={advanceOn && c.advanceStatsAvailable}/>
                  )) : (
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
                <div key={i} className="mb-1.5 flex items-center gap-2 rounded-[12px] border border-line bg-glass px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
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