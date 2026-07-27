import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  spark?: ReactNode;
  className?: string;
}

/** KPI tile: mono eyebrow label, big tabular value, optional delta + sparkline. */
export function StatCard({ label, value, hint, delta, spark, className }: StatCardProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-lg border border-line bg-card p-5 shadow-card",
        className,
      )}
      data-reveal
    >
      <span className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <span className="tnum text-kpi font-semibold text-ink">{value}</span>
        {spark && <div className="mb-1 h-8 w-20 shrink-0">{spark}</div>}
      </div>
      {(delta || hint) && (
        <div className="flex items-center gap-2">
          {delta && (
            <span
              className={cx(
                "tnum text-caption font-medium",
                delta.direction === "up" && "text-success",
                delta.direction === "down" && "text-danger",
                delta.direction === "flat" && "text-ink-3",
              )}
            >
              {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "—"}{" "}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-caption text-ink-3">{hint}</span>}
        </div>
      )}
    </div>
  );
}
