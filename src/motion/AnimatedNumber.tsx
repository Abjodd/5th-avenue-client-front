import { useEffect, useRef } from "react";
import { gsap } from "./gsap";
import { DUR, EASE } from "./tokens";
import { prefersReducedMotion } from "./reducedMotion";

interface AnimatedNumberProps {
  value: number;
  /** Formats the tweened value for display (e.g. fmtNum, fmtL). */
  format?: (n: number) => string;
  /** Snap increment for the internal tween (default: integers). */
  snap?: number;
  duration?: number;
  /** Easing curve for the roll (default: emphasised expo.out). */
  ease?: string;
  className?: string;
}

/** Numbers never pop — they roll. Re-tweens whenever `value` changes,
    so a filter change makes every stat on the page roll to its new value. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  snap = 1,
  duration = DUR.lg,
  ease = EASE.emph,
  className,
}: AnimatedNumberProps) {
  const el = useRef<HTMLSpanElement>(null);
  const proxy = useRef({ v: value });
  const first = useRef(true);

  useEffect(() => {
    const span = el.current;
    if (!span) return;

    if (prefersReducedMotion()) {
      proxy.current.v = value;
      span.textContent = format(value);
      return;
    }

    // First paint: roll up from 0 only if the element starts visible.
    const from = first.current ? 0 : proxy.current.v;
    first.current = false;
    proxy.current.v = from;

    const tween = gsap.to(proxy.current, {
      v: value,
      duration,
      ease,
      snap: { v: snap },
      onUpdate: () => {
        span.textContent = format(proxy.current.v);
      },
    });
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={el} className={`tnum ${className ?? ""}`}>
      {format(value)}
    </span>
  );
}
