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
 * The figures lead rather than the bars. A pair of bars alone said only
 * "bigger than the other one" — and with a single platform, which is where
 * most brands start, both sat at 100% of themselves and said nothing at all.
 * Here one platform still reports two legible numbers; the bars and the
 * verdict appear once there is a second platform to compare against.
 */
export function PlatformScorecard({ rows, viewsFormat, className }: PlatformScorecardProps) {
  const compare = rows.length > 1;
  const peakViews = Math.max(...rows.map((r) => r.avgViews), 1);
  const peakEr = Math.max(...rows.map((r) => r.er ?? 0), 1);
  const mViews = compare ? median(rows.map((r) => r.avgViews)) : 0;
  const mEr = compare ? median(rows.map((r) => r.er ?? 0)) : 0;

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {rows.map((r) => {
        const verdict = compare
          ? VERDICTS[`${r.avgViews >= mViews ? "hi" : "lo"}-${(r.er ?? 0) >= mEr ? "hi" : "lo"}`]
          : null;
        return (
          <div key={r.label} className="relative overflow-hidden rounded-[14px] border border-line bg-well/40 py-3.5 pl-5 pr-4">
            {/* Colour spine — the platform's identity without a legend. */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: r.color }} />

            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">{r.label}</span>
              {verdict && (
                <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]", verdict.cls)}>
                  {verdict.label}
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure value={viewsFormat(r.avgViews)} label="avg views" color={r.color}
                pct={compare ? (r.avgViews / peakViews) * 100 : null} />
              <Figure value={r.er != null ? `${r.er.toFixed(1)}%` : "—"} label="engaged" color={r.color}
                pct={compare && r.er != null ? (r.er / peakEr) * 100 : null} />
              <Figure value={String(r.live)} label={`live post${r.live === 1 ? "" : "s"}`} color="var(--color-ink)" pct={null} />
            </div>
          </div>
        );
      })}

      {!compare && (
        <p className="text-[10.5px] text-mute">
          Only one platform is live, so there is nothing to rank it against yet.
        </p>
      )}
    </div>
  );
}

/** One figure: the number first, its name under it, and — only when there is
    another platform to compare with — how it measures against the best. */
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
