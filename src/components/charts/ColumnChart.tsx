import { useState } from "react";
import { cx } from "../../lib/cx";

export interface ColumnItem {
  label: string;
  value: number;
  /** Formatted display value (defaults to raw number). */
  display?: string;
  color?: string;
  flag?: "high" | "low" | null;
  /** Secondary line in the hover tooltip. */
  sub?: string;
}

interface ColumnChartProps {
  items: ColumnItem[];
  /** Optional average marker line. */
  avg?: number;
  avgLabel?: string;
  max?: number;
  height?: number;
  className?: string;
}

/** Vertical/column bars with direct value labels, 4px-rounded tops anchored to
    the baseline, a 2px gap between columns, an optional avg line and per-column
    hover tooltip. Companion to the horizontal BarList. */
export function ColumnChart({ items, avg, avgLabel = "avg", max, height = 176, className }: ColumnChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={cx("relative", className)}>
      <div className="relative flex items-end gap-2 px-1" style={{ height }}>
        {avg !== undefined && peak > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink-3/50"
            style={{ bottom: `${Math.min((avg / peak) * 100, 100)}%` }}
          >
            <span className="absolute -top-3.5 right-0 bg-card px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
              {avgLabel}
            </span>
          </div>
        )}
        {items.map((it, i) => {
          const h = peak > 0 ? Math.max((it.value / peak) * 100, 1.5) : 1.5;
          return (
            <div
              key={it.label}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="tnum mb-1 flex items-center gap-1 text-caption font-medium text-ink">
                {it.display ?? it.value}
                {it.flag && (
                  <span className={cx("text-[9px]", it.flag === "high" ? "text-success" : "text-warning")}>
                    {it.flag === "high" ? "▲" : "▼"}
                  </span>
                )}
              </span>
              <div
                className="w-full max-w-[52px] rounded-t-[4px] transition-[height,opacity] duration-500 ease-out"
                style={{
                  height: `${h}%`,
                  background: it.color ?? "var(--accent)",
                  opacity: hover === null || hover === i ? 1 : 0.5,
                }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-md border border-line bg-modal px-2 py-1 text-caption shadow-pop">
                  <span className="text-ink">{it.label}</span>
                  {it.sub && <span className="ml-1.5 text-ink-3">{it.sub}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 px-1">
        {items.map((it) => (
          <div key={it.label} className="min-w-0 flex-1 truncate text-center text-caption text-ink-3" title={it.label}>
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}
