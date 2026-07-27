import { useId, useRef, useState } from "react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { prefersReducedMotion } from "../../motion/reducedMotion";

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
  format?: (n: number) => string;
}

interface LineChartProps {
  labels: string[];
  /** Primary series — hero area+line. */
  primary: LineSeries;
  /** Optional companion series drawn as a stacked mini-panel below
      (small multiples — never a second y-axis on the same plot). */
  secondary?: LineSeries;
  height?: number;
}

const PAD = { t: 12, r: 14, b: 22, l: 44 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function Panel({
  series,
  labels,
  w,
  h,
  showX,
  animate,
}: {
  series: LineSeries;
  labels: string[];
  w: number;
  h: number;
  showX: boolean;
  animate: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotW = w - PAD.l - PAD.r;
  const plotH = h - PAD.t - PAD.b;
  const max = niceMax(Math.max(...series.values));
  const step = plotW / (series.values.length - 1 || 1);
  const fmt = series.format ?? ((n) => n.toString());

  const x = (i: number) => PAD.l + i * step;
  const y = (v: number) => PAD.t + plotH - (v / max) * plotH;
  const pts = series.values.map((v, i) => [x(i), y(v)]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.values.length - 1)},${PAD.t + plotH} L${PAD.l},${PAD.t + plotH} Z`;

  useGSAP(
    () => {
      if (!animate || !lineRef.current || prefersReducedMotion()) return;
      const len = lineRef.current.getTotalLength();
      gsap.fromTo(
        lineRef.current,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: DUR.xl, ease: EASE.out,
          scrollTrigger: { trigger: lineRef.current, start: "top 90%", once: true } },
      );
    },
    { dependencies: [line], scope: lineRef },
  );

  const ticks = [0, 0.5, 1].map((f) => f * max);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const i = Math.round((px - PAD.l) / step);
        setHover(Math.max(0, Math.min(series.values.length - 1, i)));
      }}
    >
      <defs>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series.color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={series.color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end" className="fill-[var(--text-3)] font-mono" fontSize={9}>
            {fmt(t)}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#fill-${uid})`} />
      <path ref={lineRef} d={line} fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {showX &&
        labels.map((lb, i) => (
          <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-[var(--text-3)] font-mono" fontSize={9}>
            {lb}
          </text>
        ))}

      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--border-strong)" strokeWidth={1} />
          <circle cx={x(hover)} cy={y(series.values[hover])} r={4} fill="var(--surface)" stroke={series.color} strokeWidth={2} />
          <g transform={`translate(${Math.min(x(hover) + 8, w - 78)}, ${PAD.t + 4})`}>
            <rect width={70} height={30} rx={6} fill="var(--modal-bg)" stroke="var(--border)" />
            <text x={8} y={12} className="fill-[var(--text-3)] font-mono" fontSize={8}>{labels[hover]}</text>
            <text x={8} y={24} className="fill-[var(--text)]" fontSize={11} fontWeight={600}>{fmt(series.values[hover])}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

/** Single-axis area+line chart. When a secondary series is supplied it is
    shown as a separate stacked companion panel (small multiples). */
export function LineChart({ labels, primary, secondary, height = 200 }: LineChartProps) {
  const w = 620;
  if (!secondary) {
    return (
      <div>
        <Legend series={[primary]} />
        <Panel series={primary} labels={labels} w={w} h={height} showX animate />
      </div>
    );
  }
  const topH = Math.round(height * 0.62);
  const botH = height - topH;
  return (
    <div>
      <Legend series={[primary, secondary]} />
      <Panel series={primary} labels={labels} w={w} h={topH} showX={false} animate />
      <Panel series={secondary} labels={labels} w={w} h={botH + 8} showX animate />
    </div>
  );
}

function Legend({ series }: { series: LineSeries[] }) {
  return (
    <div className="mb-2 flex items-center gap-4">
      {series.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          <span className="text-caption text-ink-2">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
