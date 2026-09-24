import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useReducedMotion } from "motion/react";
import { WORLD_LAND } from "../lib/marketing/data/world-land";
import { useTheme } from "../context/ThemeContext";

/* ── Orthographic globe projection ────────────────────────────────────────
   Ported from the already-shipping, already-correct globe on the
   /international marketing page (InternationalPage.tsx's WorldGlobe): real
   Natural Earth coastlines, standard spherical trigonometry, no 3D library.
   Reused rather than re-derived on purpose — this is proven, deterministic
   math (a projection is either right or wrong, and it's checkable by
   inspection), and porting it is far safer than inventing new 3D
   geometry blind in an environment with no way to render-and-check. */
const DEG = Math.PI / 180;
const VB = 640; // square viewBox — this globe sits centered, not "rising" like the marketing one
const CX = VB / 2;
const CY = VB / 2;
const R = VB * 0.44;
const PHI0 = 16 * DEG; // slight downward tilt so the northern dome reads as a sphere, not a disc
const COS_P = Math.cos(PHI0);
const SIN_P = Math.sin(PHI0);
const ROT_PERIOD = 46; // seconds per full turn — slow, ambient, not the focal point of the page

function toVec(lat, lng) {
  const p = lat * DEG, l = lng * DEG;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.max(-1, Math.min(1, d));
  const o = Math.acos(d);
  if (o < 1e-4) return a;
  const s = Math.sin(o);
  const w1 = Math.sin((1 - t) * o) / s;
  const w2 = Math.sin(t * o) / s;
  return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
}
// Natural Earth ring → unit vectors, subdividing long edges along the great
// circle so straight jumps still hug the sphere instead of cutting through it.
function ringToVecs(ring) {
  const vs = ring.map(([lng, lat]) => toVec(lat, lng));
  const out = [];
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
// Rotate by auto-rotation longitude, then apply the fixed viewer tilt.
// Returns [screenX, screenY, facing] — facing > 0 means the near hemisphere.
function project(v, cosL, sinL) {
  const x1 = v[0] * cosL + v[1] * sinL;
  const y1 = -v[0] * sinL + v[1] * cosL;
  const z1 = v[2];
  const x2 = x1 * COS_P + z1 * SIN_P;
  const z2 = -x1 * SIN_P + z1 * COS_P;
  return [CX + R * y1, CY - R * z2, x2];
}
const dotPath = (x, y, r) =>
  `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;

// Precomputed once at module load — identical every mount, same technique
// InternationalPage's globe already uses in production.
const LAND_VECS = WORLD_LAND.map(ringToVecs);
const GRID_LINES = (() => {
  const lines = [];
  for (let lng = -150; lng <= 180; lng += 30) {
    const line = [];
    for (let lat = -75; lat <= 75; lat += 5) line.push(toVec(lat, lng));
    lines.push(line);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const line = [];
    for (let lng = -180; lng <= 180; lng += 5) line.push(toVec(lat, lng));
    lines.push(line);
  }
  return lines;
})();

// Real approximate lat/lng (state capital or geographic centre) for every
// STATES_META code — the only geo-lookup this feature needs, since campaign
// and creator location data is state-level (Creator.state), never
// street-level. Keys match src/lib/geo.js's STATES_META exactly.
const INDIA_STATE_LATLNG = {
  ch: [30.73, 76.78], dl: [28.61, 77.21], hp: [31.10, 77.17], hr: [29.06, 76.09],
  jk: [34.08, 74.80], pb: [30.90, 75.86], rj: [26.91, 75.79], up: [26.85, 80.95],
  ut: [30.32, 78.03],
  ap: [16.51, 80.65], tg: [17.39, 78.49], ka: [12.97, 77.59], kl: [8.52, 76.94],
  tn: [13.08, 80.27],
  gj: [23.02, 72.57], mh: [19.08, 72.88], ga: [15.49, 73.83],
  mp: [23.26, 77.41], ct: [21.25, 81.63],
  or: [20.30, 85.82], jh: [23.34, 85.31], wb: [22.57, 88.36], br: [25.59, 85.14],
  as: [26.14, 91.74], mn: [24.82, 93.94], nl: [25.68, 94.11], ml: [25.58, 91.89],
  sk: [27.34, 88.61], ar: [27.08, 93.61], mz: [23.73, 92.72], tr: [23.83, 91.29],
  ld: [10.57, 72.64], an: [11.62, 92.73], dn: [20.27, 73.02], dd: [20.40, 72.83],
  py: [11.94, 79.81],
};

/** Turns { code: {campaigns, creators, followers, views} } (regionalRollup's
 * stateData — every STATES_META code, zeros where there's no activity) into
 * everything the globe needs to draw: one weighted vec per active state, and
 * hub-and-spoke arcs from the busiest state to every other active one. */
function useGlobeMarkers(stateActivity) {
  return useMemo(() => {
    if (!stateActivity) return null;
    const entries = Object.entries(stateActivity)
      .map(([code, d]) => ({ code, ...d, latlng: INDIA_STATE_LATLNG[code] }))
      .filter((e) => e.latlng && (e.campaigns > 0 || e.creators > 0));
    if (entries.length === 0) return null;

    for (const e of entries) {
      e.weight = e.campaigns * 3 + e.creators;
      e.vec = toVec(e.latlng[0], e.latlng[1]);
    }
    const maxWeight = Math.max(...entries.map((e) => e.weight), 1);
    for (const e of entries) {
      e.r = 3.2 + 4.2 * Math.sqrt(e.weight / maxWeight);
    }

    const hub = entries.reduce((a, b) => (b.weight > a.weight ? b : a), entries[0]);
    const arcs = entries
      .filter((e) => e !== hub)
      .map((e) => {
        const N = 40;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const p = slerp(hub.vec, e.vec, t);
          const s = 1 + 0.1 * Math.sin(Math.PI * t); // bow slightly off the surface
          pts.push([p[0] * s, p[1] * s, p[2] * s]);
        }
        return pts;
      });

    return { entries, arcs, hubCode: hub.code };
  }, [stateActivity]);
}

/**
 * HeroOrbit — the Overview hero's right-side piece: a slowly rotating 3D
 * globe (real coastlines, orthographic projection) with a glowing marker
 * over every Indian state this brand currently has campaigns running in,
 * sized by how much is happening there, radiating thin arcs back to the
 * busiest one. Where every earlier version of this component was abstract
 * decoration, this one answers the actual question the hero should answer:
 * where is this brand's work happening right now.
 *
 * `stateActivity` is regionalRollup(campaigns, creators).stateData — Overview
 * already has both campaigns and creators in hand, so this needs no network
 * call of its own. With no activity yet, it falls back to a calm rotating
 * globe with no markers, rather than fabricating a location.
 *
 * The whole piece still tilts a few degrees toward the cursor, same as the
 * gradient orb it replaces — a globe on a tilting stand rather than a fixed
 * illustration.
 */
export default function HeroOrbit({ size = 320, className = "", stateActivity = null, onClick }) {
  const reduce = useReducedMotion();
  const { theme } = useTheme();
  // Light mode's cream face makes any tinted glow read as a haze, so it's
  // off entirely there; dark mode keeps the subtle globe-face lift. Markers
  // are brand blue on the light cream ground, gold on the dark ground —
  // gold is what reads against a dark sphere, blue disappears into it.
  const faceOpacity = theme === "dark" ? 0.07 : 0;
  const markerColor = theme === "dark" ? "var(--color-gold)" : "var(--color-accent)";
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const contRef = useRef(null);
  const gridRef = useRef(null);
  const arcRef = useRef(null);
  const pinRef = useRef(null);
  const haloRef = useRef(null);
  const lamRef = useRef(-20 * DEG);
  const rafRef = useRef(null);

  const markers = useGlobeMarkers(stateActivity);

  const renderFrame = useCallback((lam) => {
    const cosL = Math.cos(lam), sinL = Math.sin(lam);

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

    if (markers) {
      let arcs = "";
      for (const line of markers.arcs) {
        let pen = false;
        for (const v of line) {
          const [x, y, f] = project(v, cosL, sinL);
          if (f > 0.05) { arcs += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; pen = true; }
          else pen = false;
        }
      }
      arcRef.current?.setAttribute("d", arcs);

      let pins = "";
      let halos = "";
      for (const e of markers.entries) {
        const [x, y, f] = project(e.vec, cosL, sinL);
        if (f > 0.04) {
          pins += dotPath(x, y, e.r);
          halos += dotPath(x, y, e.r * 1.9);
        }
      }
      pinRef.current?.setAttribute("d", pins);
      haloRef.current?.setAttribute("d", halos);
    } else {
      arcRef.current?.setAttribute("d", "");
      pinRef.current?.setAttribute("d", "");
      haloRef.current?.setAttribute("d", "");
    }
  }, [markers]);

  useEffect(() => {
    if (reduce) {
      renderFrame(lamRef.current);
      return;
    }
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      lamRef.current += (Math.PI * 2 / ROT_PERIOD) * dt;
      renderFrame(lamRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [reduce, renderFrame]);

  const handleMove = useCallback((e) => {
    if (reduce || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -10, y: px * 10 });
  }, [reduce]);
  const handleLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const activeCount = markers?.entries.length ?? 0;

  const handleKeyDown = useCallback((e) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-hidden={onClick ? undefined : "true"}
      aria-label={onClick ? "Open the regional map" : undefined}
      className={`relative mx-auto ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size, perspective: size * 2.4 }}
    >
      {/* Ambient outer glow, fixed — only the globe inside tilts */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size * 1.08,
          height: size * 1.08,
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 72%)",
          filter: "blur(10px)",
        }}
      />

      {/* Two faint tilted orbit rings, purely decorative — an ellipse still
          reads fine even if the exact tilt is off, unlike precise 3D solids. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size * 0.98, height: size * 0.5,
          border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
          transform: "rotate(-8deg)",
          animation: reduce ? "none" : "hero-globe-ring-spin-a 90s linear infinite",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size * 1.04, height: size * 0.58,
          border: "1px solid color-mix(in srgb, var(--color-gold) 18%, transparent)",
          transform: "rotate(11deg)",
          animation: reduce ? "none" : "hero-globe-ring-spin-b 130s linear infinite",
        }}
      />

      {/* Grounding shadow */}
      <div
        className="absolute left-1/2 top-[90%] -translate-x-1/2 rounded-full"
        style={{
          width: size * 0.5,
          height: size * 0.1,
          background: "radial-gradient(closest-side, var(--color-accent), transparent)",
          opacity: 0.14,
          filter: "blur(14px)",
        }}
      />

      {/* The globe itself, tilting a few degrees toward the cursor */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: size, height: size,
          marginLeft: -size / 2, marginTop: -size / 2,
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <svg viewBox={`0 0 ${VB} ${VB}`} width={size} height={size} className="block">
          <defs>
            {/* --globe (not --color-accent) — same subdued face tint as the
                proven InternationalPage globe; --color-accent here read as a
                bright blue haze washing over the sphere. Off entirely in
                light mode — see faceOpacity above. */}
            <radialGradient id="hero-globe-face" cx="46%" cy="40%" r="62%">
              <stop offset="0%" stopColor="var(--globe)" stopOpacity={faceOpacity} />
              <stop offset="60%" stopColor="var(--globe)" stopOpacity={faceOpacity * 0.36} />
              <stop offset="100%" stopColor="var(--globe)" stopOpacity="0" />
            </radialGradient>
            <clipPath id="hero-globe-clip"><circle cx={CX} cy={CY} r={R} /></clipPath>
          </defs>

          <g clipPath="url(#hero-globe-clip)">
            <circle cx={CX} cy={CY} r={R} fill="url(#hero-globe-face)" />
            <path ref={gridRef} d="" fill="none" stroke="var(--color-accent)" strokeWidth={0.8} opacity={0.16} />
            <path ref={contRef} d="" fill="none" stroke="var(--color-accent)" strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
            {/* Markers in brand blue on the light ground, gold on the dark
                ground — see markerColor above. */}
            <path ref={arcRef} d="" fill="none" stroke={markerColor} strokeWidth={1.4} opacity={0.7} strokeLinecap="round" strokeDasharray="2.5 6" />
            <path ref={haloRef} d="" fill={markerColor} opacity={0.28} />
            <path ref={pinRef} d="" fill={markerColor} style={{ animation: reduce ? "none" : "hero-globe-pulse 2.4s ease-in-out infinite" }} />
          </g>

          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-accent)" strokeWidth={1.3} opacity={0.4} />
        </svg>
      </div>

      {activeCount > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide text-accent"
          style={{
            // Clear of the sphere's own edge rather than sitting flush against it.
            bottom: -size * 0.09,
            background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 24%, transparent)",
          }}
        >
          Live in {activeCount} {activeCount === 1 ? "state" : "states"}
        </div>
      )}

      <style>{`
        @keyframes hero-globe-ring-spin-a { 0% { transform: rotate(-8deg); } 100% { transform: rotate(-368deg); } }
        @keyframes hero-globe-ring-spin-b { 0% { transform: rotate(11deg); } 100% { transform: rotate(371deg); } }
        @keyframes hero-globe-pulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
