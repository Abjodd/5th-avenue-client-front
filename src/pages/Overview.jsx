/**
 * src/pages/Overview.jsx — the brand's front page.
 *
 * Reads as a briefing rather than a wall of tiles: a greeting that names the
 * day and what needs a decision, then sections that each answer one question —
 * what the numbers say, what the work did once it was live, what the spend
 * bought, where the plan is working, who moves the needle, and what lands.
 * Signals — the decisions waiting on the brand — close the page rather than
 * open it, so the reader sees the account's shape before being asked to act
 * on it.
 *
 * Every figure is derived in lib/portalMetrics.js from GET /api/portal/campaigns
 * (plus GET /api/portal/analytics inside PerformanceSection). Nothing on this
 * page is authored: where the DB has no answer the panel says so instead of
 * drawing an empty chart at zero.
 *
 * Color: every figure on this page — KPIs, the health ring, progress and
 * budget numbers, chart values, and count badges — reads in the same neutral
 * ink (P.neutral) that "Combined audience" always used. One number-color
 * means the eye never has to relearn what a hue means from panel to panel;
 * category coding (pipeline phase dots/bars, activity-kind icons) is left
 * alone, since those distinguish groups rather than report a value.
 */
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  UserCheck, Clapperboard, Rocket, MapPin, Sparkles, ArrowRight,
  Radio, TrendingUp, Calendar, ExternalLink, SlidersHorizontal, ChevronDown,
} from "lucide-react";

import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { usePortalCampaigns } from "../lib/usePortalData";
import { usePersistentState } from "../lib/usePersistentState";
import { fmtNum, fmtINR, fmtINRExact, fmtCPV, fmtShare, prettyDate, initials, dayLabel } from "../lib/format";
import { INTRO_KEY } from "../lib/session";
import { EASE, fadeUp } from "../lib/motion";
import {
  flattenCreators, filterOptions, applyFilters, FILTER_GROUPS,
  summarise, healthScore, pipeline, signals, groupBy, availableMetrics,
  GROUP_METRICS, flagOutliers, serviceGroups, rankCampaigns,
  platformPerformance, livePosts, POST_SORTS, activityFeed, needsYou,
  greeting, heroSummary, growthAcross, countsInMetrics, cpvOf, actionableCount,
} from "../lib/portalMetrics";

import { Dot } from "../components/Dot";
import AnimatedNumber from "../components/AnimatedNumber";
import { StatusPill } from "../components/StatusPill";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import PerformanceSection from "../components/PerformanceSection";
import { Stagger, AmbientBackground } from "../components/motion/Motion";
import { Panel, Section, PanelTitle, KPI, MetricSwitch, PanelEmpty } from "../components/portal/Shell";
import { FlipSummary } from "../components/portal/FlipCard";
import { BarList, ColumnChart, Podium, PlatformScorecard, LineChart } from "../components/charts";

/* Brand-story intro is its own chunk — most sessions load it once per login */
const BrandIntro = lazy(() => import("../components/intro/BrandIntro"));

/* Signal id → icon. Kept beside the signals() producer's ids so adding a
   signal is one entry in each place and never a silently missing glyph. */
const SIGNAL_ICONS = {
  approvals: UserCheck, uploads: Clapperboard, brief: Rocket,
  regional: MapPin, insight: Sparkles,
};

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
   ═════════════════════════════════════════════════════════════════════════ */

/** The pen mark under the reader's name — a drawn stroke, not a `border-b`,
 *  which would just read as a link. `non-scaling-stroke` is load-bearing: the
 *  box stretches to the word's width, so without it a short name wears a fat
 *  stroke and a long one a hairline. `show` is the hero's intro gate. */
function UnderStroke({ show }) {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 8"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-1 left-0 h-[7px] w-full overflow-visible text-accent"
    >
      <motion.path
        d="M1.5 5.8 C 26 2.4, 64 1.5, 118.5 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.35}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: show ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.75, ease: EASE, delay: 0.4 }}
      />
    </svg>
  );
}

/**
 * Three metrics as one graphic, outer to inner — the Apple Activity-rings
 * pattern, in the app's own accent/teal/green rather than Apple's red/green/
 * blue — paired with a legend that spreads across the rest of the row (same
 * `flex-1` treatment as the KPI band below, so this doesn't strand a wide
 * screen mostly empty beside a small ring).
 *
 * The two halves are linked by one hover state: resting a pointer on a ring
 * (or its legend row — either direction works) dims the other two rings and
 * lifts that one stat, so it's obvious at a glance which number a given ring
 * is. Rings and legend live in one component, not two, because that state
 * has to be shared and a prop-drilled callback pair for three rows each way
 * would be more machinery than the two `useState` lines it replaces.
 *
 * Sweeps in together on mount, not on an initial `animate={{}}`: rAF is
 * paused in a background tab, so a motion-driven grow-in would leave every
 * ring flat until the tab is looked at — same trap billing.jsx's own Bar
 * documents, worked around the same way (a plain CSS transition, set by an
 * effect that always runs). The hover lift/dim is a separate, much shorter
 * transition — not gated on that effect or on reduced-motion, the way the
 * KPI tiles' own `hover:-translate-y-1` isn't either.
 *
 * A ring whose `pct` is null draws just its neutral track, not a colored arc
 * at 0% — `healthScore()` returns null for "nothing in flight to measure",
 * and a 0% ring would misread that as "measured, and it's zero".
 */
function HeroMetrics({ items, size = 168, stroke = 13, gap = 7 }) {
  const reduce = useReducedMotion();
  const [grown, setGrown] = useState(reduce);
  useEffect(() => { if (!reduce) setGrown(true); }, [reduce]);
  const [hovered, setHovered] = useState(null);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-14 gap-y-8">
      <svg viewBox="0 0 200 200" style={{ width: size, height: size, transform: "rotate(-90deg)" }} className="shrink-0">
        {items.map((it, i) => {
          const radius = 84 - i * (stroke + gap);
          const c = 2 * Math.PI * radius;
          const pct = Math.min(Math.max(it.pct ?? 0, 0), 100);
          const isHovered = hovered === it.key;
          const dimmed = hovered && !isHovered;
          return (
            <g
              key={it.key}
              onMouseEnter={() => it.pct != null && setHovered(it.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: it.pct != null ? "pointer" : "default" }}
            >
              {/* Invisible, wider hit area — a 13px stroke is a thin target
                  to land a pointer on precisely. */}
              <circle cx="100" cy="100" r={radius} fill="none" stroke="transparent" strokeWidth={stroke + 16} />
              <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
              {it.pct != null && (
                <circle
                  cx="100" cy="100" r={radius} fill="none" stroke={it.color} strokeLinecap="round"
                  strokeWidth={isHovered ? stroke + 3 : stroke}
                  strokeDasharray={c}
                  strokeDashoffset={grown ? c * (1 - pct / 100) : c}
                  style={{
                    opacity: dimmed ? 0.35 : 1,
                    transition:
                      `stroke-dashoffset 1100ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms, ` +
                      "stroke-width 200ms ease-out, opacity 200ms ease-out",
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex min-w-[280px] flex-1 flex-wrap items-center">
        {items.map((it, i) => {
          const isHovered = hovered === it.key;
          const dimmed = hovered && !isHovered;
          return (
            <div key={it.key} className="flex min-w-[170px] flex-1 items-stretch">
              {i > 0 && <div className="mr-6 hidden self-stretch border-l border-line sm:block" />}
              <button
                type="button"
                onMouseEnter={() => setHovered(it.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(it.key)}
                onBlur={() => setHovered(null)}
                className="flex flex-1 items-center gap-3 rounded-lg py-1 text-left transition-[transform,opacity] duration-300 ease-out"
                style={{ transform: isHovered ? "translateY(-3px)" : "translateY(0)", opacity: dimmed ? 0.5 : 1 }}
              >
                <span aria-hidden className="size-[9px] shrink-0 rounded-full" style={{ background: it.color }} />
                <div className="min-w-0">
                  <div className="microlabel tracking-[0.09em]">{it.label}</div>
                  {it.value}
                  {it.sub}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Activity digest (Recent activity + Needs you, merged) ──────────────── */

/**
 * Per-creator decisions, expandable to who's behind a "+N more" — extra
 * detail behind Signals' own aggregate rows, so it lives inside that same
 * section rather than a second one making its own competing claim.
 *
 * Filtered to `statusTier === "action"` rows only. needsYou() also carries
 * creators stuck on "Waiting on Our Team" or "Waiting on Creator"
 * (LIVE_WAIT_LABELS, above) — agency-side work in flight, not the brand's to
 * clear — and rendering those as "needs a decision" is exactly what used to
 * have this block claiming open decisions one line above Signals saying
 * there were none. Those rows aren't dropped; RecentActivity below still
 * counts them, just as "in progress" rather than "on you".
 */
function NeedsYouExtra({ queues, setPage, P }) {
  const [openQueue, setOpenQueue] = useState(null);
  const actionable = queues
    .map((q) => ({ ...q, rows: q.rows.filter((r) => r.statusTier === "action") }))
    .filter((q) => q.rows.length > 0);
  if (!actionable.length) return null;

  return (
    <div className="mt-6">
      <div className="microlabel mb-3">Who, specifically</div>
      <Panel reveal className="divide-y divide-line overflow-hidden">
        {actionable.map((q) => {
          const open = openQueue === q.campaignId;
          const lead = q.rows[0];
          return (
            <div key={q.campaignId} className="px-5 py-3.5">
              <div className="flex w-full items-center gap-1">
                <button
                  onClick={() => setPage("campaigns", { campaignId: q.campaignId })}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${P.accent}14`, color: P.accent }}>
                    <UserCheck size={14} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {lead.name} {q.rows.length > 1 ? `+${q.rows.length - 1} more` : ""} need{q.rows.length === 1 ? "s" : ""} a decision
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-[10.5px] text-mute">{q.campaignName}</span>
                      <StatusPill tier={lead.statusTier}>{lead.statusLabel}</StatusPill>
                    </span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>
                {q.rows.length > 1 && (
                  <button
                    onClick={() => setOpenQueue(open ? null : q.campaignId)}
                    aria-label={open ? "Collapse creators" : "Show individual creators"}
                    className="shrink-0 rounded-full p-1 text-mute transition-colors hover:bg-well hover:text-ink"
                  >
                    <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }} className="overflow-hidden pl-11"
                  >
                    {q.rows.map((cr, j) => (
                      <button
                        key={j}
                        onClick={() => setPage("campaigns", { campaignId: q.campaignId })}
                        className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-accent/[0.03]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{cr.name}</span>
                        <StatusPill tier={cr.statusTier}>{cr.statusLabel}</StatusPill>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

/**
 * Closing history strip: what happened, most recent first, plus a one-line
 * mention of anyone still in progress (the non-actionable rows NeedsYouExtra
 * leaves out). Last on the page and lightest in tone, since neither is
 * something to act on today — that's what the top of this section is for.
 */
function RecentActivity({ activity, queues, setPage, P }) {
  const inProgress = queues.reduce(
    (s, q) => s + q.rows.filter((r) => r.statusTier !== "action").length, 0,
  );
  if (!activity.length && !inProgress) return null;

  return (
    <div className="mt-8 border-t border-line pt-6">
      <div className="microlabel mb-3">Recently</div>
      {activity.length > 0 && (
        <div className="flex flex-col">
          {activity.slice(0, 6).map((a) => {
            const tone = a.kind === "live" ? P.green : a.kind === "metrics" ? P.accent : a.kind === "end" ? P.doneTxt : P.purple;
            const Icon = a.kind === "live" ? Radio : a.kind === "metrics" ? TrendingUp : Rocket;
            return (
              <button
                key={a.id}
                onClick={() => setPage("campaigns", { campaignId: a.campaignId })}
                className="group flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-b-0 hover:bg-accent/[0.03]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${tone}14`, color: tone }}>
                  <Icon size={13} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{a.title}</span>
                  <span className="block truncate text-[10.5px] text-mute">{a.meta}</span>
                </span>
                <span className="shrink-0 text-[10.5px] text-mute">{prettyDate(a.at)}</span>
              </button>
            );
          })}
        </div>
      )}
      {inProgress > 0 && (
        <p className={`text-[11.5px] text-mute${activity.length > 0 ? " mt-3" : ""}`}>
          {inProgress} more creator{inProgress === 1 ? "" : "s"} {inProgress === 1 ? "is" : "are"} still in progress — waiting on our team or the creator, not you.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNALS — the closing section: what is in the brand's court, and what is
   merely worth knowing
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * One decision, as a row in a single panel rather than a card in a grid.
 *
 * A grid of equal cards has no order, so an approval blocking a creator ranked
 * the same as the note that the roster covers five states. Rows do have one —
 * top to bottom — and the top one carries the faint accent wash the hero's
 * "Needs you" queue already uses for its first item.
 */
function SignalRow({ signal, onGo, P, first }) {
  const Icon = SIGNAL_ICONS[signal.icon] || Sparkles;
  return (
    <button
      onClick={onGo}
      className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 ${
        first ? "bg-accent/[0.05] hover:bg-accent/[0.08]" : "hover:bg-accent/[0.03]"
      }`}
    >
      <span
        className="relative flex size-10 shrink-0 items-center justify-center rounded-[14px] transition-transform duration-200 group-hover:scale-105"
        style={{ background: `${P.accent}14`, color: P.accent }}
      >
        <Icon size={17} strokeWidth={1.9} />
        {/* On the icon, not opening the sentence: "3 creators are waiting on
            your yes" already says three. */}
        {signal.count != null && (
          <span
            className="tnum absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ background: P.accent, color: P.accentInk }}
          >
            {signal.count}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug text-ink">{signal.headline}</span>
        <span className="mt-1 block text-[12px] leading-relaxed text-sub">{signal.detail}</span>
      </span>

      {/* Sentence case: the old uppercase micro-label matched the section
          eyebrows, so the one pressable thing looked like a heading. Hidden
          below `sm`, where the whole row is the target anyway. */}
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[11.5px] font-semibold text-sub transition-all duration-200 group-hover:border-accent/30 group-hover:bg-accent/[0.07] group-hover:text-accent sm:flex">
        {signal.cta}
        <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/**
 * An observation, as a line of prose with the link inside it. Deliberately not
 * a card: nothing here is waiting on anyone, and the way to say that in a
 * layout is to stop giving it a to-do's chrome.
 */
function SignalNote({ signal, onGo }) {
  const Icon = SIGNAL_ICONS[signal.icon] || Sparkles;
  return (
    <button onClick={onGo} className="group flex items-start gap-2.5 text-left">
      <Icon size={14} strokeWidth={1.9} className="mt-[3px] shrink-0 text-mute transition-colors group-hover:text-accent" />
      <span className="min-w-0 text-[12.5px] leading-relaxed">
        <span className="font-semibold text-ink">{signal.headline}</span>{" "}
        <span className="text-sub">{signal.detail}</span>{" "}
        <span className="whitespace-nowrap font-semibold text-accent decoration-accent/30 underline-offset-[3px] group-hover:underline">
          {signal.cta} →
        </span>
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CREATOR FILTER BAR
   ═════════════════════════════════════════════════════════════════════════ */

function CreatorFilters({ options, filters, setFilters, shown, total }) {
  const [open, setOpen] = useState(null);
  const activeCount = Object.values(filters).reduce((s, a) => s + a.length, 0);
  const groups = FILTER_GROUPS.filter((g) => options[g.id]?.length > 1);

  const toggle = (group, value) =>
    setFilters((f) => ({
      ...f,
      [group]: f[group].includes(value) ? f[group].filter((v) => v !== value) : [...f[group], value],
    }));
  const clear = () => setFilters(Object.fromEntries(FILTER_GROUPS.map((g) => [g.id, []])));

  if (!groups.length) return null;

  return (
    <Panel reveal className="mb-5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">
          <SlidersHorizontal size={13} /> Filter creators
        </span>
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setOpen(open === g.id ? null : g.id)}
            aria-expanded={open === g.id}
            className={`rounded-full border px-3.5 py-[7px] text-[11.5px] font-semibold transition-all duration-200 ease-out ${
              filters[g.id].length
                ? "border-accent/20 bg-accent/[0.08] text-accent shadow-sm"
                : "border-line bg-well/70 text-sub hover:text-ink"
            }`}
          >
            {g.label}{filters[g.id].length ? ` · ${filters[g.id].length}` : ""} {open === g.id ? "▴" : "▾"}
          </button>
        ))}
        {activeCount > 0 && (
          <button onClick={clear} className="rounded-full px-3 py-[7px] text-[11.5px] font-semibold text-red transition-colors hover:bg-red/5">
            Clear all
          </button>
        )}
        <span className="ml-auto text-[11.5px] text-sub">
          {shown} of {total} creators
        </span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={open}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {options[open].map((opt) => {
                const on = filters[open].includes(opt.value);
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => toggle(open, opt.value)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] transition-all duration-200 ${
                      on ? "border-accent/25 bg-accent/[0.1] font-semibold text-accent shadow-sm" : "border-line bg-well/70 text-sub hover:text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

/** How a service's progress-so-far compares to how much of its own calendar
 *  window has elapsed — the read a bare "62%" can't give on its own, since
 *  62% progress means something different three days into a campaign than
 *  three days before it ends. Null when there's no window to pace against
 *  (an undated or point-in-time booking). */
function pacingPoint(g) {
  if (!g.from || !g.to) return null;
  const from = new Date(g.from), to = new Date(g.to);
  if (!(to > from)) return null;
  const elapsedPct = Math.min(100, Math.max(0, ((Date.now() - from) / (to - from)) * 100));
  const diff = g.progress - elapsedPct;
  if (Math.abs(diff) < 8) return "Progress is tracking roughly on schedule for this window.";
  return diff > 0
    ? `Running ahead of schedule — about ${Math.round(diff)} points ahead of where the calendar alone would put it.`
    : `Running behind schedule — about ${Math.round(Math.abs(diff))} points behind where the calendar alone would put it.`;
}

/** What the committed budget is buying, in the one unit that makes services
 *  of very different sizes comparable: cost per person reached. Null with no
 *  reach yet to divide by — a per-head cost before anyone's been reached
 *  would just be the budget restated. */
function efficiencyPoint(g) {
  if (!(g.budget > 0) || !(g.reach > 0)) return null;
  return `Working out to roughly ${fmtINRExact(g.budget / g.reach)} committed per person reached.`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUPED CREATOR PANEL — one chart, switchable grouping and metric
   ═════════════════════════════════════════════════════════════════════════ */

/** One panel for the whole roster. `view` says which grouping is on show —
    "by niche" as columns, "by follower tier" as bars — and the metric switch
    picks what is measured within it. The two groupings used to sit side by
    side, which asked the reader to compare two charts at once; one panel that
    swaps means the same eye lands on the same place both times.

    Metrics with no data behind them never reach the switch (availableMetrics),
    and the metric survives a grouping change so the two views are read against
    each other rather than reset. */
function GroupedPanel({ view }) {
  const { rows, chart, color } = view;
  const metrics = useMemo(() => availableMetrics(rows), [rows]);
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? "count");
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0] ?? GROUP_METRICS[3];

  // A metric can disappear when the filter narrows the roster — fall back
  // rather than rendering a switch pointing at nothing.
  useEffect(() => {
    if (metrics.length && !metrics.some((m) => m.id === metricId)) setMetricId(metrics[0].id);
  }, [metrics, metricId]);

  const items = useMemo(() => {
    const withValue = rows.filter((g) => metric.pick(g) != null);
    const flags = flagOutliers(withValue, metric.pick);
    return withValue.map((g, i) => ({
      label: g.label,
      value: metric.pick(g),
      display: metric.format(metric.pick(g)),
      color,
      flag: flags[i],
      sub: `${g.count} creator${g.count === 1 ? "" : "s"}`,
    }));
  }, [rows, metric, color]);

  const avg = items.length ? items.reduce((s, i) => s + i.value, 0) / items.length : undefined;
  const reduce = useReducedMotion();

  // Back-face summary: same rows the chart plots, worded out, plus which
  // group is carrying the roster and which is trailing it — the thing a
  // reader squints at the bars to find.
  const top = items.length ? items.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const bottom = items.length ? items.reduce((a, b) => (b.value < a.value ? b : a)) : null;

  // What the bars actually say: who's carrying the roster, who's trailing it,
  // and whether that's one group running away with it or a fairly even
  // spread — not every bar's own value read back as a list, which the chart
  // already shows.
  const groupTotal = items.reduce((s, it) => s + it.value, 0);
  const topShare = top && groupTotal > 0 ? (top.value / groupTotal) * 100 : null;
  const groupPoints = [];
  if (top && bottom && top !== bottom) {
    groupPoints.push(
      topShare != null
        ? `${top.label} leads at ${top.display} — about ${fmtShare(topShare)} of the total across ${items.length} groups.`
        : `${top.label} leads at ${top.display}; ${bottom.label} trails at ${bottom.display}.`
    );
    if (topShare != null) groupPoints.push(`${bottom.label} trails at ${bottom.display}.`);
    if (items.length > 2 && topShare != null) {
      groupPoints.push(
        topShare >= 50
          ? "More than half the total sits in that one group — concentrated rather than spread out."
          : "No single group dominates the roster."
      );
    }
  } else if (top) {
    groupPoints.push(`${top.label} is the only group with data right now, at ${top.display}.`);
  }

  const backSummary = (
    <FlipSummary
      title={view.label}
      hint={items.length ? `${metric.hint} · average ${metric.format(avg)}.` : "No creators match the current filters."}
      points={groupPoints}
    />
  );

  return (
    <Panel reveal flip back={backSummary} className="flex flex-col px-6 py-5">
      <PanelTitle
        title={view.label}
        hint={`${view.hint} · ${metric.hint}`}
        action={<MetricSwitch label="Metric" options={metrics} value={metric.id} onChange={setMetricId} />}
      />
      {/* Fixed body, so switching grouping can't resize the panel. The two
          views have very different natural heights — a 190px column chart
          against a bar list of two to four rows — and easing between them
          still moved everything below, so the Audience section visibly
          walked up the page mid-switch. Holding the box still is worth more
          than animating it.

          214px is the taller of the two by construction: the column chart is
          given its height as a prop, and its labels `truncate` to one line
          (charts/ColumnChart.tsx), so that branch is always 190 + one label
          row. The bar list is capped by the four follower tiers and centres
          in the leftover space.

          The keyed child still fades the new view up in place. Deliberately
          NOT an AnimatePresence crossfade: `mode="wait"` holds the incoming
          chart until the outgoing one finishes exiting, so a switch made
          while the tab is backgrounded (rAF throttled, exit never completes)
          leaves the old chart on screen under the new title. A keyed remount
          can't get stuck, and reads the same at 60fps. */}
      <div className="flex h-[214px] flex-col justify-center">
        <motion.div
          key={view.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
        >
          {items.length === 0 ? (
            <PanelEmpty>No creators match the current filters.</PanelEmpty>
          ) : chart === "column" ? (
            <ColumnChart items={items} avg={avg} height={190} />
          ) : (
            <BarList items={items} avg={avg} />
          )}
        </motion.div>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROWTH — every live post the brand has, as one cumulative build
   ═════════════════════════════════════════════════════════════════════════ */

const GROWTH_METRICS = [
  { id: "views", label: "Views" },
  { id: "engagements", label: "Engagements" },
];

/* Height of the growth panel's body — the chart and the breakdown column
   beside it share it, which is what keeps the panel the same size whether the
   brand has four live posts or four hundred. */
const PANEL_H = 300;

/**
 * The account-wide version of the Growth tab in a campaign's detail view.
 * Same numbers, same carry-forward rule — growthAcross() and growthSeries()
 * share one basis, so this panel and that tab can never disagree.
 *
 * The chart sits beside a per-post breakdown rather than being stretched over
 * the full width of the page. Full-width it was a 480px-tall wash with a line
 * pinned along the top: a cumulative total that grew 8.5M → 9.2M has nowhere
 * to go on a zero-based axis, and the panel spent its space on the 90% of the
 * plot nothing ever enters. The breakdown answers the question that empty
 * space never did — which post is carrying this — and reads whichever day the
 * cursor is on, so the two halves always describe the same moment.
 *
 * Both metrics plot in the same neutral ink as every other figure on the
 * page — "views" and "engagements" are a choice of what to measure, not two
 * different stories, so they no longer wear two different colors.
 */
function AccountGrowth({ growth, palette }) {
  const [metricId, setMetricId] = useState("views");
  // Which reading the breakdown describes. Hover previews, a click pins it so
  // the list can be read without holding the cursor on the chart, and with
  // neither the panel shows the most recent reading.
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const { points, byPost, creators, campaigns } = growth;

  // Two readings are needed before there is a shape to draw. The panel says so
  // rather than plotting a lone dot, and reports what IS being tracked so an
  // empty chart reads as "not yet" instead of "nothing is measured".
  if (points.length < 2) {
    return (
      <Panel reveal className="px-6 py-5">
        <PanelTitle title="Total views" hint="Cumulative across every live post we're tracking" />
        <PanelEmpty>
          {creators === 0
            ? "Live-post growth appears here once posts are live and their metrics have been fetched."
            : `Tracking ${creators} post${creators === 1 ? "" : "s"} across ${campaigns} campaign${campaigns === 1 ? "" : "s"} — the curve appears after a second reading.`}
        </PanelEmpty>
      </Panel>
    );
  }

  const metric = GROWTH_METRICS.find((m) => m.id === metricId) ?? GROWTH_METRICS[0];
  const color = palette.neutral;
  const first = points[0];
  const last = points[points.length - 1];

  const at = Math.min(hovered ?? pinned ?? points.length - 1, points.length - 1);
  const row = byPost.rows[at] || {};
  const prevRow = at > 0 ? byPost.rows[at - 1] || {} : null;
  const total = points[at][metric.id] || 0;

  // One line per post, biggest first. A post with no reading yet on this day
  // is left out rather than listed at zero — the same rule the curve follows.
  const breakdown = byPost.series
    .map((post) => {
      const value = row[`${post.key}_${metric.id}`];
      const prev = prevRow?.[`${post.key}_${metric.id}`];
      return {
        ...post,
        value,
        gain: value != null && prev != null ? value - prev : null,
        share: total > 0 && value != null ? (value / total) * 100 : 0,
      };
    })
    .filter((p) => p.value != null)
    .sort((a, b) => b.value - a.value);

  // Back-face summary: who's actually carrying the curve, not the same
  // per-post numbers the hover/pin chart already surfaces one at a time.
  const growthChange = last[metric.id] - first[metric.id];
  const growthPoints = [];
  if (breakdown.length) {
    const topPost = breakdown[0];
    const topShare = total > 0 ? (topPost.value / total) * 100 : null;
    growthPoints.push(
      topShare != null
        ? `${topPost.name} is carrying the most of it, at ${fmtShare(topShare)} of the total.`
        : `${topPost.name} leads at ${fmtNum(topPost.value)}.`
    );
    if (breakdown.length > 1 && topShare != null) {
      growthPoints.push(
        topShare >= 50
          ? "That's concentrated in one post rather than spread across the roster."
          : `Spread across ${breakdown.length} posts rather than resting on one.`
      );
    }
  }
  if (Number.isFinite(growthChange)) {
    growthPoints.push(
      growthChange >= 0
        ? `Up ${fmtNum(growthChange)} since ${dayLabel(first.date)}.`
        : `Down ${fmtNum(Math.abs(growthChange))} since ${dayLabel(first.date)}.`
    );
  }

  const backSummary = (
    <FlipSummary
      title={`Total ${metric.label.toLowerCase()}`}
      hint={`${fmtNum(last[metric.id])} across ${creators} live post${creators === 1 ? "" : "s"} in ${campaigns} campaign${campaigns === 1 ? "" : "s"}.`}
      points={growthPoints}
    />
  );

  return (
    <Panel reveal flip back={backSummary} className="px-6 py-5">
      <PanelTitle
        title={`Total ${metric.label.toLowerCase()}`}
        // "since the first reading", NOT "since the post went live" — the first
        // point is the first measurement, which may be well after posting.
        hint={`${fmtNum(last[metric.id])} · +${fmtNum(last[metric.id] - first[metric.id])} since ${dayLabel(first.date)} · ${creators} post${creators === 1 ? "" : "s"} across ${campaigns} campaign${campaigns === 1 ? "" : "s"}`}
        action={<MetricSwitch label="Growth" options={GROWTH_METRICS} value={metric.id} onChange={setMetricId} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <LineChart
          // Full labels: LineChart thins the axis itself (maxTicks) and needs
          // every date intact for the hover readout.
          labels={points.map((p) => dayLabel(p.date))}
          primary={{ label: metric.label, color, values: points.map((p) => p[metric.id]), format: fmtNum }}
          height={PANEL_H}
          fit
          activeIndex={pinned}
          onHover={setHovered}
          onSelect={(i) => setPinned((cur) => (cur === i ? null : i))}
        />

        {/* Fixed height, with the list scrolling inside it. The breakdown has
            one row per measured post, so left to grow it set the height of the
            whole section — four posts and forty drew two different panels, and
            the chart beside it stretched to match. The reading above the list
            stays put; only the rows move. */}
        <div className="flex min-w-0 flex-col lg:border-l lg:border-line lg:pl-5" style={{ height: PANEL_H }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="microlabel">{dayLabel(points[at].date)}</span>
            {pinned != null ? (
              <button onClick={() => setPinned(null)} className="text-[10px] font-semibold text-accent hover:underline">
                unpin
              </button>
            ) : (
              <span className="text-[10px] text-mute">
                {hovered != null ? "click to pin" : "latest"}
              </span>
            )}
          </div>
          <div className="tnum mt-1 text-[24px] font-bold leading-none" style={{ color }}>{fmtNum(total)}</div>
          <div className="mt-1 text-[11px] text-mute">
            {breakdown.length} post{breakdown.length === 1 ? "" : "s"} measured by this day
          </div>

          {/* min-h-0 is what lets a flex child actually scroll rather than
              pushing its parent taller. */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto border-t border-line pt-3 pr-1">
            {breakdown.map((post) => (
              <div key={post.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] font-medium text-ink">{post.name}</span>
                  <span className="tnum shrink-0 text-[12px] font-semibold" style={{ color: palette.neutral }}>{fmtNum(post.value)}</span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] text-mute">{post.campaign || "—"}</span>
                  {/* The day's gain, not the running total — the one number
                      that says whether this post is still moving. */}
                  {post.gain != null && post.gain > 0 && (
                    <span className="tnum shrink-0 text-[10px] font-semibold" style={{ color: palette.neutral }}>+{fmtNum(post.gain)}</span>
                  )}
                </div>
                <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-well">
                  <div className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${post.share}%`, background: color, opacity: 0.75 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════════ */

const EMPTY_FILTERS = Object.fromEntries(FILTER_GROUPS.map((g) => [g.id, []]));

export default function OverviewDashboard() {
  const { P, setPage } = useApp();
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const clientName = user?.clientName ?? "Your Brand";
  const firstName = user?.name?.split(/\s+/)[0] || clientName;

  const { data: campaigns, error, retry } = usePortalCampaigns(); // null = loading
  // Persisted: a filter holds until it is cleared, not until you look at
  // another page. "Clear all" in the filter bar is the way out.
  const [filters, setFilters] = usePersistentState("overview.filters", EMPTY_FILTERS);
  // Which cut of the roster the creators panel is showing. Persisted for the
  // same reason the filters are: it is a reading preference, not page state.
  const [creatorViewId, setCreatorViewId] = usePersistentState("overview.creatorView", "niche");
  const [postSort, setPostSort] = usePersistentState("overview.postSort", "er");

  const introSeen = sessionStorage.getItem(INTRO_KEY) === "1";
  const [introDone, setIntroDone] = useState(introSeen);     // gates the dashboard cascade
  const [introClosed, setIntroClosed] = useState(introSeen); // unmounts the overlay after its exit fade

  /* Reduced motion ⇒ the cinematic intro never plays */
  useEffect(() => {
    if (reducedMotion && !introDone) {
      sessionStorage.setItem(INTRO_KEY, "1");
      setIntroDone(true);
      setIntroClosed(true);
    }
  }, [reducedMotion, introDone]);

  /* ── Derived data. One flatten, then every panel reads from it. ─────────
     Drafts are filtered out HERE, once, so every figure on this page covers the
     same set. They are still on the Campaigns board — a draft is planned work —
     but an unagreed budget and a shortlist nobody has been shown should not
     move a number the brand is asked to trust (portalMetrics countsInMetrics). */
  const list = useMemo(() => (campaigns ?? []).filter(countsInMetrics), [campaigns]);
  const allCreators = useMemo(() => flattenCreators(list), [list]);
  const options = useMemo(() => filterOptions(allCreators), [allCreators]);
  const creators = useMemo(() => applyFilters(allCreators, filters), [allCreators, filters]);

  const kpis = useMemo(() => summarise(list, creators), [list, creators]);
  const health = useMemo(() => healthScore(list), [list]);
  const phases = useMemo(() => pipeline(list), [list]);
  const busiestPhase = useMemo(
    () => phases.reduce((a, b) => (b.count > (a?.count ?? -1) ? b : a), null),
    [phases],
  );
  // Signals and the activity feed describe the account, not the current
  // filter — narrowing to "Nano creators" must not hide an approval request.
  const signalRows = useMemo(() => signals(list, allCreators), [list, allCreators]);
  /* A decision and an observation are different things, and the closing
     section renders them differently. `kind` is set by signals(), which is
     where that difference is actually known. */
  const actionSignals = signalRows.filter((s) => s.kind === "action");
  const noteSignals = signalRows.filter((s) => s.kind !== "action");
  const activity = useMemo(() => activityFeed(list, allCreators), [list, allCreators]);
  const queues = useMemo(() => needsYou(list, allCreators), [list, allCreators]);
  // actionableCount(), not actionSignals.length: needsYou() catches a
  // decision signals() never sees (a live post held on "Waiting on You"), so
  // this is the one place both are combined — every "what needs you" surface
  // on the page reads this same total, so none of them can disagree.
  const totalActionable = actionableCount(signalRows, queues);
  const signalHint =
    totalActionable === 0 ? "Nothing is blocking your campaigns right now."
    : totalActionable === 1 ? "One thing is sitting in your court."
    : `${totalActionable} things are sitting in your court — the top one first.`;

  const goals = useMemo(() => serviceGroups(list, allCreators), [list, allCreators]);
  // Off the RAW campaigns, not allCreators: flattenCreators projects a creator
  // down to the fields the filter panels need and drops tracking.history, which
  // is the whole input here. Account-wide by design — this is the brand's total
  // build, so the creator filter above must not narrow it.
  const growth = useMemo(() => growthAcross(list), [list]);
  const ranked = useMemo(() => rankCampaigns(list, creators), [list, creators]);
  // The two groupings share one panel, so they are declared as one list: a
  // third way of cutting the roster is one entry here and nothing else.
  // Both views now plot in the same neutral ink as every other figure on the
  // page — the grouping switch already tells the reader which cut is on
  // screen, so the color no longer has to do that job too.
  const creatorViews = useMemo(() => [
    { id: "niche", label: "By niche", hint: "Grouped by content niche", chart: "column", color: P.neutral, rows: groupBy(creators, "niche") },
    { id: "size", label: "By follower tier", hint: "Nano <10K · Micro 10K–100K · Macro 100K–1M · Mega 1M+", chart: "bar", color: P.neutral, rows: groupBy(creators, "size") },
  ], [creators, P]);
  const creatorView = creatorViews.find((v) => v.id === creatorViewId) ?? creatorViews[0];
  const platforms = useMemo(() => platformPerformance(creators), [creators]);
  // Held for the session like the grouping toggle beside it — a brand that
  // reads this panel by reach shouldn't have to re-pick reach on every visit.
  const posts = useMemo(() => livePosts(creators, postSort), [creators, postSort]);
  const postSortHint = (POST_SORTS.find((o) => o.id === postSort) ?? POST_SORTS[0]).hint;

  const summary = useMemo(
    () => heroSummary({ kpis, health, signalRows, queues }),
    [kpis, health, signalRows, queues],
  );

  const introData = useMemo(() => ({
    clientName,
    totalCampaigns: kpis.campaigns,
    activeCampaigns: kpis.active,
    creators: kpis.creators,
    liveCreators: kpis.live,
    followers: kpis.followers,
    avgER: kpis.avgER ?? 0,
    budget: kpis.budget,
  }), [clientName, kpis]);

  const go = (signal) => {
    if (signal.page) return setPage(signal.page, signal.params);
    document.getElementById(signal.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!campaigns) return <PageSkeleton />;

  return (
    <div className="relative min-h-screen">
      {/* Cinematic brand story — once per login, over the loaded dashboard */}
      {!introClosed && (
        <Suspense fallback={null}>
          <BrandIntro data={introData} onDone={() => setIntroDone(true)} onClosed={() => setIntroClosed(true)} />
        </Suspense>
      )}

      <AmbientBackground variant="a" />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-16 sm:px-9">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <motion.header
          key={`hero-${introDone}`}
          variants={fadeUp}
          initial="hidden"
          animate={introDone ? "show" : "hidden"}
          className="pt-12"
        >
          {/* Identity line. Hairline slashes rather than middots, so the row
              reads as one dateline instead of three separate chips. */}
          <div className="microlabel mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 tracking-[0.2em]">
            <span className="text-ink">Overview</span>
            <span aria-hidden className="text-line-strong">/</span>
            <span>{clientName}</span>
            <span aria-hidden className="text-line-strong">/</span>
            <span className="tnum">{kpis.campaigns} campaign{kpis.campaigns === 1 ? "" : "s"}</span>
          </div>

          <h1 className="font-serif text-[clamp(34px,4.6vw,52px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">
            {greeting()},{" "}
            <span className="relative inline-block whitespace-nowrap text-accent">
              {firstName}
              <UnderStroke show={introDone} />
            </span>
            .
          </h1>

          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-sub">{summary}</p>

          {/* Masthead rule — closes the greeting off from the panels below it,
              the way a brief's header is ruled off from its body. */}
          <div className="rule mt-7" />

          {/* Three metrics, one graphic: the Apple Activity-rings pattern —
              outer to inner, Campaign progress / Active campaigns / Creators
              live — instead of a lonely boxed ring or a row of flat stats.
              Still no card of its own: the rings and their legend sit right
              on the page, the same treatment the greeting above them gets.
              Hovering either a ring or its legend row highlights both —
              see HeroMetrics. */}
          <HeroMetrics items={[
            {
              key: "progress", color: "var(--color-accent)", label: "Campaign progress",
              pct: health ? health.value : null,
              value: health && (
                <div className="tnum flex items-baseline gap-0.5 text-[30px] font-bold leading-tight tracking-tight" style={{ color: P.text }}>
                  <AnimatedNumber value={health.value} format={(v) => Math.round(v)} />
                  <span className="text-[15px] font-semibold" style={{ color: P.text, opacity: 0.4 }}>%</span>
                </div>
              ),
              sub: health
                ? <div className="text-[11px] text-mute">avg across {health.of} active campaign{health.of === 1 ? "" : "s"}</div>
                : <div className="text-[13px] font-semibold text-mute">Nothing in flight — every campaign is complete.</div>,
            },
            {
              key: "active", color: "var(--color-teal)", label: "Active campaigns",
              pct: kpis.campaigns > 0 ? (kpis.active / kpis.campaigns) * 100 : null,
              value: (
                <div className="tnum flex items-baseline gap-1 text-[30px] font-bold leading-tight tracking-tight" style={{ color: P.text }}>
                  <AnimatedNumber value={kpis.active} format={(v) => Math.round(v)} /><span className="text-[15px] font-semibold text-mute">/{kpis.campaigns}</span>
                </div>
              ),
              sub: <div className="text-[11px] text-mute">{kpis.completed} completed</div>,
            },
            {
              key: "live", color: "var(--color-green)", label: "Creators live",
              pct: kpis.creators > 0 ? (kpis.live / kpis.creators) * 100 : null,
              value: (
                <div className="tnum flex items-baseline gap-1 text-[30px] font-bold leading-tight tracking-tight" style={{ color: P.text }}>
                  <AnimatedNumber value={kpis.live} format={(v) => Math.round(v)} /><span className="text-[15px] font-semibold text-mute">/{kpis.creators}</span>
                </div>
              ),
              sub: <div className="text-[11px] text-mute">on the roster</div>,
            },
          ]} />
        </motion.header>

        {/* ── ACCOUNT ──────────────────────────────────────────────────────
            Every other section here is titled as a sentence about what the
            reader is looking at — "What the work did once it was live.",
            "Where the plan is working", "Who moves the needle". "Main Data
            Cards" named the widget rather than the question, and was the one
            heading on the page that read as scaffolding. */}
        <Section
          id="numbers"
          eyebrow="Account"
          title="Where the account stands"
          hint="Campaign counts and committed budget cover the whole account; audience figures follow the creator filter."
        >
          <CreatorFilters
            options={options}
            filters={filters}
            setFilters={setFilters}
            shown={creators.length}
            total={allCreators.length}
          />

          {/* One ledger band, not six floating cards.
              The six account figures belong to one statement, so they are
              ruled into a single panel the way a broadsheet prints a summary
              table — which also takes the section from six drop shadows down
              to one. The hairlines are the grid's own `gap-px` showing the
              container's colour through between cells, so they land correctly
              however the row wraps; fixed column counts (not auto-fit) are
              what keep that wrapping predictable at every width.
              Each cell still flips — see KPI's `flush` in portal/Shell.jsx. */}
          <Panel reveal className="overflow-hidden">
            <Stagger
              animate="show"
              stagger={0.07}
              className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-6"
            >
              <KPI flush index={0} label="Active campaigns" value={kpis.active} format={Math.round} sublabel={`of ${kpis.campaigns} total`} color={P.neutral}
                back={<FlipSummary padding="px-5 py-[18px]" title="Active campaigns" hint={`${kpis.active} of ${kpis.campaigns} active now.`} />} />
              <KPI flush index={1} label="Creators" value={kpis.creators} format={Math.round} sublabel={`${kpis.live} live`} color={P.neutral}
                back={<FlipSummary padding="px-5 py-[18px]" title="Creators" hint={`${kpis.creators} on the roster, ${kpis.live} live.`} />} />
              <KPI flush index={2} label="Combined audience" value={kpis.followers} format={fmtNum} sublabel="across creators" color={P.neutral}
                back={<FlipSummary padding="px-5 py-[18px]" title="Combined audience" hint="Combined following — not unique reach, audiences overlap." />} />
              {/* Measured on live posts only — see summarise() in portalMetrics.js
                  for why the stored profile rate no longer feeds this tile. */}
              <KPI flush index={3} label="Avg engagement" value={kpis.avgER} format={(v) => `${v.toFixed(1)}%`}
                sublabel={kpis.erMeasured
                  ? `measured on ${kpis.erMeasured} live post${kpis.erMeasured === 1 ? "" : "s"}`
                  : "nothing live to measure yet"}
                color={P.neutral}
                back={<FlipSummary padding="px-5 py-[18px]" title="Avg engagement" hint={kpis.erMeasured
                  ? `Measured on ${kpis.erMeasured} live post${kpis.erMeasured === 1 ? "" : "s"}.`
                  : "Nothing live yet to measure."} />} />
              {/* The sublabel names what the figure leaves out. Campaigns raised
                  before a budget was agreed contribute nothing to this total, so
                  without saying so it reads as the account's whole commitment
                  when it is only the agreed part of it. */}
              <KPI flush index={4} label="Campaign budget" value={kpis.budget || null} format={fmtINR}
                sublabel={kpis.budgetPending ? `committed · ${kpis.budgetPending} to be confirmed` : "committed"}
                color={P.neutral}
                back={<FlipSummary padding="px-5 py-[18px]" title="Campaign budget" hint={kpis.budgetPending
                  ? `${kpis.budgetPending} campaign${kpis.budgetPending === 1 ? "" : "s"} still unconfirmed.`
                  : "Committed across every priced campaign."} />} />
              {/* Same cpvOf() used by PerformanceSection's own CPV tile, over the
                  account's full committed budget and measured views rather than
                  one filtered period — the portfolio rate, not a period rate. */}
              <KPI flush index={5} label="CPV" value={cpvOf(kpis.budget, kpis.views)} format={fmtCPV}
                sublabel="external, on measured views" color={P.green}
                back={<FlipSummary padding="px-5 py-[18px]" title="Cost per view" hint="Committed budget ÷ measured views, account-wide." />} />
            </Stagger>
          </Panel>
        </Section>

        {/* ── AUDIENCE ─────────────────────────────────────────────────── */}
        {/* Sits directly under the main data cards: those report where the
            account stands today, and this is the same story over time, so the
            two read as one thought before the page breaks the numbers apart.
            CONTENT, further down, then breaks the curve down per post. */}
        <Section
          id="growth"
          eyebrow="Audience"
          title="What the work did once it was live."
          hint="This curve fills in as live posts are refreshed — two readings are needed before there is a shape to draw."
        >
          <AccountGrowth growth={growth} palette={P} />
        </Section>

        {/* ── PERFORMANCE PANEL ────────────────────────────────────────── */}
        {/* No Section wrapper: the panel carries its own header, subtitle and
            period filter, and an eyebrow above it only repeated them. */}
        <div id="performance" className="scroll-mt-28 pt-6">
          <PerformanceSection clientName={clientName} />
        </div>

        {/* ── CAMPAIGNS ────────────────────────────────────────────────── */}
        <Section
          id="campaigns"
          eyebrow="Campaigns"
          title="Where the plan is working"
          hint="Every campaign grouped by the service delivering it. Progress is weighted by budget, so the biggest commitments move the number most."
          action={
            <button onClick={() => setPage("campaigns")} className="flex items-center gap-1.5 text-[12px] font-semibold text-sub transition-colors hover:text-accent">
              All campaigns <ArrowRight size={13} />
            </button>
          }
        >
          {goals.length > 0 && (
            <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {goals.map((g, i) => (
                <Panel
                  key={g.service}
                  reveal
                  delay={i * 0.05}
                  className="px-5 py-4"
                  flip
                  back={
                    <FlipSummary
                      padding="px-5 py-4"
                      title={g.service}
                      hint={`${g.progress}% average progress across ${g.campaigns} campaign${g.campaigns === 1 ? "" : "s"}${g.active ? `, ${g.active} active now` : ""}.`}
                      points={[pacingPoint(g), efficiencyPoint(g)].filter(Boolean)}
                      /* `lines` used to repeat the window and the region tags
                         here, which this card's own FRONT already prints —
                         exactly the "chart's numbers said twice" that
                         FlipSummary's doc warns against, and the reason this
                         back overflowed its box by ~67px and lost its last
                         line. The pacing and efficiency reads are the part
                         the front cannot show. */
                    />
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-ink">{g.service}</h3>
                      <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-mute">
                        <Calendar size={11} />
                        {g.from ? prettyDate(g.from) : "—"} – {g.to ? prettyDate(g.to) : "—"}
                      </div>
                    </div>
                    <span className="tnum shrink-0 text-[17px] font-bold" style={{ color: P.neutral }}>{g.progress}%</span>
                  </div>

                  {g.regions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {g.regions.map((r) => (
                        <span key={r} className="rounded-full bg-well px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-sub">{r}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 text-[11.5px] text-sub">
                    {g.campaigns} campaign{g.campaigns === 1 ? "" : "s"} · {g.active} active
                  </div>
                  <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-well">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: P.neutral }}
                      initial={{ width: 0 }} whileInView={{ width: `${g.progress}%` }}
                      viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
                    <span className="text-sub">{fmtNum(g.reach)} reach</span>
                    <span className="font-semibold" style={{ color: P.neutral }}>{fmtINR(g.budget || null)}</span>
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {/* items-stretch + h-full on both: a five-row pipeline next to a
              one-bar podium sized each card to its own content, so the pair
              read as two unrelated boxes at different heights instead of one
              row of the page. Same treatment as the Content section below. */}
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Panel
              reveal
              flip
              back={
                <FlipSummary
                  title="Campaign pipeline"
                  hint={`${kpis.campaigns} campaign${kpis.campaigns === 1 ? "" : "s"} across ${phases.length} stages.`}
                  points={(() => {
                    const inPipeline = phases.reduce((s, p) => s + p.count, 0);
                    const pts = [];
                    if (busiestPhase?.count) {
                      const share = inPipeline > 0 ? (busiestPhase.count / inPipeline) * 100 : null;
                      pts.push(
                        share != null
                          ? `Most campaigns — ${fmtShare(share)} of them — are in ${busiestPhase.short} right now.`
                          : `Most are in ${busiestPhase.short} right now.`
                      );
                    }
                    const empty = phases.filter((p) => p.count === 0);
                    if (empty.length && empty.length < phases.length) {
                      pts.push(`Nothing is currently sitting in ${empty.map((p) => p.short).join(" or ")}.`);
                    } else if (!pts.length) {
                      pts.push(`${kpis.campaigns} campaign${kpis.campaigns === 1 ? "" : "s"} spread across ${phases.length} stages.`);
                    }
                    return pts;
                  })()}
                />
              }
              className="flex h-full flex-col px-6 py-5"
            >
              <PanelTitle title="Campaign pipeline" hint="Where each campaign stands" />
              <div className="flex flex-1 flex-col justify-center gap-3.5">
                {phases.map((p, i) => (
                  <div key={p.id}>
                    <div className="mb-[5px] flex justify-between">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                        <Dot color={P.neutral} /> {p.short}
                      </span>
                      <span className="tnum text-[13.5px] font-bold" style={{ color: p.count ? P.neutral : P.doneTxt, opacity: p.count ? 1 - i * 0.15 : 1 }}>{p.count}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-well">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${kpis.campaigns ? (p.count / kpis.campaigns) * 100 : 0}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                        style={{ background: P.neutral, boxShadow: p.count ? `0 0 10px ${P.neutral}55` : "none", opacity: p.count ? 1 - i * 0.15 : 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              reveal
              delay={0.06}
              flip
              back={
                <FlipSummary
                  title="Top campaigns"
                  hint={ranked.length
                    ? `Ranked by audience reached across ${ranked.length} campaign${ranked.length === 1 ? "" : "s"}.`
                    : "No creators are attached to these campaigns yet."}
                  points={(() => {
                    if (ranked.length >= 2) {
                      const [first, second] = ranked;
                      if (second.reach > 0) {
                        const multiple = first.reach / second.reach;
                        return [
                          multiple >= 1.4
                            ? `${first.name} leads by a wide margin — about ${multiple.toFixed(1)}× the reach of ${second.name}, the next campaign.`
                            : `${first.name} is only narrowly ahead of ${second.name} — reach is close at the top.`,
                        ];
                      }
                      return [`${first.name} leads at ${fmtNum(first.reach)} reach.`];
                    }
                    if (ranked.length === 1) {
                      return [`${ranked[0].name} is the only campaign with reach to rank, at ${fmtNum(ranked[0].reach)}.`];
                    }
                    return [];
                  })()}
                />
              }
              className="flex h-full flex-col px-6 py-5"
            >
              <PanelTitle title="Top campaigns" hint={`Ranked by audience reached · ${ranked.length} campaign${ranked.length === 1 ? "" : "s"}`} />
              {ranked.length ? (
                <Podium
                  items={ranked.map((c) => ({
                    name: c.name,
                    value: c.reach,
                    display: fmtNum(c.reach),
                    sub: c.er != null ? `${c.er.toFixed(1)}% ER` : undefined,
                  }))}
                  color={P.neutral}
                />
              ) : list.length ? (
                <PanelEmpty>No creators are attached to these campaigns yet, so there's no reach to rank.</PanelEmpty>
              ) : (
                <EmptyState
                  icon="▤"
                  title="No campaigns yet"
                  hint="Send us your first requirement and we'll take it from brief to live."
                  actionLabel="Go to Campaigns"
                  onAction={() => setPage("campaigns")}
                />
              )}
            </Panel>
          </div>
        </Section>

        {/* ── CREATORS ─────────────────────────────────────────────────── */}
        {creators.length > 0 && (
          <Section
            id="creators"
            eyebrow="Creators"
            title="Who moves the needle"
            hint="One roster, cut two ways. Switch the grouping, then the metric, to compare on engagement, audience or measured views; the dashed line is the group average and ↑↓ flags a group behaving unlike the rest."
            action={<MetricSwitch label="Grouping" options={creatorViews} value={creatorView.id} onChange={setCreatorViewId} />}
          >
            <GroupedPanel view={creatorView} />
          </Section>
        )}

        {/* ── CONTENT ──────────────────────────────────────────────────── */}
        <Section
          id="content"
          eyebrow="Content"
          title="What lands, and why"
          hint="Only posts that are live and whose metrics we've fetched appear here — a creator without measured views is left out rather than plotted at zero."
        >
          {/* items-stretch, not items-start: these two sit side by side and
              each was sizing to its own content, so a 280px scatter next to a
              two-row list left the right panel visibly stunted. Equal heights
              read as one row of the page rather than two unrelated boxes. */}
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <Panel reveal className="flex h-full flex-col px-6 py-5">
              <PanelTitle
                title="Platform performance"
                hint="How far a post travels, and how hard that audience engages"
                info="Average views per live post, and how many of those viewers liked or commented. With two or more platforms, each is ranked against the best and labelled against your own median."
              />
              {platforms.length ? (
                /* flex-1 + justify-center so one platform sits in the middle of
                   the panel rather than at the top of a card sized by the list
                   beside it — same rule the other paired panels follow. */
                <div className="flex flex-1 flex-col justify-center">
                  <PlatformScorecard
                    rows={platforms.map((p) => ({
                      label: p.label,
                      avgViews: p.avgViews,
                      er: p.er ?? null,
                      live: p.live || p.count,
                      color: P.neutral,
                    }))}
                    viewsFormat={fmtNum}
                  />
                </div>
              ) : (
                <PanelEmpty>
                  Nothing is live with measured metrics yet. Post performance appears here after the first refresh.
                </PanelEmpty>
              )}
            </Panel>

            <Panel reveal delay={0.06} className="flex h-full flex-col px-6 py-5">
              <PanelTitle
                title="Live posts"
                hint={`${postSortHint} · ${posts.length} live`}
                action={<MetricSwitch label="Sort" options={POST_SORTS} value={postSort} onChange={setPostSort} />}
              />
              {posts.length ? (
                /* flex-1 so a short list distributes down the panel it shares a
                   row with, instead of bunching at the top under dead space. */
                <div className="flex flex-1 flex-col justify-center">
                  {posts.slice(0, 6).map((p) => (
                    <a
                      key={p.key}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 border-b border-line py-3 last:border-b-0 hover:bg-accent/[0.03]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/[0.09] text-[10px] font-bold text-accent">
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                        <span className="block truncate text-[11px] text-mute">
                          {p.campaignName} · {p.platform}
                          {p.postedDate ? ` · ${prettyDate(p.postedDate)}` : ""}
                        </span>
                      </span>
                      {/* The column the list is ordered by keeps its colour;
                          the other steps back. Two identically weighted figures
                          gave no clue which one the ranking followed, so a
                          list sorted by views still read as a leaderboard of
                          the ER column beside it. */}
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-[12.5px] font-bold" style={{ color: postSort === "views" ? P.neutral : "var(--color-mute)" }}>{p.views != null ? fmtNum(p.views) : "—"}</span>
                        <span className="block text-[9px] uppercase tracking-[0.08em] text-mute">views</span>
                      </span>
                      <span className="w-[52px] shrink-0 text-right">
                        <span className="tnum block text-[12.5px] font-bold" style={{ color: postSort === "er" ? P.neutral : "var(--color-mute)" }}>{p.er != null ? `${p.er.toFixed(1)}%` : "—"}</span>
                        <span className="block text-[9px] uppercase tracking-[0.08em] text-mute">er</span>
                      </span>
                      <ExternalLink size={13} className="shrink-0 text-mute opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              ) : (
                <PanelEmpty>No posts are live yet for the current filter.</PanelEmpty>
              )}
            </Panel>
          </div>
        </Section>

        {/* ── SIGNALS ──────────────────────────────────────────────────── */}
        {/* Closes the page rather than opening it: by the time the reader
            reaches here they've seen the account's whole shape, so "what
            needs a decision today" lands as a to-do list off the back of
            that context instead of the very first thing before any of it. */}
        <Section
          id="signals"
          eyebrow="Over to you"
          title="Your call"
          hint={signalHint}
        >
          {/* Decisions first, ranked, in one panel. */}
          {actionSignals.length > 0 && (
            <Panel reveal className="divide-y divide-line overflow-hidden">
              {actionSignals.map((s, i) => (
                <SignalRow
                  key={s.id} signal={s} onGo={() => go(s)} P={P}
                  /* The wash means "start here", so it needs somewhere else to
                     start: on a lone row it is a tint saying nothing. */
                  first={i === 0 && actionSignals.length > 1}
                />
              ))}
            </Panel>
          )}

          {/* Nothing to decide — across BOTH sources (actionSignals and the
              needsYou queue below), or this could say "nothing blocking you"
              directly above a creator NeedsYouExtra then lists as needing
              exactly that. The full empty-state panel would be a large box
              announcing an absence directly above real content, so it
              shrinks to one line whenever there are notes to follow it. */}
          {totalActionable === 0 && (noteSignals.length > 0 ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Radio size={15} className="text-green" />
              You&rsquo;re all caught up — nothing is waiting on your call.
            </p>
          ) : (
            <Panel reveal className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Radio size={22} className="text-green" />
              <div className="text-[13.5px] font-semibold text-ink">All clear</div>
              <p className="max-w-xs text-[12px] text-mute">
                Nothing is waiting on your call. We&rsquo;ll surface approvals and uploads here the moment they land.
              </p>
            </Panel>
          ))}

          {/* Per-creator detail behind the count above — same section, same
              story, instead of a second heading making its own claim. */}
          <NeedsYouExtra queues={queues} setPage={setPage} P={P} />

          {noteSignals.length > 0 && (
            <div className={totalActionable > 0 ? "mt-6" : "mt-4"}>
              <div className="microlabel mb-3">Also worth knowing</div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                {noteSignals.map((s) => (
                  <SignalNote key={s.id} signal={s} onGo={() => go(s)} />
                ))}
              </div>
            </div>
          )}

          {/* History, last and lightest — what happened, not what to do. */}
          <RecentActivity activity={activity} queues={queues} setPage={setPage} P={P} />
        </Section>
      </div>
    </div>
  );
}