import { useRef } from "react";
import { gsap, useGSAP } from "./gsap";
import { DUR, EASE, STAG } from "./tokens";
import { prefersReducedMotion } from "./reducedMotion";

interface RevealOptions {
  /** Stagger children carrying [data-reveal] instead of animating the root. */
  stagger?: boolean;
  staggerEach?: number;
  y?: number;
  delay?: number;
  duration?: number;
  /** ScrollTrigger start position (default "top 85%"). */
  start?: string;
  /** Animate immediately on mount instead of on scroll. */
  immediate?: boolean;
}

/** Returns a ref; the element (or its [data-reveal] children) rises in
    once when scrolled into view. Reduced motion → content just shows. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  opts: RevealOptions = {},
) {
  const ref = useRef<T>(null);
  const {
    stagger = false,
    staggerEach = STAG.list,
    y = 24,
    delay = 0,
    duration = DUR.md,
    start = "top 85%",
    immediate = false,
  } = opts;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const targets = stagger
        ? Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"))
        : [el];
      if (!targets.length) return;

      if (prefersReducedMotion()) return; // leave everything visible

      gsap.from(targets, {
        y,
        opacity: 0,
        duration,
        delay,
        ease: EASE.out,
        stagger: stagger ? staggerEach : 0,
        clearProps: "transform,opacity",
        ...(immediate
          ? {}
          : {
              scrollTrigger: { trigger: el, start, once: true },
            }),
      });
    },
    { scope: ref },
  );

  return ref;
}
