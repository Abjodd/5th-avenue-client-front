/**
 * PerformanceSection — Analytics panel for the client portal Overview page.
 * Three panels matching the screenshot:
 *   1. Reach vs Spend dual-axis line chart (toggles to Engagement vs Spend)
 *   2. Funnel — horizontal bars: Impressions → Reach → Engagements → Clicks
 *   3. Spend Split — donut chart by service
 *
 * Data flows from /api/portal/analytics (real MongoDB campaigns) — filtered
 * by the selected period. Falls back to derived zeros if the backend is
 * unreachable so the UI never hard-crashes.
 */
import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import PeriodFilter from "./PeriodFilter";
import { rangeFor } from "../lib/dates";
import { fmtNum, fmtINR } from "../lib/format";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// ── Colour tokens ──────────────────────────────────────────────────────────
// Dark panel palette (navy surface, matching the screenshot aesthetic).
const DARK_BG      = "#0F1629";   // panel bg
const DARK_SURFACE = "#18213A";   // card / tile bg
const DARK_BORDER  = "rgba(255,255,255,0.08)";
const DARK_MUTE    = "rgba(255,255,255,0.38)";
const DARK_INK     = "#E8ECF4";
const DARK_GRID    = "rgba(255,255,255,0.06)";

const C_REACH  = "#4C9BFF";   // blue — left axis
const C_SPEND  = "#F5B942";   // amber — right axis
const C_ENG    = "#E8609A";   // pink — engagement line
const C_IMP    = "#4C9BFF";
const C_CLICKS = "#22C55E";   // green

// Service→colour for the donut
const SVC_COLORS = [
  ["Influencer Marketing", "#4C9BFF"],
  ["AEO",                  "#22C55E"],
  ["Performance Ads",      "#E8609A"],
  ["Offline Activation",   "#F5B942"],
  ["Other",                "#7860D6"],
];
function serviceColor(name) {
  const match = SVC_COLORS.find(([s]) =>
    name.toLowerCase().includes(s.split(" ")[0].toLowerCase())
  );
  return match ? match[1] : "#7860D6";
}

// ── Axis / tooltip shared props ────────────────────────────────────────────
const axisProps = {
  tick: { fontSize: 10, fill: DARK_MUTE, fontFamily: "Sora, sans-serif" },
  axisLine: false,
  tickLine: false,
};
const tooltipStyle = {
  contentStyle: {
    background: "#1E2B4A",
    border: `1px solid ${DARK_BORDER}`,
    borderRadius: 8,
    fontSize: 11.5,
    fontFamily: "Sora, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    color: DARK_INK,
  },
  labelStyle: { color: DARK_INK, fontWeight: 700, marginBottom: 3 },
  cursor: { stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, fill: "rgba(255,255,255,0.03)" },
};

// ── Small stat tiles ───────────────────────────────────────────────────────
function StatTile({ label, value, color }) {
  return (
    <div style={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}` }}
      className="rounded-[10px] px-3.5 py-3">
      <div style={{ color: DARK_MUTE }} className="text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-none" style={{ color: color || DARK_INK }}>{value}</div>
    </div>
  );
}

// ── Custom donut label ─────────────────────────────────────────────────────
function DonutLabel({ cx, cy, total }) {
  return (
    <text textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} y={cy - 9} fontSize={20} fontWeight="700" fill={DARK_INK} fontFamily="Sora, sans-serif">
        {fmtINR(total)}
      </tspan>
      <tspan x={cx} y={cy + 10} fontSize={9.5} fill={DARK_MUTE} fontFamily="Sora, sans-serif" letterSpacing="0.1em">
        TOTAL
      </tspan>
    </text>
  );
}

// ── Funnel bar row ─────────────────────────────────────────────────────────
function FunnelRow({ label, value, pct, drop, color, isFirst }) {
  return (
    <div>
      <div className="mb-[5px] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: DARK_INK }}>
          {label}
          {!isFirst && drop != null && (
            <span className="text-[10px] font-semibold" style={{ color: "#F87171" }}>
              ▼ {drop.toFixed(1)}% drop
            </span>
          )}
        </span>
        <span className="text-[13px] font-bold" style={{ color }}>{fmtNum(value)}</span>
      </div>
      <div className="relative h-[18px] overflow-hidden rounded-sm" style={{ background: DARK_SURFACE }}>
        <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, background: color, opacity: 0.85 }}/>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold" style={{ color: DARK_INK }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PerformanceSection({ clientName: clientNameProp }) {
  const { user } = useAuth();
  const clientName = clientNameProp || user?.clientName;

  const [preset, setPreset]   = useState("6m");
  const [gran,   setGran]     = useState("monthly");
  const [toggle, setToggle]   = useState("reach");  // "reach" | "engagement"
  const [analytics, setAnalytics] = useState(null);  // null = loading
  const [error, setError]     = useState(null);

  // Build ISO range strings from the preset
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

  // ── Derived series ───────────────────────────────────────────────────────
  const monthly = analytics?.monthly || [];
  const spendByService = analytics?.spendByService || {};

  // Totals across the period
  const totals = useMemo(() => {
    const sum = k => monthly.reduce((s, m) => s + (m[k] || 0), 0);
    const imp = sum("impressions");
    const reach = sum("reach");
    const eng = sum("engagements");
    const clicks = sum("clicks");
    const spend = sum("spend");
    return { imp, reach, eng, clicks, spend };
  }, [monthly]);

  // Donut slices
  const donutSlices = useMemo(() =>
    Object.entries(spendByService)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: serviceColor(name) }))
  , [spendByService]);

  const totalSpend = donutSlices.reduce((s, d) => s + d.value, 0);

  // Funnel rows — only show non-zero
  const funnelRows = useMemo(() => {
    const top = totals.imp || totals.reach || 1;
    const rows = [
      { label: "Impressions", value: totals.imp,   color: C_IMP  },
      { label: "Reach",       value: totals.reach,  color: "#7C6EF0" },
      { label: "Engagements", value: totals.eng,    color: C_ENG  },
      { label: "Clicks",      value: totals.clicks, color: C_CLICKS },
    ];
    return rows.map((r, i) => ({
      ...r,
      pct: top > 0 ? (r.value / top) * 100 : 0,
      drop: i > 0 ? (1 - r.value / (rows[i-1].value || 1)) * 100 : null,
      isFirst: i === 0,
    }));
  }, [totals]);

  // Loading skeleton dots
  const isLoading = analytics === null && !error;

  return (
    <div className="mt-3.5 overflow-hidden rounded-[14px]"
      style={{ background: DARK_BG, border: `1px solid ${DARK_BORDER}` }}>

      {/* ── Header + period filter ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
        style={{ borderBottom: `1px solid ${DARK_BORDER}` }}>
        <div>
          <h3 className="font-serif text-[18px] italic font-semibold" style={{ color: DARK_INK }}>Performance</h3>
          <p className="mt-0.5 text-[11.5px]" style={{ color: DARK_MUTE }}>
            Dual-axis · monthly view · overall trend
          </p>
        </div>
        {/* Date filter — light tokens overridden via inline style cascade */}
        <div className="[--tw-ring-color:transparent]">
          <PeriodFilter preset={preset} onPreset={setPreset} gran={gran} onGran={setGran} dark />
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-[12px]" style={{ color: "#F87171" }}>
            Could not load analytics — is the backend running? ({error})
          </div>
        )}

        {/* ── KPI stat strip ─────────────────────────────────────────────── */}
        <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          <StatTile label="Total Reach"    value={isLoading ? "…" : fmtNum(totals.reach)}  color={C_REACH} />
          <StatTile label="Impressions"    value={isLoading ? "…" : fmtNum(totals.imp)}    color={C_IMP} />
          <StatTile label="Engagements"    value={isLoading ? "…" : fmtNum(totals.eng)}    color={C_ENG} />
          <StatTile label="Clicks (est.)"  value={isLoading ? "…" : fmtNum(totals.clicks)} color={C_CLICKS} />
          <StatTile label="Total Spend"    value={isLoading ? "…" : fmtINR(totals.spend)}  color={C_SPEND} />
        </div>

        {/* ── Row 1: Dual-axis line chart ─────────────────────────────────── */}
        <div className="mb-4 overflow-hidden rounded-[11px] p-4"
          style={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}` }}>

          {/* Chart header + toggle */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-serif text-[15px] italic font-semibold" style={{ color: DARK_INK }}>
                {toggle === "reach" ? "Reach vs Spend" : "Engagement vs Spend"}
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: DARK_MUTE }}>
                Dual-axis · monthly view · overall trend
              </div>
            </div>
            <div className="flex overflow-hidden rounded-lg" style={{ border: `1px solid ${DARK_BORDER}` }}>
              {[["reach", "Reach vs Spend"], ["engagement", "Engagement vs Spend"]].map(([id, label]) => (
                <button key={id} onClick={() => setToggle(id)}
                  className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  style={{
                    background: toggle === id ? "rgba(76,155,255,0.18)" : "transparent",
                    color: toggle === id ? C_REACH : DARK_MUTE,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend row */}
          <div className="mb-3 flex gap-5">
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: DARK_INK }}>
              <span className="inline-block h-px w-6 rounded" style={{ background: toggle==="reach" ? C_REACH : C_ENG, height: 2 }}/>
              {toggle === "reach" ? "Reach (M) · left axis" : "Engagements · left axis"}
            </span>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: DARK_INK }}>
              <span className="inline-block h-px w-6 rounded" style={{ background: C_SPEND, height: 2 }}/>
              Spend (₹L) · right axis
            </span>
          </div>

          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center text-[12px]" style={{ color: DARK_MUTE }}>
              Loading…
            </div>
          ) : monthly.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-[12px]" style={{ color: DARK_MUTE }}>
              No data for the selected period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={monthly} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={DARK_GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={20} interval="preserveStartEnd" />
                <YAxis yAxisId="left"  {...axisProps} tickFormatter={v => fmtNum(v)} width={44} />
                <YAxis yAxisId="right" {...axisProps} orientation="right" tickFormatter={v => fmtINR(v)} width={52} />
                <Tooltip {...tooltipStyle}
                  formatter={(v, name) => {
                    if (name === "Spend") return [fmtINR(v), name];
                    return [fmtNum(v), name];
                  }}
                />
                <Line yAxisId="left" type="monotone"
                  dataKey={toggle === "reach" ? "reach" : "engagements"}
                  name={toggle === "reach" ? "Reach" : "Engagements"}
                  stroke={toggle === "reach" ? C_REACH : C_ENG}
                  strokeWidth={2.5} dot={{ r: 4, fill: toggle==="reach" ? C_REACH : C_ENG, strokeWidth: 2, stroke: DARK_SURFACE }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: DARK_SURFACE }} />
                <Line yAxisId="right" type="monotone"
                  dataKey="spend" name="Spend"
                  stroke={C_SPEND}
                  strokeWidth={2.5} dot={{ r: 4, fill: C_SPEND, strokeWidth: 2, stroke: DARK_SURFACE }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: DARK_SURFACE }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Row 2: Funnel + Spend Split side by side ───────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Funnel */}
          <div className="overflow-hidden rounded-[11px] p-4"
            style={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}` }}>
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold" style={{ color: DARK_INK }}>Funnel</div>
            <p className="mb-4 text-[10.5px]" style={{ color: DARK_MUTE }}>
              Exposure → Engagement → Click · based on campaign reach
            </p>
            {isLoading ? (
              <div className="flex h-[140px] items-center justify-center text-[12px]" style={{ color: DARK_MUTE }}>Loading…</div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {funnelRows.map(r => (
                  <FunnelRow key={r.label} {...r} />
                ))}
              </div>
            )}
          </div>

          {/* Spend Split donut */}
          <div className="overflow-hidden rounded-[11px] p-4"
            style={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}` }}>
            <div className="mb-[3px] font-serif text-[15px] italic font-semibold" style={{ color: DARK_INK }}>Spend Split</div>
            <p className="mb-2 text-[10.5px]" style={{ color: DARK_MUTE }}>By service · selected period</p>

            {isLoading ? (
              <div className="flex h-[180px] items-center justify-center text-[12px]" style={{ color: DARK_MUTE }}>Loading…</div>
            ) : donutSlices.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center text-[12px]" style={{ color: DARK_MUTE }}>No spend data</div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                {/* Donut */}
                <div className="relative flex-shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={donutSlices} cx={75} cy={75} innerRadius={48} outerRadius={72}
                      dataKey="value" paddingAngle={2} strokeWidth={0}>
                      {donutSlices.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  {/* Centre label */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[19px] font-bold leading-none" style={{ color: DARK_INK }}>{fmtINR(totalSpend)}</div>
                    <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: DARK_MUTE }}>TOTAL</div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2.5">
                  {donutSlices.map(s => (
                    <div key={s.name} className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }}/>
                        <span className="text-[11.5px]" style={{ color: DARK_INK }}>{s.name}</span>
                      </div>
                      <span className="text-[12px] font-semibold" style={{ color: DARK_INK }}>{fmtINR(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footnote ──────────────────────────────────────────────────── */}
        <p className="mt-3 text-[10px]" style={{ color: DARK_MUTE }}>
          Reach = creator follower sum. Impressions ≈ reach × 12%. Engagements derived from avgER.
          Clicks ≈ engagements × 8%. All estimates — real tracking data updates when 5th Avenue refreshes post metrics.
        </p>
      </div>
    </div>
  );
}
