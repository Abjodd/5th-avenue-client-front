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
 * Styled to match the rest of the (light, warm-paper) Overview page — no
 * separate dark theme.
 */
import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import PeriodFilter from "./PeriodFilter";
import { useApp } from "../context";
import { rangeFor, buildTimeSeries, parsePortalDate, INTERVALS } from "../lib/dates";
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

const axisProps = {
  tick: { fontSize: 10, fill: "#7A7566", fontFamily: "Sora, sans-serif" },
  axisLine: false,
  tickLine: false,
};
const tooltipStyle = {
  contentStyle: {
    background: "#FFFFFF",
    border: "1px solid rgba(28,24,16,0.09)",
    borderRadius: 8,
    fontSize: 11.5,
    fontFamily: "Sora, sans-serif",
    boxShadow: "0 12px 32px rgba(28,24,16,0.12)",
    color: "#1C1A15",
  },
  labelStyle: { color: "#1C1A15", fontWeight: 700, marginBottom: 3 },
  cursor: { stroke: "rgba(28,24,16,0.12)", strokeWidth: 1, fill: "rgba(28,24,16,0.03)" },
};

function StatTile({ label, value, color }) {
  return (
    <div className="rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3.5 py-3 shadow-[0_1px_10px_rgba(15,23,42,0.03)] backdrop-blur-md">
      <div className="microlabel">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

function FunnelRow({ label, value, pct, drop, color, isFirst }) {
  return (
    <div>
      <div className="mb-[5px] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] text-ink">
          {label}
          {!isFirst && drop != null && (
            <span className="text-[10px] font-semibold text-red">▼ {drop.toFixed(1)}% drop</span>
          )}
        </span>
        <span className="text-[13px] font-bold" style={{ color }}>{fmtNum(value)}</span>
      </div>
      <div className="relative h-[18px] overflow-hidden rounded-sm bg-well">
        <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: color, opacity: 0.85 }}/>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink">
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function PerformanceSection({ clientName: clientNameProp }) {
  const { P } = useApp();
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
    return buildTimeSeries(events, { from, to: range.to }, chartInterval, SERIES_FIELDS);
  }, [events, preset, range, chartInterval]);

  const totals = useMemo(() => {
    const sum = k => events.reduce((s, ev) => s + (ev[k] || 0), 0);
    return { imp: sum("impressions"), reach: sum("reach"), eng: sum("engagements"), clicks: sum("clicks"), spend: sum("spend") };
  }, [events]);

  const intervalLabel = INTERVALS.find(iv => iv.id === chartInterval)?.label.toLowerCase() || chartInterval;
  // Dots clutter dense series (e.g. daily over 6 months) — hide them there.
  const showDots = series.length <= 45;

  const donutSlices = useMemo(() =>
    Object.entries(spendByService)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: serviceColor(name, P) }))
  , [spendByService, P]);

  const totalSpend = donutSlices.reduce((s, d) => s + d.value, 0);

  const funnelRows = useMemo(() => {
    const top = totals.imp || totals.reach || 1;
    const rows = [
      { label: "Impressions", value: totals.imp,    color: P.accent },
      { label: "Reach",       value: totals.reach,  color: P.pink   },
      { label: "Engagements", value: totals.eng,    color: P.amber  },
      { label: "Clicks",      value: totals.clicks, color: P.green  },
    ];
    return rows.map((r, i) => ({
      ...r,
      pct: top > 0 ? (r.value / top) * 100 : 0,
      drop: i > 0 ? (1 - r.value / (rows[i-1].value || 1)) * 100 : null,
      isFirst: i === 0,
    }));
  }, [totals, P]);

  const isLoading = analytics === null && !error;

  return (
    <div className="au mt-4 overflow-hidden rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_10px_36px_rgba(15,23,42,0.06)]">

      {/* Header + period filter */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(15,23,42,0.06)] px-6 py-5">
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

        {/* KPI stat strip */}
        <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          <StatTile label="Total Reach"    value={isLoading ? "…" : fmtNum(totals.reach)}  color={P.pink} />
          <StatTile label="Impressions"    value={isLoading ? "…" : fmtNum(totals.imp)}    color={P.accent} />
          <StatTile label="Engagements"    value={isLoading ? "…" : fmtNum(totals.eng)}    color={P.amber} />
          <StatTile label="Clicks (est.)"  value={isLoading ? "…" : fmtNum(totals.clicks)} color={P.green} />
          <StatTile label="Total Spend"    value={isLoading ? "…" : fmtINR(totals.spend)}  color={P.purple} />
        </div>

        {/* Row 1: Dual-axis line chart */}
        <div className="mb-4 overflow-hidden rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 p-4 shadow-[0_1px_10px_rgba(15,23,42,0.03)] backdrop-blur-md">
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
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={series} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(28,24,16,0.06)" vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={20} interval="preserveStartEnd" />
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

          <div className="overflow-hidden rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 p-4 shadow-[0_1px_10px_rgba(15,23,42,0.03)] backdrop-blur-md">
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold text-ink">Funnel</div>
            <p className="mb-4 text-[10.5px] text-mute">Exposure → Engagement → Click · based on campaign reach</p>
            {isLoading ? (
              <div className="flex h-[140px] items-center justify-center text-[12px] text-mute">Loading…</div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {funnelRows.map(r => <FunnelRow key={r.label} {...r} />)}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 p-4 shadow-[0_1px_10px_rgba(15,23,42,0.03)] backdrop-blur-md">
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

        <p className="mt-3 text-[10px] text-mute">
          Reach = creator follower sum. Impressions ≈ reach × 12%. Engagements derived from avgER.
          Clicks ≈ engagements × 8%. All estimates — real tracking data updates when 5th Avenue refreshes post metrics.
        </p>
      </div>
    </div>
  );
}
