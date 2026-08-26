import { AnimatedNumber } from "../../../motion/AnimatedNumber";
import { Sparkline } from "../../../components/charts/Sparkline";
import { DonutChart } from "../../../components/charts/DonutChart";
import { fmtNum } from "../../../lib/format";

const MINI_KANBAN = [
  { name: "Diwali Festive Push", tone: "var(--viz-blue)", phase: "Production" },
  { name: "Snack Box — Paid Ads", tone: "var(--viz-pink)", phase: "Live" },
  { name: "Micro Wave", tone: "var(--viz-green)", phase: "Completed" },
];

/** A real, non-interactive miniature of the portal — built from the same
    primitives so it stays pixel-consistent with the product. Decorative. */
export function HeroDashboard() {
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none rounded-xl border border-line bg-surface shadow-modal"
      data-hero-frame
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <div className="ml-3 flex h-5 flex-1 items-center rounded-md bg-input px-2 font-mono text-[10px] text-ink-3">
          app.Fifthavenue.agency/portal/overview
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4" data-hero-widgets>
        {/* KPI row */}
        <div className="col-span-3 grid grid-cols-3 gap-3">
          {[
            { label: "Reach", value: 26.5e6, fmt: fmtNum, snap: 1000, spark: [4, 6, 5, 9, 8, 14, 26] },
            { label: "Avg ER", value: 5.2, fmt: (n: number) => `${n.toFixed(1)}%`, snap: 0.1, spark: [4.1, 4.8, 5.1, 5.0, 5.4, 5.2] },
            { label: "Spend", value: 48.5, fmt: (n: number) => `₹${n.toFixed(1)}L`, snap: 0.1, spark: [28, 35, 42, 48, 56, 48.5] },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-line bg-card p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">{k.label}</p>
              <p className="tnum mt-1 text-lg font-semibold text-ink">
                <AnimatedNumber value={k.value} format={k.fmt} snap={k.snap} />
              </p>
              <div className="mt-1 h-6 w-full overflow-hidden">
                <Sparkline data={k.spark} width={120} height={24} className="h-full w-full" />
              </div>
            </div>
          ))}
        </div>

        {/* mini kanban */}
        <div className="col-span-2 rounded-lg border border-line bg-card p-3">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">Active campaigns</p>
          <div className="flex flex-col gap-1.5">
            {MINI_KANBAN.map((c) => (
              <div key={c.name} className="flex items-center gap-2 rounded-md bg-hover px-2 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.tone }} />
                <span className="flex-1 truncate text-[11px] text-ink">{c.name}</span>
                <span className="text-[9px] text-ink-3">{c.phase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* donut */}
        <div className="rounded-lg border border-line bg-card p-3">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">Spend</p>
          <div className="scale-90">
            <DonutChart
              size={78}
              thickness={11}
              centerValue=""
              data={[
                { label: "IM", value: 30, color: "var(--viz-blue)" },
                { label: "AEO", value: 12, color: "var(--viz-green)" },
                { label: "Ads", value: 6.5, color: "var(--viz-pink)" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
