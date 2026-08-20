import { useId, useLayoutEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { prefersReducedMotion } from "../../motion/reducedMotion";

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
  format?: (n: number) => string;
}

/** What a caller wires up to drive or read the chart's cursor. Shared with the
    inner Panel so the two can't drift apart. */
interface Interaction {
  /** Fit the y-axis to the data instead of anchoring it at zero. For a
      CUMULATIVE series this is the difference between a chart and a flat line:
      9.2M of views that grew from 8.5M occupies 7% of a zero-based axis. Only
      honoured when the series really does sit far from zero — see scaleFor. */
  fit?: boolean;
  /** Index the parent wants highlighted (its own selection). */
  activeIndex?: number | null;
  /** Cursor moved to a point, or off the plot (null). */
  onHover?: (index: number | null) => void;
  /** A point was clicked — the parent decides what pinning means. */
  onSelect?: (index: number) => void;
}

interface LineChartProps extends Interaction {
  labels: string[];
  /** Primary series — hero area+line. */
  primary: LineSeries;
  /** Optional companion series drawn as a stacked mini-panel below
      (small multiples — never a second y-axis on the same plot). */
  secondary?: LineSeries;
  height?: number;
  /** Most x-axis labels to draw. Long series (the growth curve keeps up to 240
      daily points) would otherwise overlap into an unreadable smear. Thinning
      happens here rather than in the caller because `labels` also feeds the
      hover tooltip — a caller that blanked entries to thin the axis would
      leave the tooltip with no date to show. */
  maxTicks?: number;
}

const PAD = { t: 12, r: 14, b: 22, l: 46 };

/** Evenly spaced label indices, always including the first and the last. */
function tickIndices(count: number, maxTicks: number) {
  if (count <= maxTicks) return null; // null = draw them all
  return new Set(
    Array.from({ length: maxTicks }, (_, i) => Math.round((i * (count - 1)) / (maxTicks - 1))),
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * The y-window. Zero-based by default — for counts per bucket that is the
 * honest baseline. `fit` opts a series out, but only when zero is nowhere near
 * the data (the band it moves in is under a third of its own height); a series
 * that genuinely runs down to zero keeps the zero.
 */
function scaleFor(values: number[], fit: boolean) {
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  if (!fit || lo <= 0 || (hi - lo) / hi > 0.35) return { min: 0, max: niceMax(hi) };
  const pad = (hi - lo) * 0.4 || hi * 0.04;
  return { min: Math.max(0, lo - pad), max: hi + pad };
}

/**
 * The element's own width in CSS pixels.
 *
 * The viewBox was a fixed 620 while the svg rendered `w-full`, so in a
 * full-width panel the browser scaled the whole drawing ~2×: 9px axis type
 * came out at 19px, a 70px tooltip at 145px, and `height={230}` at 480px tall.
 * Measuring means one user unit is one pixel at any width, so type and spacing
 * stay the size they were designed at.
 */
function useWidth(fallback = 620) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };
    // Measured once here and then observed. The direct read matters: a
    // ResizeObserver only delivers during the rendering steps, which a
    // background tab never runs — a chart first mounted out of view would sit
    // at the fallback width until the tab was focused.
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Panel({
  series,
  labels,
  w,
  h,
  showX,
  animate,
  maxTicks,
  fit = false,
  activeIndex = null,
  onHover,
  onSelect,
}: Interaction & {
  series: LineSeries;
  labels: string[];
  w: number;
  h: number;
  showX: boolean;
  animate: boolean;
  maxTicks: number;
}) {
  const uid = useId().replace(/:/g, "");
  const lineRef = useRef<SVGPathElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotW = w - PAD.l - PAD.r;
  const plotH = h - PAD.t - PAD.b;
  const { min, max } = scaleFor(series.values, fit);
  const span = max - min || 1;
  const step = plotW / (series.values.length - 1 || 1);
  const fmt = series.format ?? ((n) => n.toString());

  const x = (i: number) => PAD.l + i * step;
  const y = (v: number) => PAD.t + plotH - ((v - min) / span) * plotH;
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

  const ticks = [0, 0.5, 1].map((f) => min + f * span);
  // null when every label fits — see tickIndices.
  const xTicks = tickIndices(labels.length, maxTicks);
  // The cursor wins while it is on the plot; otherwise the parent's selection.
  const marked = hover ?? activeIndex;

  const indexAt = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * w;
    const i = Math.round((px - PAD.l) / step);
    return Math.max(0, Math.min(series.values.length - 1, i));
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="max-w-full"
      onMouseLeave={() => { setHover(null); onHover?.(null); }}
      onMouseMove={(e) => {
        const i = indexAt(e.clientX, e.currentTarget);
        setHover(i);
        onHover?.(i);
      }}
      onClick={(e) => onSelect?.(indexAt(e.clientX, e.currentTarget))}
      style={{ cursor: onSelect ? "pointer" : undefined }}
    >
      <defs>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series.color} stopOpacity="0.16" />
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
        labels.map((lb, i) =>
          xTicks && !xTicks.has(i) ? null : (
            <text
              key={i}
              x={x(i)}
              y={h - 6}
              // The end labels anchor to their own edge: centred, the last date
              // hung half outside the viewBox and rendered clipped.
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
              className="fill-[var(--text-3)] font-mono"
              fontSize={9}
            >
              {lb}
            </text>
          ),
        )}

      {marked !== null && marked >= 0 && (
        <g className="pointer-events-none">
          <line x1={x(marked)} x2={x(marked)} y1={PAD.t} y2={PAD.t + plotH} stroke="var(--border-strong)" strokeWidth={1} />
          <circle cx={x(marked)} cy={y(series.values[marked])} r={4} fill="var(--surface)" stroke={series.color} strokeWidth={2} />
          {/* Only the cursor gets a tooltip. A parent-driven selection is
              already spelled out wherever the parent is showing it. */}
          {hover !== null && (
            <g transform={`translate(${Math.min(x(hover) + 8, w - 82)}, ${PAD.t + 4})`}>
              <rect width={74} height={32} rx={6} fill="var(--modal-bg)" stroke="var(--border)" />
              <text x={8} y={13} className="fill-[var(--text-3)] font-mono" fontSize={8}>{labels[hover]}</text>
              <text x={8} y={25} className="fill-[var(--text)]" fontSize={11} fontWeight={600}>{fmt(series.values[hover])}</text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/** Single-axis area+line chart. When a secondary series is supplied it is
    shown as a separate stacked companion panel (small multiples). */
export function LineChart({
  labels, primary, secondary, height = 200, maxTicks = 8,
  fit, activeIndex, onHover, onSelect,
}: LineChartProps) {
  const [ref, w] = useWidth();
  const shared = { fit, activeIndex, onHover, onSelect };

  if (!secondary) {
    return (
      <div ref={ref}>
        <Legend series={[primary]} />
        <Panel series={primary} labels={labels} w={w} h={height} showX animate maxTicks={maxTicks} {...shared} />
      </div>
    );
  }
  const topH = Math.round(height * 0.62);
  const botH = height - topH;
  return (
    <div ref={ref}>
      <Legend series={[primary, secondary]} />
      <Panel series={primary} labels={labels} w={w} h={topH} showX={false} animate maxTicks={maxTicks} {...shared} />
      <Panel series={secondary} labels={labels} w={w} h={botH + 8} showX animate maxTicks={maxTicks} {...shared} />
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
