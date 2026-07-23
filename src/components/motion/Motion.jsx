// src/components/motion/Motion.jsx — shared motion primitives.
// Reveal, Stagger/StaggerItem, HoverLift, Magnetic, useTilt, AmbientBackground.
// All motion respects prefers-reduced-motion via <MotionConfig reducedMotion="user"> in App.jsx.

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE, SPRING, fadeUp, staggerParent } from "../../lib/motion";

/* ── Reveal: fades+rises when it enters the viewport (once) ── */
export function Reveal({ children, delay = 0, y = 14, once = true, className, as = "div", ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── Stagger container + item: replaces per-item animationDelay math ── */
export function Stagger({ children, stagger = 0.06, delayChildren = 0, className, animateOnMount = true, ...rest }) {
  return (
    <motion.div
      variants={staggerParent(stagger, delayChildren)}
      initial={animateOnMount ? "hidden" : false}
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, variants = fadeUp, ...rest }) {
  return (
    <motion.div variants={variants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── HoverLift: standardized card hover (replaces hover:-translate-y-1) ── */
export function HoverLift({ children, className, lift = -4, ...rest }) {
  return (
    <motion.div whileHover={{ y: lift }} whileTap={{ scale: 0.985 }} transition={SPRING} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/* ── Magnetic: primary CTAs gently follow the cursor ── */
export function Magnetic({ children, strength = 0.25, className }) {
  const ref = useRef(null);
  const [xy, setXy] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  const onMove = (e) => {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setXy({ x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength });
  };
  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setXy({ x: 0, y: 0 })}
      animate={{ x: xy.x, y: xy.y }}
      transition={{ type: "spring", stiffness: 250, damping: 18 }}
      className={className}
      style={{ display: "inline-block" }}
    >
      {children}
    </motion.div>
  );
}

/* ── useTilt: cursor-tracking 3D tilt (extracted from RegionalMap's IndiaMap) ── */
export function useTilt(maxRx = 10, maxRy = 12) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const reduced = useReducedMotion();
  const onMouseMove = (e) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * maxRx, ry: (px - 0.5) * maxRy });
  };
  const onMouseLeave = () => setTilt({ rx: 0, ry: 0 });
  return { ref, tilt, handlers: { onMouseMove, onMouseLeave } };
}

/* ── AmbientBackground: token-colored gradient blobs behind pages ──
   Replaces the per-page inline blob divs; colors derive from the palette so
   nothing clashes. `variant` nudges blob placement per page. */
export function AmbientBackground({ variant = "a" }) {
  const blobs =
    variant === "b"
      ? [
          { cls: "left-[-120px] top-[-80px] h-[380px] w-[380px]", c: "var(--color-accent)", o: 0.07 },
          { cls: "right-[-100px] top-[240px] h-[420px] w-[420px]", c: "var(--color-teal)", o: 0.06 },
          { cls: "left-[30%] bottom-[-160px] h-[400px] w-[400px]", c: "var(--color-purple)", o: 0.05 },
        ]
      : [
          { cls: "right-[-120px] top-[-100px] h-[420px] w-[420px]", c: "var(--color-accent)", o: 0.07 },
          { cls: "left-[-100px] top-[300px] h-[380px] w-[380px]", c: "var(--color-purple)", o: 0.05 },
          { cls: "right-[25%] bottom-[-140px] h-[380px] w-[380px]", c: "var(--color-gold)", o: 0.06 },
        ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[110px] ambient-blob ${b.cls}`}
          style={{ background: b.c, opacity: b.o, animationDelay: `${i * -7}s` }}
        />
      ))}
    </div>
  );
}
