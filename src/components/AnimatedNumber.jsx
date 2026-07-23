// src/components/AnimatedNumber.jsx — rAF count-up (extracted from RegionalMap's CountUp).
// `format` receives the eased numeric value each frame (e.g. fmtNum, fmtINR, v => v.toFixed(1) + "%").
// Renders the final value instantly under prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

export default function AnimatedNumber({ value, duration = 900, delay = 0, format = (v) => Math.round(v) }) {
  const reduced = useReducedMotion();
  const to = Number(value) || 0;
  const [display, setDisplay] = useState(reduced ? to : 0);
  const prevRef = useRef(0); // animate from the previous value on updates, not from 0

  useEffect(() => {
    if (reduced) {
      prevRef.current = to;
      setDisplay(to);
      return;
    }
    const from = prevRef.current;
    let raf;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      prevRef.current = to;
    };
  }, [to, duration, delay, reduced]);

  return <>{format(display)}</>;
}
