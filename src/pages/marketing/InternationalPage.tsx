import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { Globe, ArrowUpRight, ArrowRight } from "lucide-react";
import { gsap, useGSAP } from "../../motion/gsap";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { useReveal } from "../../motion/useReveal";
import { AnimatedNumber } from "../../motion/AnimatedNumber";
import { INTERNATIONAL, INTL_TOTALS } from "../../lib/marketing/data/map-data";
import { WORLD_LAND } from "../../lib/marketing/data/world-land";
import { Badge } from "../../components/primitives/Badge";
import { Icon } from "../../components/primitives/Icon";
import { cx } from "../../lib/cx";
import { ComingSoonOverlay } from "./ComingSoonOverlay";

/** Types a string out character-by-character while `active`; clears when not. */
function useTypewriter(text: string, active: boolean, speed = 55) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active || prefersReducedMotion()) { setOut(active ? text : ""); return; }
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [active, text, speed]);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────
   Orthographic world globe. A real 3-D sphere: coastlines come from Natural
   Earth 1:110m data, cities are projected from true lat/long, and it rotates
   slowly. Collapsed, only the northern dome shows (half-globe rising from the
   bottom); expanded, the whole sphere is framed and can be dragged to rotate.
   ──────────────────────────────────────────────────────────────────────── */
const DEG = Math.PI / 180;
const VB_W = 1000;
const VB_H = 640;
const CX = 500;
const CY = 600; // sphere centre below the frame → we see the upper dome
const R = 560; // large enough to bleed off the sides; top stays in view
const PHI0 = 20 * DEG; // viewer tilt — northern hemisphere faces us
const COS_P = Math.cos(PHI0);
const SIN_P = Math.sin(PHI0);
const ROT_PERIOD = 60; // seconds per full turn (slow)

// ── Satellite orbit (independent of the land spin). A tilted circle just above
// the surface: it rides up the right, over the top, and ducks *behind* the globe
// on the upper-left (occluded → inaccessible), then loops round again.
const ORBIT_RHO = 1.06; // orbit radius in sphere-radius units (just above surface)
const ORBIT_K = 34 * DEG; // plane tilt → depth swing
const ORBIT_KC = Math.cos(ORBIT_K);
const ORBIT_KS = Math.sin(ORBIT_K);
const ORBIT_PERIOD = 26; // seconds per revolution
const ORBIT_EMERGE = 3.6; // seconds before it first appears (after the title types)
const ORBIT_START = 150 * DEG; // starts occluded behind the upper-left, then emerges
function orbitAt(phi: number) {
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const X = ORBIT_RHO * cp * ORBIT_KC;
  const Y = ORBIT_RHO * sp;
  const Z = ORBIT_RHO * cp * ORBIT_KS; // depth: >0 in front, <0 behind
  const vx = CX + R * X;
  const vy = CY - R * Y;
  const behind = Z < 0;
  const occluded = behind && X * X + Y * Y < 1; // behind AND within the silhouette
  const dishDeg = (Math.atan2(CY - vy, CX - vx) * 180) / Math.PI - 90; // dish → earth
  return { vx, vy, dishDeg, occluded, behind };
}

const CITIES = [
  { id: "blr", label: "Bangalore", lat: 12.97, lng: 77.59 },
  { id: "nyc", label: "New York", lat: 40.7, lng: -74.0 },
  { id: "lon", label: "London", lat: 51.5, lng: -0.12 },
  { id: "dxb", label: "Dubai", lat: 25.2, lng: 55.27 },
  { id: "sin", label: "Singapore", lat: 1.35, lng: 103.8 },
];
// every diaspora market connects back to the Bangalore hub (index 0)
const ARC_PAIRS: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4]];

type Vec = [number, number, number];
const toVec = (lat: number, lng: number): Vec => {
  const p = lat * DEG, l = lng * DEG;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};
// slerp between two unit vectors
function slerp(a: Vec, b: Vec, t: number): Vec {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.max(-1, Math.min(1, d));
  const o = Math.acos(d);
  if (o < 1e-4) return a;
  const s = Math.sin(o);
  const w1 = Math.sin((1 - t) * o) / s;
  const w2 = Math.sin(t * o) / s;
  return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
}

// Precomputed geometry (module-level; identical every mount).
// Natural Earth coastline rings → unit vectors, subdividing only long edges
// (great-circle interpolation) so straight jumps still hug the sphere.
function ringToVecs(ring: [number, number][]): Vec[] {
  const vs = ring.map(([lng, lat]) => toVec(lat, lng));
  const out: Vec[] = [];
  for (let i = 0; i < vs.length - 1; i++) {
    const a = vs[i], b = vs[i + 1];
    out.push(a);
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    d = Math.max(-1, Math.min(1, d));
    const steps = Math.floor((Math.acos(d) * 180) / Math.PI / 3);
    for (let s = 1; s < steps; s++) out.push(slerp(a, b, s / steps));
  }
  out.push(vs[vs.length - 1]);
  return out;
}
const LAND_VECS: Vec[][] = WORLD_LAND.map(ringToVecs);
const GRID_LINES: Vec[][] = (() => {
  const lines: Vec[][] = [];
  for (let lng = -150; lng <= 180; lng += 30) {
    const line: Vec[] = [];
    for (let lat = -80; lat <= 80; lat += 4) line.push(toVec(lat, lng));
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: Vec[] = [];
    for (let lng = -180; lng <= 180; lng += 4) line.push(toVec(lat, lng));
    lines.push(line);
  }
  return lines;
})();
const CITY_VECS: Vec[] = CITIES.map((c) => toVec(c.lat, c.lng));
const ARC_PTS: Vec[][] = ARC_PAIRS.map(([a, b]) => {
  const va = CITY_VECS[a], vb = CITY_VECS[b];
  const pts: Vec[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = slerp(va, vb, t);
    const s = 1 + 0.16 * Math.sin(Math.PI * t); // bow the arc up off the surface
    pts.push([p[0] * s, p[1] * s, p[2] * s]);
  }
  return pts;
});

// Rotate a vector by longitude λ0 then tilt; returns [screenX, screenY, facing].
function project(v: Vec, cosL: number, sinL: number): [number, number, number] {
  const x1 = v[0] * cosL + v[1] * sinL;
  const y1 = -v[0] * sinL + v[1] * cosL;
  const z1 = v[2];
  const x2 = x1 * COS_P + z1 * SIN_P; // facing (>0 = front)
  const z2 = -x1 * SIN_P + z1 * COS_P;
  return [CX + R * y1, CY - R * z2, x2];
}
const dot = (x: number, y: number, r: number) =>
  `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;

interface WorldGlobeProps {
  expanded: boolean;
  onToggleExpand: () => void;
  onHoverSat: (v: boolean) => void;
  satLabel: string;
  showCaret: boolean;
}

function WorldGlobe({ expanded, onToggleExpand, onHoverSat, satLabel, showCaret }: WorldGlobeProps) {
  const scope = useRef<SVGSVGElement>(null);
  const contRef = useRef<SVGPathElement>(null);
  const gridRef = useRef<SVGPathElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const pinRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const satGRef = useRef<SVGGElement>(null);
  const satRotRef = useRef<SVGGElement>(null);
  const satHitRef = useRef<SVGCircleElement>(null);
  const orbitStart = useRef<number | null>(null);
  const base = useRef(-20 * DEG); // auto-rotation longitude
  const drag = useRef(0); // manual drag offset (expanded mode)
  const dragging = useRef(false);
  const startX = useRef(0);
  const tween = useRef<ReturnType<typeof gsap.to> | null>(null);

  const renderFrame = useCallback((lam: number) => {
        const cosL = Math.cos(lam), sinL = Math.sin(lam);

        // coastline outlines — break the polyline whenever it crosses the limb
        let cont = "";
        for (const line of LAND_VECS) {
          let pen = false;
          for (const v of line) {
            const [x, y, f] = project(v, cosL, sinL);
            if (f > 0.02) { cont += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; pen = true; }
            else pen = false;
          }
        }
        contRef.current?.setAttribute("d", cont);

        // graticule — break the polyline whenever it crosses the limb
        let grid = "";
        for (const line of GRID_LINES) {
          let pen = false;
          for (const v of line) {
            const [x, y, f] = project(v, cosL, sinL);
            if (f > 0.02) { grid += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; pen = true; }
            else pen = false;
          }
        }
        gridRef.current?.setAttribute("d", grid);

        // connection arcs (same limb-break handling)
        let arcs = "";
        for (const line of ARC_PTS) {
          let pen = false;
          for (const v of line) {
            const [x, y, f] = project(v, cosL, sinL);
            if (f > 0.05) { arcs += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; pen = true; }
            else pen = false;
          }
        }
        arcRef.current?.setAttribute("d", arcs);

        // cities — a solid pin + a faint halo (separate paths for two opacities)
        let pins = "";
        let halos = "";
        CITY_VECS.forEach((v, i) => {
          const [x, y, f] = project(v, cosL, sinL);
          const el = labelRefs.current[i];
          if (f > 0.04) {
            pins += dot(x, y, 5);
            halos += dot(x, y, 9.5);
            if (el) {
              el.setAttribute("x", x.toFixed(1));
              el.setAttribute("y", (y - 16).toFixed(1));
              el.setAttribute("opacity", Math.min(1, f * 1.8).toFixed(2));
            }
          } else if (el) {
            el.setAttribute("opacity", "0");
          }
        });
        pinRef.current?.setAttribute("d", pins);
        haloRef.current?.setAttribute("d", halos);

        // orbiting satellite (own clock; independent of the land spin)
        const g = satGRef.current, rot = satRotRef.current, hit = satHitRef.current;
        if (g && rot) {
          const setSat = (o: ReturnType<typeof orbitAt>, opacity: number, accessible: boolean) => {
            g.setAttribute("transform", `translate(${o.vx.toFixed(1)} ${o.vy.toFixed(1)})`);
            rot.setAttribute("transform", `rotate(${o.dishDeg.toFixed(1)})`);
            g.setAttribute("opacity", opacity.toFixed(2));
            if (hit) hit.style.pointerEvents = accessible ? "all" : "none";
          };
          if (prefersReducedMotion()) {
            setSat(orbitAt(52 * DEG), 1, true);
          } else {
            const now = performance.now();
            if (orbitStart.current == null) orbitStart.current = now;
            const t = (now - orbitStart.current) / 1000;
            if (t < ORBIT_EMERGE) {
              g.setAttribute("opacity", "0");
              if (hit) hit.style.pointerEvents = "none";
            } else {
              const phi = ORBIT_START - (t - ORBIT_EMERGE) * ((Math.PI * 2) / ORBIT_PERIOD);
              const o = orbitAt(phi);
              const op = o.occluded ? 0 : o.behind ? 0.5 : 1;
              setSat(o, op, op > 0.6);
            }
          }
        }
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) { renderFrame(18 * DEG); return; }
      const p = { t: 0 };
      renderFrame(base.current + drag.current);
      const tw = gsap.to(p, {
        t: Math.PI * 2,
        duration: ROT_PERIOD,
        ease: "none",
        repeat: -1,
        onUpdate: () => {
          base.current = -20 * DEG + p.t;
          renderFrame(base.current + drag.current);
        },
      });
      tween.current = tw;
      return () => tw.kill();
    },
    { scope, dependencies: [renderFrame] },
  );

  // drag-to-rotate — meaningful only in expanded mode (pointer events enabled)
  const onDown = (e: ReactPointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    tween.current?.pause();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    // drag right → globe turns to follow the cursor (grab feel)
    drag.current -= (e.clientX - startX.current) * 0.006;
    startX.current = e.clientX;
    renderFrame(base.current + drag.current);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    tween.current?.resume();
  };

  // expanded: frame the whole sphere with extra room at the bottom (padding);
  // aligning to the top keeps that padding below the globe.
  const viewBox = expanded
    ? `${CX - R - 24} ${CY - R - 24} ${2 * R + 48} ${2 * R + 48 + 170}`
    : `0 0 ${VB_W} ${VB_H}`;

  return (
    <svg
      ref={scope}
      viewBox={viewBox}
      preserveAspectRatio={expanded ? "xMidYMin meet" : "xMidYMin slice"}
      className={cx(
        "absolute inset-0 h-full w-full",
        expanded ? "cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none",
      )}
      aria-hidden
      onPointerDown={expanded ? onDown : undefined}
      onPointerMove={expanded ? onMove : undefined}
      onPointerUp={expanded ? onUp : undefined}
      onPointerLeave={expanded ? onUp : undefined}
    >
      <defs>
        {/* a soft centred sheen on the sphere itself (clipped to it, so it can
            never bleed below the globe); very faint in light mode */}
        <radialGradient id="fa-globe-face" cx="50%" cy="46%" r="60%">
          <stop offset="0%" stopColor="var(--globe)" stopOpacity="0.07" />
          <stop offset="60%" stopColor="var(--globe)" stopOpacity="0.025" />
          <stop offset="100%" stopColor="var(--globe)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="fa-globe-clip"><circle cx={CX} cy={CY} r={R} /></clipPath>
      </defs>

      <g clipPath="url(#fa-globe-clip)">
        {/* faint globe face */}
        <circle cx={CX} cy={CY} r={R} fill="url(#fa-globe-face)" />
        {/* graticule */}
        <path ref={gridRef} d="" fill="none" stroke="var(--globe)" strokeWidth={0.9} opacity={0.1} />
        {/* continent outlines — subtle */}
        <path ref={contRef} d="" fill="none" stroke="var(--globe)" strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" opacity={0.34} />
        {/* connection arcs */}
        <path ref={arcRef} d="" fill="none" stroke="var(--accent)" strokeWidth={1.6} opacity={0.6} strokeLinecap="round" strokeDasharray="3 7" className="fa-arc" />
        {/* city pins — faint halo + solid dot */}
        <path ref={haloRef} d="" fill="var(--accent)" opacity={0.2} />
        <path ref={pinRef} d="" fill="var(--accent)" />
      </g>

      {/* crisp limb */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--globe)" strokeWidth={1.4} opacity={0.42} />

      {/* city labels (outside the clip so they stay sharp at the limb) */}
      {CITIES.map((c, i) => (
        <text
          key={c.id}
          ref={(el) => { labelRefs.current[i] = el; }}
          x={CX}
          y={CY}
          opacity={0}
          textAnchor="middle"
          className="fill-[var(--text-2)] font-mono"
          fontSize={13}
          letterSpacing="1"
        >
          {c.label}
        </text>
      ))}

      {/* orbiting satellite — position & rotation set imperatively each frame */}
      <g ref={satGRef} opacity={0}>
        <circle
          ref={satHitRef}
          r={30}
          fill="transparent"
          className="cursor-pointer"
          style={{ pointerEvents: "none" }}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerEnter={() => onHoverSat(true)}
          onPointerLeave={() => onHoverSat(false)}
        />
        <circle
          r={26}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.4}
          className="fa-sat-ping pointer-events-none"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        <g ref={satRotRef} className="pointer-events-none">
          <SatelliteShape />
        </g>
        {satLabel ? (
          <text x={34} y={4} className="pointer-events-none fill-[var(--text-2)] font-mono" fontSize={12.5} letterSpacing="0.5">
            {satLabel}
            {showCaret ? <tspan className="fa-caret fill-[var(--accent)]">▏</tspan> : null}
          </text>
        ) : null}
      </g>
    </svg>
  );
}

/* Detailed satellite, centred on the origin (so it rotates about its own body).
   Solar-panel wings, a body with a window, and an antenna + small dish at the
   bottom — the side that faces the earth. Darker, muted blue. */
function SatelliteShape() {
  const stroke = "color-mix(in oklab, var(--accent) 66%, #000)";
  const body = "color-mix(in oklab, var(--accent) 46%, #000)";
  const panel = "color-mix(in oklab, var(--accent) 28%, #000)";
  const win = "color-mix(in oklab, var(--accent) 72%, #fff)";
  return (
    <g fill="none">
      {/* solar panels */}
      <g stroke={stroke} strokeWidth={1.3} fill={panel}>
        <rect x={-24} y={-7} width={12} height={14} rx={1} />
        <rect x={12} y={-7} width={12} height={14} rx={1} />
        <line x1={-20} y1={-7} x2={-20} y2={7} />
        <line x1={-16} y1={-7} x2={-16} y2={7} />
        <line x1={-24} y1={0} x2={-12} y2={0} />
        <line x1={16} y1={-7} x2={16} y2={7} />
        <line x1={20} y1={-7} x2={20} y2={7} />
        <line x1={12} y1={0} x2={24} y2={0} />
      </g>
      {/* arms */}
      <line x1={-12} y1={0} x2={-7} y2={0} stroke={stroke} strokeWidth={1.8} />
      <line x1={7} y1={0} x2={12} y2={0} stroke={stroke} strokeWidth={1.8} />
      {/* body */}
      <rect x={-7} y={-8} width={14} height={16} rx={2} fill={body} stroke={stroke} strokeWidth={1} />
      <rect x={-4.5} y={-5} width={9} height={7} rx={1} fill={win} opacity={0.5} />
      {/* antenna mast + dish (bottom = earth-facing) */}
      <line x1={0} y1={8} x2={0} y2={14} stroke={stroke} strokeWidth={1.5} />
      <ellipse cx={0} cy={17} rx={8} ry={3.4} fill={panel} stroke={stroke} strokeWidth={1.4} />
      <line x1={0} y1={17} x2={0} y2={22} stroke={stroke} strokeWidth={1.2} />
      <circle cx={0} cy={22.5} r={1.7} fill={stroke} />
    </g>
  );
}

export default function InternationalPage() {
  const gridRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const [expanded, setExpanded] = useState(false);
  const [hoverSat, setHoverSat] = useState(false);
  const typed = useTypewriter(expanded ? "Collapse" : "Explore Globe", hoverSat);

  // Headline is typed in the same way as the satellite label — real
  // character-by-character insertion with a blinking caret.
  const [startTitle, setStartTitle] = useState(() => prefersReducedMotion());
  const [titleCaret, setTitleCaret] = useState(true);
  const typedTitle = useTypewriter("International", startTitle, 90);
  useEffect(() => {
    const t = setTimeout(() => setStartTitle(true), 300);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (startTitle && typedTitle === "International") {
      const t = setTimeout(() => setTitleCaret(false), 1400);
      return () => clearTimeout(t);
    }
  }, [startTitle, typedTitle]);

  return (
    <>
      {/* hero — text first, globe rising from the bottom below it (no divider —
          it flows straight into the markets section) */}
      <section className="relative flex min-h-[100vh] flex-col overflow-hidden px-6 pb-10 pt-32 md:px-10 md:pb-16 md:pt-40">
        <div className="relative z-10 mx-auto w-full max-w-[1200px] text-center">
          <p className="flex items-center justify-center gap-2 font-mono text-eyebrow uppercase tracking-[0.2em] text-ink-3">
            <Icon icon={Globe} size={13} /> Beyond India
          </p>
          {/* an invisible full-word reserver keeps the box centred while the
              visible copy is typed in left→right over it (no re-centring wobble) */}
          <h1 className="mx-auto mt-5 whitespace-nowrap font-display font-extralight uppercase leading-[0.94] tracking-[0.08em] text-ink" style={{ fontSize: "clamp(34px, 9vw, 132px)" }}>
            <span className="relative inline-block">
              <span aria-hidden className="invisible">International</span>
              <span aria-hidden className="absolute inset-0 whitespace-nowrap text-left [text-indent:0.04em]">
                {typedTitle}
                {titleCaret && <span className="fa-caret ml-[0.02em] inline-block h-[0.72em] w-[0.05em] translate-y-[0.14em] bg-accent align-baseline" />}
              </span>
              <span className="sr-only">International</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-2">
            Diaspora-led activations that carry regional brands into the world's
            highest-value markets — with creators who speak the language at both ends.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { label: "Markets", value: INTL_TOTALS.markets as number, str: null },
              { label: "Reach", value: 0, str: INTL_TOTALS.reach },
              { label: "Creators", value: INTL_TOTALS.creators as number, str: null },
            ].map((s) => (
              <div key={s.label}>
                <p className="tnum font-serif text-title-lg text-ink">
                  {s.str ? s.str : <AnimatedNumber value={s.value} snap={1} />}
                </p>
                <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.1em] text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* globe fills the space beneath the copy; the satellite (drawn inside
            the globe, orbiting it) toggles the full-globe view on click */}
        <div
          className={cx(
            "relative mt-10 flex-1 transition-[min-height] duration-700 ease-out",
            expanded ? "min-h-[82vh]" : "min-h-[46vh]",
          )}
        >
          <WorldGlobe
            expanded={expanded}
            onToggleExpand={() => setExpanded((e) => !e)}
            onHoverSat={setHoverSat}
            satLabel={typed}
            showCaret={hoverSat}
          />
        </div>
      </section>

      {/* markets */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Active markets</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">Four cities, one diaspora audience.</h2>

          <div ref={gridRef} className="mt-10 grid gap-4 sm:grid-cols-2">
            {INTERNATIONAL.map((mk) => (
              <div data-reveal key={mk.id} className="rounded-2xl border border-line bg-card p-6 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-title-lg text-ink">{mk.city}</h3>
                    <p className="text-caption text-ink-3">{mk.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-title text-ink">{mk.reach}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{mk.creators} creators</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {mk.langs.map((l) => (
                    <span key={l} className="rounded-full bg-hover px-2.5 py-0.5 text-caption text-ink-2">{l}</span>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
                  {mk.campaigns.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-caption text-ink-2">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <span className="tnum text-caption text-ink-3">{c.reach}</span>
                        <Badge tone="muted">{c.phase}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link to="/apply" className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover">
              Apply as Creator
              <Icon icon={ArrowUpRight} size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/start" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
              Plan a global campaign
              <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </div>
      </section>
      <ComingSoonOverlay title="International" tagline="Our global markets experience is on the way." />
    </>
  );
}
