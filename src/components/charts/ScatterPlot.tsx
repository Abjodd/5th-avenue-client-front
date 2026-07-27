import { useState } from "react";

export interface ScatterPoint {
  id: string | number;
  x: number;
  y: number;
  /** Encoded as circle AREA (√ mapped to radius). */
  size: number;
  color: string;
  label: string;
  meta?: string;
}

interface ScatterPlotProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFormat?: (n: number) => string;
  yFormat?: (n: number) => string;
  /** Corner captions: [topLeft, topRight, bottomLeft, bottomRight]. */
  quadrantLabels?: [string, string, string, string];
  height?: number;
  /** Radius range for area-encoding (min..max). Small values → dense/refined. */
  minR?: number;
  maxR?: number;
  ring?: number;
}

const PAD = { t: 16, r: 16, b: 34, l: 46 };
const W = 620;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}
function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** X×Y scatter with area-encoded points and median quadrant guides — for
    "which content to double down on". One axis each; hover per point. */
export function ScatterPlot({
  points, xLabel, yLabel, xFormat = (n) => `${n}`, yFormat = (n) => `${n}`,
  quadrantLabels, height = 300, minR = 4, maxR = 17, ring = 2,
}: ScatterPlotProps) {
  const [hover, setHover] = useState<string | number | null>(null);

  const plotW = W - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;
  const xMax = niceMax(Math.max(...points.map((p) => p.x), 1));
  const yMax = niceMax(Math.max(...points.map((p) => p.y), 1));
  const mX = median(points.map((p) => p.x));
  const mY = median(points.map((p) => p.y));
  const sizeMax = Math.max(...points.map((p) => p.size), 1);

  const px = (x: number) => PAD.l + (x / xMax) * plotW;
  const py = (y: number) => PAD.t + plotH - (y / yMax) * plotH;
  const pr = (s: number) => minR + Math.sqrt(s / sizeMax) * (maxR - minR);

  const hovered = points.find((p) => p.id === hover);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" onMouseLeave={() => setHover(null)}>
      {/* frame */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--border)" strokeWidth={1} />
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="var(--border)" strokeWidth={1} />

      {/* median quadrant guides */}
      <line x1={px(mX)} x2={px(mX)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 4" />
      <line x1={PAD.l} x2={W - PAD.r} y1={py(mY)} y2={py(mY)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 4" />

      {/* quadrant captions */}
      {quadrantLabels && (
        <g className="fill-[var(--text-3)] font-mono" fontSize={9}>
          <text x={PAD.l + 6} y={PAD.t + 12}>{quadrantLabels[0]}</text>
          <text x={W - PAD.r - 6} y={PAD.t + 12} textAnchor="end">{quadrantLabels[1]}</text>
          <text x={PAD.l + 6} y={PAD.t + plotH - 6}>{quadrantLabels[2]}</text>
          <text x={W - PAD.r - 6} y={PAD.t + plotH - 6} textAnchor="end">{quadrantLabels[3]}</text>
        </g>
      )}

      {/* axis labels */}
      <text x={PAD.l + plotW / 2} y={height - 6} textAnchor="middle" className="fill-[var(--text-3)] font-mono" fontSize={9}>
        {xLabel} →
      </text>
      <text transform={`translate(11, ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" className="fill-[var(--text-3)] font-mono" fontSize={9}>
        {yLabel} →
      </text>
      {/* axis extents */}
      <text x={PAD.l - 6} y={py(yMax) + 3} textAnchor="end" className="fill-[var(--text-3)] font-mono" fontSize={8}>{yFormat(yMax)}</text>
      <text x={PAD.l - 6} y={PAD.t + plotH + 3} textAnchor="end" className="fill-[var(--text-3)] font-mono" fontSize={8}>0</text>
      <text x={W - PAD.r} y={PAD.t + plotH + 14} textAnchor="end" className="fill-[var(--text-3)] font-mono" fontSize={8}>{xFormat(xMax)}</text>

      {/* points */}
      {points.map((p) => {
        const on = hover === p.id;
        return (
          <circle
            key={p.id}
            cx={px(p.x)}
            cy={py(p.y)}
            r={pr(p.size) + (on ? 2 : 0)}
            fill={p.color}
            fillOpacity={hover === null ? 0.72 : on ? 0.95 : 0.32}
            stroke="var(--surface)"
            strokeWidth={ring}
            onMouseEnter={() => setHover(p.id)}
            style={{ transition: "r 0.12s ease, fill-opacity 0.12s ease", cursor: "pointer" }}
          />
        );
      })}

      {/* tooltip */}
      {hovered && (
        <g transform={`translate(${Math.min(px(hovered.x) + 10, W - 150)}, ${Math.max(py(hovered.y) - 34, PAD.t)})`} pointerEvents="none">
          <rect width={144} height={40} rx={6} fill="var(--modal-bg)" stroke="var(--border)" />
          <circle cx={11} cy={13} r={4} fill={hovered.color} />
          <text x={21} y={16} className="fill-[var(--text)]" fontSize={11} fontWeight={600}>{hovered.label}</text>
          <text x={11} y={31} className="fill-[var(--text-2)] font-mono" fontSize={9}>
            {yFormat(hovered.y)} · {xFormat(hovered.x)}{hovered.meta ? ` · ${hovered.meta}` : ""}
          </text>
        </g>
      )}
    </svg>
  );
}
