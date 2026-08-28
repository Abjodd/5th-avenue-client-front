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
  Radio, TrendingUp, Calendar, ExternalLink, SlidersHorizontal,
} from "lucide-react";

import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { usePortalCampaigns } from "../lib/usePortalData";
import { usePersistentState } from "../lib/usePersistentState";
import { fmtNum, fmtINR, prettyDate, initials, dayLabel } from "../lib/format";
import { phaseColors as phaseColorsFor } from "../lib/phases";
import { INTRO_KEY } from "../lib/session";
import { EASE, fadeUp } from "../lib/motion";
import {
  flattenCreators, filterOptions, applyFilters, FILTER_GROUPS,
  summarise, healthScore, pipeline, signals, groupBy, availableMetrics,
  GROUP_METRICS, flagOutliers, serviceGroups, rankCampaigns,
  platformPerformance, livePosts, activityFeed, needsYou,
  greeting, heroSummary, growthAcross,
} from "../lib/portalMetrics";

import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import PerformanceSection from "../components/PerformanceSection";
import { Stagger, AmbientBackground } from "../components/motion/Motion";
import { Panel, Subpanel, Section, PanelTitle, KPI, MetricSwitch, PanelEmpty } from "../components/portal/Shell";
import { ProgressRing } from "../components/primitives/ProgressRing";
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
   HERO — activity panel (Recent activity + Needs you, side by side)
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Sits beside Campaign progress in the hero, in the spot Signals used to hold.
 * Two questions — "what happened" and "what's waiting on me" — read better
 * side by side than stacked, since neither needs the other's full column
 * width, and the hero is wide enough to hold both without crowding.
 *
 * Each half scrolls independently (min-h-0 + overflow-y-auto) so a long
 * history or a long queue can't stretch the hero taller than Campaign
 * progress — the grid's items-stretch already pins both hero panels to the
 * same height, so the content inside has to yield to it, not the other way
 * round.
 */
function HeroActivityPanel({ activity, queues, setPage, P }) {
  const hasActivity = activity.length > 0;
  const hasQueues = queues.length > 0;
  const totalQueue = queues.reduce((s, q) => s + q.count, 0);

  return (
    <Panel reveal delay={0.06} className="flex h-full flex-col gap-5 px-6 py-5 lg:flex-row">
      {/* Recent activity */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PanelTitle title="Recent activity" hint="Dated events across your campaigns" />
        {hasActivity ? (
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
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
        ) : (
          <PanelEmpty>Nothing dated to show yet. Posts going live and metric refreshes appear here as they happen.</PanelEmpty>
        )}
      </div>

      <div className="hidden shrink-0 border-l border-line lg:block" />

      {/* Needs you */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PanelTitle
          title="Needs you"
          hint="Creators sitting in your court"
          action={
            hasQueues && (
              <span
                className="tnum flex size-6 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: `${P.neutral}14`, color: P.neutral }}
              >
                {totalQueue}
              </span>
            )
          }
        />
        {hasQueues ? (
          <div className="mt-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {queues.map((q, i) => (
              <Subpanel
                key={q.campaignId}
                className={`shrink-0 overflow-hidden transition-all duration-200 hover:-translate-y-px hover:shadow-md ${
                  i === 0 ? "border-accent/25 bg-accent/[0.06]" : ""
                }`}
              >
                <button
                  onClick={() => setPage("campaigns", { campaignId: q.campaignId })}
                  className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left"
                >
                  {i === 0 && <span className="size-1.5 shrink-0 rounded-full" style={{ background: P.neutral }} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {q.lead.name} {q.count > 1 ? `+${q.count - 1} more` : ""} need{q.count === 1 ? "s" : ""} a decision
                    </span>
                    <span className="block truncate text-[10.5px] text-mute">{q.campaignName} · {q.lead.statusLabel}</span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>
              </Subpanel>
            ))}
          </div>
        ) : (
          <PanelEmpty>Nothing needs your call right now.</PanelEmpty>
        )}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNALS — closing section, one card per decision waiting on the brand
   ═════════════════════════════════════════════════════════════════════════ */

/** A single signal as a card rather than a list row — the closing section
    has the full page width to spend, where the hero never did, so each
    signal gets room to breathe instead of queuing in a narrow column. */
function SignalCard({ signal, onGo, P }) {
  const Icon = SIGNAL_ICONS[signal.icon] || Sparkles;
  return (
    <button
      onClick={onGo}
      className="group flex flex-col gap-4 rounded-[16px] border border-line bg-well/60 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[12px] transition-transform duration-200 group-hover:scale-105"
        style={{ background: `${P.neutral}14`, color: P.neutral }}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-sub">
        {signal.count != null && (
          <b className="text-[15px] font-bold" style={{ color: P.neutral }}>{signal.count} </b>
        )}
        {signal.lead && <b className="font-semibold text-ink">{signal.lead} </b>}
        {signal.text}
      </span>
      <span className="mt-auto flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute transition-colors group-hover:text-accent">
        {signal.action}
        <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
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

  return (
    <Panel reveal className="flex flex-col px-6 py-5">
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

  return (
    <Panel reveal className="px-6 py-5">
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

  /* ── Derived data. One flatten, then every panel reads from it. ───────── */
  const list = useMemo(() => campaigns ?? [], [campaigns]);
  const allCreators = useMemo(() => flattenCreators(list), [list]);
  const options = useMemo(() => filterOptions(allCreators), [allCreators]);
  const creators = useMemo(() => applyFilters(allCreators, filters), [allCreators, filters]);

  const kpis = useMemo(() => summarise(list, creators), [list, creators]);
  const health = useMemo(() => healthScore(list), [list]);
  const phases = useMemo(() => pipeline(list), [list]);
  // Signals and the activity feed describe the account, not the current
  // filter — narrowing to "Nano creators" must not hide an approval request.
  const signalRows = useMemo(() => signals(list, allCreators), [list, allCreators]);
  const activity = useMemo(() => activityFeed(list, allCreators), [list, allCreators]);
  const queues = useMemo(() => needsYou(list, allCreators), [list, allCreators]);

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
  const posts = useMemo(() => livePosts(creators), [creators]);

  const summary = useMemo(
    () => heroSummary({ kpis, health, signalRows }),
    [kpis, health, signalRows],
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

  const phaseColors = phaseColorsFor(P);

  const go = (signal) => {
    if (signal.page) return setPage(signal.page, signal.params);
    document.getElementById(signal.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!campaigns) return <PageSkeleton />;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Enhanced gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-40 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{animationDelay: "2s"}} />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple/5 rounded-full blur-3xl opacity-20" />
      </div>

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
          <motion.div 
            className="microlabel mb-3 tracking-[0.3em] text-accent/70 font-semibold"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            ✨ Overview · {clientName} · {kpis.campaigns} campaign{kpis.campaigns === 1 ? "" : "s"}
          </motion.div>
          <motion.h1 
            className="font-serif text-[clamp(40px,5.5vw,64px)] font-black leading-[1.02] tracking-[-0.03em] text-ink bg-gradient-to-r from-ink via-accent to-ink bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            {greeting()}, <span className="italic text-accent drop-shadow-lg">{firstName}</span>.
          </motion.h1>
          <motion.p 
            className="mt-4 max-w-[65ch] text-[15.5px] leading-relaxed text-sub/90 font-medium"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >{summary}</motion.p>

          <motion.div 
            className="mt-9 grid items-stretch gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {/* Campaign progress — the mean of the progress Fifth Avenue records on
                each live campaign. Hidden entirely when nothing is in flight. */}
            <Panel reveal className="flex flex-col items-center justify-center px-6 py-7">
              {health ? (
                <>
                  <div className="relative">
                    <ProgressRing
                      value={health.value}
                      size={168}
                      stroke={13}
                      // Neutral, not a grade: this ring reports how far the
                      // work has come, and a fixed color regardless of value
                      // keeps a campaign that's simply just started from
                      // reading as "in trouble." It also now matches every
                      // other figure on the page instead of standing out
                      // as the one green number.
                      color={P.green}
                      showLabel={false}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-baseline justify-center gap-0.5 pt-[68px]">
                      <span className="tnum text-[46px] font-bold leading-none tracking-tight" style={{ color: P.black }}>{health.value}</span>
                      <span className="text-[17px] font-semibold" style={{ color: P.neutral, opacity: 0.55 }}>%</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-[15px] font-bold text-ink">Campaign Progress</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-mute">
                      Average progress across {health.of} active campaign{health.of === 1 ? "" : "s"}
                    </p>
                  </div>
                </>
              ) : (
                <PanelEmpty>Nothing in flight — every campaign is complete.</PanelEmpty>
              )}
            </Panel>

            {/* Recent activity + Needs you — what happened, and what's waiting */}
            <HeroActivityPanel activity={activity} queues={queues} setPage={setPage} P={P} />
          </motion.div>
        </motion.header>

        {/* ── ACCOUNT ──────────────────────────────────────────────────── */}
        <Section
          id="numbers"
          eyebrow="Account"
          title="Main Data Cards"
          hint="Campaign counts and committed budget cover the whole account; audience figures follow the creator filter."
        >
          <CreatorFilters
            options={options}
            filters={filters}
            setFilters={setFilters}
            shown={creators.length}
            total={allCreators.length}
          />

          <Stagger animate="show" stagger={0.07} className="grid gap-3.5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <KPI index={0} label="Active campaigns" value={kpis.active} format={Math.round} sublabel={`of ${kpis.campaigns} total`} color={P.neutral} />
            <KPI index={1} label="Creators" value={kpis.creators} format={Math.round} sublabel={`${kpis.live} live`} color={P.neutral} />
            <KPI index={2} label="Combined audience" value={kpis.followers} format={fmtNum} sublabel="across creators" color={P.neutral} />
            <KPI index={3} label="Avg engagement" value={kpis.avgER} format={(v) => `${v.toFixed(1)}%`} sublabel="creators with ER data" color={P.neutral} />
            {/* The sublabel names what the figure leaves out. Campaigns raised
                before a budget was agreed contribute nothing to this total, so
                without saying so it reads as the account's whole commitment
                when it is only the agreed part of it. */}
            <KPI index={4} label="Campaign budget" value={kpis.budget || null} format={fmtINR}
              sublabel={kpis.budgetPending ? `committed · ${kpis.budgetPending} to be confirmed` : "committed"}
              color={P.neutral} />
          </Stagger>
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
                <Panel key={g.service} reveal delay={i * 0.05} className="px-5 py-4">
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
            <Panel reveal className="flex h-full flex-col px-6 py-5">
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

            <Panel reveal delay={0.06} className="flex h-full flex-col px-6 py-5">
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
              <PanelTitle title="Live posts" hint={`Best engaging first · ${posts.length} live`} />
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
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-[12.5px] font-bold" style={{ color: P.neutral }}>{p.views != null ? fmtNum(p.views) : "—"}</span>
                        <span className="block text-[9px] uppercase tracking-[0.08em] text-mute">views</span>
                      </span>
                      <span className="w-[52px] shrink-0 text-right">
                        <span className="tnum block text-[12.5px] font-bold" style={{ color: P.neutral }}>{p.er != null ? `${p.er.toFixed(1)}%` : "—"}</span>
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
          eyebrow="Signals"
          title="What needs a decision"
          hint="Approvals, uploads, and briefs waiting on your call today."
        >
          {signalRows.length ? (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {signalRows.map((s) => (
                <SignalCard key={s.id} signal={s} onGo={() => go(s)} P={P} />
              ))}
            </div>
          ) : (
            <Panel reveal className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Radio size={22} className="text-green" />
              <div className="text-[13.5px] font-semibold text-ink">All clear</div>
              <p className="max-w-xs text-[12px] text-mute">
                Nothing is waiting on your call. We'll surface approvals and uploads here the moment they land.
              </p>
            </Panel>
          )}
        </Section>
      </div>
    </div>
  );
}