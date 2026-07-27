import type { TourStep } from "../../../lib/marketing/data/landing-copy";
import { Sparkline } from "../../../components/charts/Sparkline";
import { IndiaMap } from "../../../components/map/IndiaMap";
import { REGION_COLORS, STATES_META } from "../../../lib/marketing/data/map-data";

const box = "rounded-lg border border-line bg-card p-3";

/** Small stylized mock of each dashboard surface for the tour's right panel. */
export function TourScene({ scene }: { scene: TourStep["scene"] }) {
  switch (scene) {
    case "kanban":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[
            { t: "Brief", n: 1, c: "var(--viz-blue)" },
            { t: "Production", n: 2, c: "var(--viz-purple)" },
            { t: "Live", n: 1, c: "var(--viz-green)" },
          ].map((col) => (
            <div key={col.t} className="rounded-lg border border-line bg-card p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">{col.t}</span>
                <span className="tnum text-[9px] text-ink-3">{col.n}</span>
              </div>
              {Array.from({ length: col.n }).map((_, i) => (
                <div key={i} className="mb-1.5 rounded-md bg-hover p-2">
                  <span className="mb-1 block h-1 w-8 rounded-full" style={{ background: col.c }} />
                  <span className="block h-1.5 w-full rounded-full bg-line-strong" />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case "analytics":
      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {["26.5M", "5.2%", "₹48.5L"].map((v) => (
              <div key={v} className={box}>
                <span className="font-mono text-[8px] uppercase tracking-wide text-ink-3">metric</span>
                <p className="tnum text-sm font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className={box}>
            <Sparkline data={[4, 6, 5, 9, 8, 13, 26]} width={360} height={54} className="h-auto w-full" />
          </div>
        </div>
      );
    case "goals":
      return (
        <div className="flex flex-col gap-2">
          {[
            { n: "Festive Revenue Push", pct: 68, wings: ["IM", "Ads"], c: "var(--viz-blue)" },
            { n: "North Expansion", pct: 34, wings: ["IM", "Web"], c: "var(--viz-pink)" },
            { n: "Always-on Salience", pct: 52, wings: ["AEO", "SMM"], c: "var(--viz-green)" },
          ].map((g) => (
            <div key={g.n} className={box}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink">{g.n}</span>
                <div className="flex gap-1">
                  {g.wings.map((w) => (
                    <span key={w} className="rounded-sm bg-hover px-1 font-mono text-[8px] text-ink-2">{w}</span>
                  ))}
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-input">
                <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: g.c }} />
              </div>
            </div>
          ))}
        </div>
      );
    case "map":
      return (
        <div className={box}>
          <IndiaMap
            colorFor={(id) => {
              const r = STATES_META[id]?.region;
              return r ? REGION_COLORS[r] : "var(--hover)";
            }}
            className="mx-auto max-h-72"
          />
        </div>
      );
    case "billing":
      return (
        <div className="flex flex-col gap-2">
          {[
            { l: "Monthly Retainer — April", s: "Pending", tone: "text-warning" },
            { l: "Diwali Boosting Top-up", s: "Autopay", tone: "text-accent" },
            { l: "Creator Fees — Batch 1", s: "Paid", tone: "text-success" },
          ].map((r) => (
            <div key={r.l} className={`${box} flex items-center justify-between`}>
              <span className="text-[11px] text-ink">{r.l}</span>
              <span className={`font-mono text-[9px] uppercase ${r.tone}`}>{r.s}</span>
            </div>
          ))}
        </div>
      );
    case "roadmap":
      return (
        <div className="flex flex-col gap-2">
          {["Market Intelligence", "Market Planning"].map((t) => (
            <div key={t} className={`${box} flex items-center justify-between`}>
              <div>
                <p className="text-[11px] font-medium text-ink">{t}</p>
                <p className="text-[9px] text-ink-3">AI + expert insights</p>
              </div>
              <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-ink-3">
                Soon
              </span>
            </div>
          ))}
        </div>
      );
  }
}
