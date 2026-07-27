import { useRef, useState } from "react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { prefersReducedMotion } from "../../motion/reducedMotion";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

/** SVG-arc donut (not conic-gradient) with a 2px surface gap between
    slices and a sweep-in on entry. */
export function DonutChart({
  data,
  size = 150,
  thickness = 18,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const ref = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = 2; // px surface gap between slices

  let offset = 0;
  const arcs = data.map((d) => {
    const frac = d.value / total;
    const len = frac * c;
    const seg = { ...d, dash: Math.max(0, len - gap), gapRest: c - Math.max(0, len - gap), offset };
    offset -= len;
    return seg;
  });

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      // Animate on mount (not scroll-gated) so the donut always renders even
      // when it starts below the fold.
      gsap.from(ref.current, {
        rotation: -18,
        opacity: 0,
        transformOrigin: "center",
        duration: DUR.lg,
        ease: EASE.out,
      });
    },
    { scope: ref },
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g ref={ref} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map((a, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={hover === i ? thickness + 3 : thickness}
                strokeDasharray={`${a.dash} ${a.gapRest}`}
                strokeDashoffset={a.offset}
                className="transition-[stroke-width] duration-150"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="tnum text-title font-semibold text-ink">{centerValue}</span>}
            {centerLabel && <span className="mt-0.5 text-caption text-ink-3">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: d.color }} />
            <span className="text-caption text-ink-2">{d.label}</span>
            <span className="tnum text-caption text-ink-3">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
