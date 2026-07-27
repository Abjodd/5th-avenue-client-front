import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../motion/reducedMotion";

/* ══════════════════════════════════════════════════════════════════════════
   Crayon cursor. The `.fa-crayon` CSS hides the native cursor; this component
   renders the crayon as a DOM element whose TIP sits exactly on the pointer,
   and paints the waxy trail from that same point — so the stroke always
   starts at the tip. The crayon recolors with the trail. Mouse/pen only;
   coarse pointers keep the normal cursor (see index.css).
   ══════════════════════════════════════════════════════════════════════════ */

// The tip vertex (16, 28.5) of the rotate(45°) crayon lands at ≈(7.5, 24.5)
// in the 32×32 box — anchoring that point at the pointer aligns tip & trail.
const TIP_X = 7.5;
const TIP_Y = 24.5;

export function CrayonCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crayonRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const crayon = crayonRef.current;
    if (!cv || !crayon) return;
    const reduce = prefersReducedMotion();
    const ctx = cv.getContext("2d");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Resolve the viz palette once — canvas can't use var().
    const cs = getComputedStyle(document.documentElement);
    const COLORS = ["--viz-pink", "--viz-orange", "--viz-purple", "--viz-teal", "--viz-amber", "--viz-blue", "--viz-green"]
      .map((v) => cs.getPropertyValue(v).trim() || "#cf6ba0");

    const setCrayonColor = (c: string) => {
      tipRef.current?.setAttribute("fill", c);
      bodyRef.current?.setAttribute("fill", c);
    };
    setCrayonColor(COLORS[0]);

    interface Pt { x: number; y: number; t: number; c: string; brk: boolean }
    const pts: Pt[] = [];
    const LIFE = 1500; // ms a stroke stays on screen
    let colorIdx = 0;
    let dist = 0;
    let last: { x: number; y: number; t: number } | null = null;
    let raf = 0;
    let running = false;

    const loop = () => {
      if (!ctx) return;
      const now = performance.now();
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      ctx.clearRect(0, 0, W, H);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (b.brk) continue; // pointer jumped — new stroke
        const age = (now - b.t) / LIFE;
        const alpha = Math.max(0, 1 - age);
        // main waxy stroke
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = b.c;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // rough secondary pass for crayon grain
        ctx.globalAlpha = alpha * 0.3;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x + 1.6, a.y + 1.2);
        ctx.lineTo(b.x + 1.6, b.y + 1.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (pts.length) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      // the crayon follows even under reduced motion — it IS the cursor
      crayon.style.opacity = "1";
      crayon.style.transform = `translate3d(${e.clientX - TIP_X}px, ${e.clientY - TIP_Y}px, 0)`;
      if (reduce || !ctx) return;

      const t = performance.now();
      let brk = false;
      if (last) {
        const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
        if (t - last.t > 140 || d > 160) brk = true;
        else {
          dist += d;
          if (dist > 300) {
            dist = 0;
            colorIdx = (colorIdx + 1) % COLORS.length;
            setCrayonColor(COLORS[colorIdx]);
          }
        }
      }
      pts.push({ x: e.clientX, y: e.clientY, t, c: COLORS[colorIdx], brk });
      last = { x: e.clientX, y: e.clientY, t };
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    };

    const hide = () => { crayon.style.opacity = "0"; };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[65]" />
      <div
        ref={crayonRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[90] opacity-0"
        style={{ willChange: "transform" }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32">
          <g transform="rotate(45 16 16)">
            <path ref={tipRef} d="M13 21 L16 28.5 L19 21 Z" fill="#f2a9cf" stroke="#221426" strokeWidth="1.4" strokeLinejoin="round" />
            <rect ref={bodyRef} x="13" y="3" width="6" height="18" rx="1.6" fill="#f2a9cf" stroke="#221426" strokeWidth="1.4" />
            {/* shading — keeps depth whatever the current color */}
            <rect x="13" y="7.5" width="6" height="3.4" fill="rgba(0,0,0,0.22)" />
            <path d="M13 21 L16 24.8 L19 21 Z" fill="rgba(0,0,0,0.16)" />
          </g>
        </svg>
      </div>
    </>
  );
}
