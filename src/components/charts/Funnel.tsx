export interface FunnelStage {
  stage: string;
  value: number;
  display: string;
  color: string;
}

/** Horizontal funnel — each band's width is proportional to its value;
    conversion % between consecutive stages is labeled between bands.
    Labels sit outside the band (always readable in both themes). */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const peak = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="flex flex-col gap-1">
      {stages.map((s, i) => {
        const pct = (s.value / peak) * 100;
        const conv =
          i > 0 && stages[i - 1].value > 0
            ? (s.value / stages[i - 1].value) * 100
            : null;
        return (
          <div key={s.stage}>
            {conv !== null && (
              <div className="flex items-center gap-2 py-1 pl-1">
                <span className="tnum font-mono text-[10px] text-ink-3">↓ {conv.toFixed(1)}%</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-caption text-ink-2">{s.stage}</div>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-well">
                <div
                  className="h-full rounded-md transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(pct, 4)}%`, background: s.color }}
                />
              </div>
              <span className="tnum w-16 shrink-0 text-right text-caption font-semibold text-ink">
                {s.display}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
