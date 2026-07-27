import { useEffect, useState } from "react";
import { cx } from "../../lib/cx";
import { prefersReducedMotion } from "../../motion/reducedMotion";

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  color?: string;
  /** Optional second stop → the arc becomes a subtle gradient. */
  colorTo?: string;
  showLabel?: boolean;
  /** Draw the arc from 0 on mount (default true). */
  animate?: boolean;
  /** Draw the faint background track behind the arc (default true). */
  track?: boolean;
  /** Arc end shape (default "round"). */
  linecap?: "round" | "butt";
  className?: string;
}

export function ProgressRing({
  value,
  size = 40,
  stroke = 3,
  color = "var(--accent)",
  colorTo,
  showLabel = true,
  animate = true,
  track = true,
  linecap = "round",
  className,
}: ProgressRingProps) {
  const target = Math.min(100, Math.max(0, value));
  const [shown, setShown] = useState(animate && !prefersReducedMotion() ? 0 : target);
  useEffect(() => {
    if (!animate || prefersReducedMotion()) { setShown(target); return; }
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target, animate]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - shown / 100);
  const uid = `ring-${Math.round(size)}-${color.replace(/\W/g, "")}`;
  return (
    <div className={cx("relative inline-flex", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {colorTo && (
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={colorTo} />
            </linearGradient>
          </defs>
        )}
        {track && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorTo ? `url(#${uid})` : color}
          strokeWidth={stroke}
          strokeLinecap={linecap}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      {showLabel && (
        <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink-2">
          {Math.round(value)}
        </span>
      )}
    </div>
  );
}
