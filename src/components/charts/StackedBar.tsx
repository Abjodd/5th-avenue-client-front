export interface StackSegment {
  label: string;
  value: number;
  color: string;
  display?: string;
}

interface StackedBarProps {
  segments: StackSegment[];
  height?: number;
  showLegend?: boolean;
}

/** Single horizontal stacked bar with a 2px surface gap between segments
    and a labeled legend. */
export function StackedBar({ segments, height = 12, showLegend = true }: StackedBarProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full bg-well"
        style={{ height, gap: 2 }}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.display ?? s.value}`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
              <span className="text-caption text-ink-2">{s.label}</span>
              <span className="tnum text-caption text-ink-3">{s.display ?? s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
