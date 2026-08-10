import { cx } from "../../lib/cx";

export interface BarItem {
  label: string;
  value: number;
  /** Formatted display value (defaults to the raw number). */
  display?: string;
  color?: string;
  /** Flags an outlier — draws a subtle marker + tint. */
  flag?: "high" | "low" | null;
  sub?: string;
}

interface BarListProps {
  items: BarItem[];
  /** Optional average marker line across all bars. */
  avg?: number;
  max?: number;
  className?: string;
}

/** Ranked horizontal bars with direct labels. Data-ends are 4px-rounded and
    anchored to the baseline; optional avg marker + outlier flags. */
export function BarList({ items, avg, max, className }: BarListProps) {
  const peak = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={cx("flex flex-col gap-2.5", className)}>
      {items.map((it) => {
        const pct = (it.value / peak) * 100;
        const avgPct = avg !== undefined ? (avg / peak) * 100 : null;
        return (
          <div key={it.label} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-caption text-ink-2">
                {it.label}
                {it.flag && (
                  <span
                    className={cx(
                      "rounded-sm px-1 font-mono text-[9px] uppercase",
                      it.flag === "high" ? "bg-success-muted text-success" : "bg-warning-muted text-warning",
                    )}
                  >
                    {it.flag === "high" ? "↑ outlier" : "↓ outlier"}
                  </span>
                )}
              </span>
              <span className="tnum text-caption font-medium text-ink">
                {it.display ?? it.value}
                {it.sub && <span className="ml-1 text-ink-3">{it.sub}</span>}
              </span>
            </div>
            <div className="relative h-2 overflow-visible rounded-full bg-well">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%`, background: it.color ?? "var(--accent)" }}
              />
              {avgPct !== null && (
                <span
                  className="absolute top-[-2px] h-3 w-[1.5px] bg-ink-3/60"
                  style={{ left: `${avgPct}%` }}
                  title="segment average"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
