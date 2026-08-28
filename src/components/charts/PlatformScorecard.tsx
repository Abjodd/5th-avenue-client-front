import { Lock } from "lucide-react";
import { cx } from "../../lib/cx";

export interface PlatformRow {
  label: string;
  /** Mean measured views per live post. */
  avgViews: number;
  /** Engagement rate, as a percentage. Null when nothing is measured. */
  er: number | null;
  /** Live posts behind the row. */
  live: number;
  color: string;
}

interface PlatformScorecardProps {
  rows: PlatformRow[];
  viewsFormat: (n: number) => string;
  className?: string;
}

/* The call each platform earns, split on this brand's own median so it always
   describes their mix rather than an outside benchmark it might never clear. */
const VERDICTS = {
  "hi-hi": { label: "Double down",     cls: "bg-success-muted text-success" },
  "lo-hi": { label: "Distribute more", cls: "bg-accent-muted text-accent" },
  "hi-lo": { label: "Improve hooks",   cls: "bg-warning-muted text-warning" },
  "lo-lo": { label: "Stop producing",  cls: "bg-danger-muted text-danger" },
} as const;

function median(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * One scorecard per platform: the two numbers that matter, at a size you can
 * read, over a comparison bar and under the call they add up to.
 *
 * The whole card is a comparison — bars ranked against the best platform, and
 * a verdict split on the brand's own median. With a single platform there is
 * nothing to rank it against: both bars sit at 100% of themselves and the
 * verdict is a tautology. So the card is drawn and then locked behind a blur
 * until a second platform goes live, which says what the panel will hold
 * without quoting numbers that only compare a platform to itself.
 */
export function PlatformScorecard({ rows, viewsFormat, className }: PlatformScorecardProps) {
  const locked = rows.length < 2;
  // `|| 1` guards the divide, rather than Math.max(..., 1): a floor of 1
  // inside the max silently became the scale whenever every platform sat
  // below it, which for engagement rate (0.9%, 0.5%) is the normal case —
  // every bar was then drawn against 1% instead of against the best one.
  const peakViews = Math.max(...rows.map((r) => r.avgViews)) || 1;
  const peakEr = Math.max(...rows.map((r) => r.er ?? 0)) || 1;
  const mViews = median(rows.map((r) => r.avgViews));
  const mEr = median(rows.map((r) => r.er ?? 0));

  return (
    <div className={cx("relative", className)}>
      <div
        aria-hidden={locked || undefined}
        className={cx("flex flex-col gap-3", locked && "pointer-events-none select-none blur-[7px]")}
      >
        {rows.map((r) => {
          const verdict = VERDICTS[`${r.avgViews >= mViews ? "hi" : "lo"}-${(r.er ?? 0) >= mEr ? "hi" : "lo"}`];
          return (
            <div key={r.label} className="overflow-hidden rounded-[14px] border border-line bg-well/40 px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">{r.label}</span>
                <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]", verdict.cls)}>
                  {verdict.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-4">
                <Figure value={viewsFormat(r.avgViews)} label="avg views" color={r.color}
                  pct={(r.avgViews / peakViews) * 100} />
                <Figure value={r.er != null ? `${r.er.toFixed(1)}%` : "—"} label="engaged" color={r.color}
                  pct={r.er != null ? (r.er / peakEr) * 100 : null} />
                <Figure value={String(r.live)} label={`live post${r.live === 1 ? "" : "s"}`} color="var(--color-ink)" pct={null} />
              </div>
            </div>
          );
        })}
      </div>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="flex size-9 items-center justify-center rounded-full border border-line bg-[--color-glass-strong] text-mute backdrop-blur-sm">
            <Lock size={15} />
          </span>
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-sub">
            Comparison unlocks with a second platform — only {rows[0]?.label ?? "one platform"} is live, and ranking it
            against itself says nothing.
          </p>
        </div>
      )}
    </div>
  );
}

/** One figure: the number first, its name under it, and — where the figure is
    something to compare — how it measures against the best platform. */
function Figure({ value, label, color, pct }: { value: string; label: string; color: string; pct: number | null }) {
  return (
    <div className="min-w-0">
      <div className="tnum truncate text-[22px] font-bold leading-none tracking-tight" style={{ color }}>{value}</div>
      <div className="mt-1.5 truncate text-[9.5px] font-semibold uppercase tracking-[0.07em] text-mute">{label}</div>
      {pct !== null && (
        <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-well">
          <div className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}
