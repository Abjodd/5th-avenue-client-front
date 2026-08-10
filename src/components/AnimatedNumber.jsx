// src/components/AnimatedNumber.jsx — rAF count-up (extracted from RegionalMap's CountUp).
// `format` receives the eased numeric value each frame (e.g. fmtNum, fmtINR, v => v.toFixed(1) + "%").
// Renders the final value instantly under prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/* The count-up is decoration; the number is the point. Anywhere the animation
   can't run we skip straight to the final value rather than leaving the last
   frame on screen — and the very first frame is 0, which is not a neutral
   placeholder but a *wrong figure* sitting under a label like "Campaign
   budget". Browsers pause requestAnimationFrame in a background tab, so a
   dashboard opened in a tab the user hasn't switched to yet used to render a
   wall of zeroes and keep them until something forced a re-render. */
const canAnimate = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

export default function AnimatedNumber({ value, duration = 900, delay = 0, format = (v) => Math.round(v) }) {
  const reduced = useReducedMotion();
  const to = Number(value) || 0;
  const [display, setDisplay] = useState(reduced ? to : 0);
  const prevRef = useRef(0); // animate from the previous value on updates, not from 0

  useEffect(() => {
    if (reduced || !canAnimate()) {
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

    // If the tab is backgrounded mid-count the queued frame never arrives.
    // Land on the final value instead of freezing part-way there.
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      cancelAnimationFrame(raf);
      prevRef.current = to;
      setDisplay(to);
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      prevRef.current = to;
    };
  }, [to, duration, delay, reduced]);

  return <>{format(display)}</>;
}
