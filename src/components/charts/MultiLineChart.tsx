import { useState } from "react";

export interface MultiSeries {
  label: string;
  color: string;
  values: number[];
  /** tooltip formatter for this series */
  format?: (n: number) => string;
}

interface MultiLineChartProps {
  labels: string[];
  series: MultiSeries[];
  /** y-axis tick formatter (shared axis) */
  yFormat?: (n: number) => string;
  height?: number;
  /** caption under the plot, e.g. "indexed to 100" */
  note?: string;
}

const PAD = { t: 14, r: 16, b: 24, l: 46 };
const W = 620;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** Several series overlaid on ONE shared y-axis (e.g. indexed-to-100). The
    honest alternative to a dual-axis chart. Crosshair hover reads all series. */
export function MultiLineChart({ labels, series, yFormat = (n) => `${n}`, height = 230, note }: MultiLineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const n = labels.length;
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const yMin = Math.min(0, ...series.flatMap((s) => s.values));
  const span = yMax - yMin || 1;

  const x = (i: number) => PAD.l + (i / (n - 1 || 1)) * plotW;
  const y = (v: number) => PAD.t + plotH - ((v - yMin) / span) * plotH;
  const ticks = [0, 0.5, 1].map((f) => yMin + f * span);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-caption text-ink-2">{s.label}</span>
          </div>
        ))}
        {note && <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">{note}</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const p = ((e.clientX - rect.left) / rect.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round((p - PAD.l) / (plotW / (n - 1 || 1))))));
        }}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" className="fill-[var(--text-3)] font-mono" fontSize={9}>{yFormat(t)}</text>
          </g>
        ))}

        {labels.map((lb, i) => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--text-3)] font-mono" fontSize={9}>{lb}</text>
        ))}

        {series.map((s) => {
          const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return <path key={s.label} d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
        })}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--border-strong)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.label} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
            ))}
            <g transform={`translate(${Math.min(x(hover) + 8, W - 116)}, ${PAD.t + 2})`}>
              <rect width={108} height={16 + series.length * 13} rx={6} fill="var(--modal-bg)" stroke="var(--border)" />
              <text x={8} y={12} className="fill-[var(--text-3)] font-mono" fontSize={8}>{labels[hover]}</text>
              {series.map((s, i) => (
                <text key={s.label} x={8} y={26 + i * 13} fontSize={9}>
                  <tspan className="fill-[var(--text-2)]">{s.label}: </tspan>
                  <tspan className="fill-[var(--text)]" fontWeight={600}>{(s.format ?? yFormat)(s.values[hover])}</tspan>
                </text>
              ))}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
