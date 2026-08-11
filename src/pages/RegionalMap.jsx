/**
 * src/pages/RegionalMap.jsx — where this brand's creators actually are.
 *
 * The map is monochrome by default: one accent hue, depth of tint = creator
 * density. Six competing region colours made the country read as a political
 * map rather than a data one — you had to consult a legend to learn something
 * the shading already told you. "Regional colours" restores the hues for the
 * cases where the regional split IS the question.
 *
 * Panning, the drill-down into a state/region and the per-campaign creator
 * lists are unchanged. Every figure comes from regionalRollup() in
 * lib/portalMetrics.js, over the same payload the rest of the portal reads —
 * so the creator count here can no longer disagree with the Overview's.
 */
import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionTemplate, useReducedMotion } from "motion/react";
import { MapPin, Users, Wallet, Megaphone } from "lucide-react";

import { useApp } from "../context";
import { usePortalCampaigns } from "../lib/usePortalData";
import { fmtNum, fmtINR, initials } from "../lib/format";
import { STATES_META, REGION_COLORS as RC, REGION_NAMES as RN } from "../lib/geo";
import { PATHS } from "../lib/indiaPaths";
import { PHASE_LABELS as PL, phaseColors } from "../lib/phases";
import { flattenCreators, regionalRollup } from "../lib/portalMetrics";
import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState } from "../components/PageStates";
import AnimatedNumber from "../components/AnimatedNumber";
import { AmbientBackground } from "../components/motion/Motion";
import { Panel, Subpanel, PanelEmpty } from "../components/portal/Shell";

/* Language tints, used only when "Regional colours" is on. Drawn from the
   theme palette so the alternate view still matches the rest of the portal. */
const LC = {"Hindi":"#2C3E7E","Tamil":"#17915A","Telugu":"#A2489A","Kannada":"#A8720C","Malayalam":"#6C55CE","Bengali":"#96792A","Marathi":"#BE3A3A","Gujarati":"#178E80","Punjabi":"#5B6FA3","Odia":"#4FA97E","Assamese":"#9B85DE","English":"#6F6A5A","Kashmiri":"#6E86C4","Konkani":"#C27FBA","Nepali":"#55B3A6","Meitei":"#8A6FD0","Khasi":"#2FA98F","Mizo":"#7D93CF"};

const MODES = [["state", "States"], ["region", "Regions"], ["language", "Languages"]];

/* Centroid calculator */
function centroid(path){const nums=path.replace(/[MLZHVCSQTA]/gi," ").trim().split(/[\s,]+/).map(Number).filter(n=>!isNaN(n));let cx=0,cy=0,n=0;for(let i=0;i<nums.length;i+=2){cx+=nums[i];cy+=nums[i+1];n++;}return n?[cx/n,cy/n]:[0,0];}

/* Precomputed once at module load — centroid() parses hundreds of coordinates
   per state, so doing it per-render made every hover re-render expensive.
   The length floor drops the offshore-island stubs (ld, dd) whose paths are
   zero-area placeholders that would render as invisible, unhoverable slivers. */
const STATE_IDS = Object.keys(PATHS).filter(id => STATES_META[id] && PATHS[id] && PATHS[id].length >= 20);
const CENTROIDS = Object.fromEntries(STATE_IDS.map(id => [id, centroid(PATHS[id])]));
/* All states merged into one path string — the extruded slab + base render as
   a single <path> each instead of ~35 elements per layer. */
const MERGED_PATH = STATE_IDS.map(id => PATHS[id]).join(" ");

/* Ambient particles floating above the map slab — parallax via translateZ */
const PARTICLES = [
  { x: "12%", y: "18%", z: 50, s: 5, c: "north",     d: 0 },
  { x: "78%", y: "12%", z: 80, s: 4, c: "east",      d: -4 },
  { x: "88%", y: "48%", z: 40, s: 6, c: "south",     d: -9 },
  { x: "8%",  y: "62%", z: 70, s: 4, c: "west",      d: -13 },
  { x: "70%", y: "82%", z: 55, s: 5, c: "south",     d: -6 },
  { x: "30%", y: "88%", z: 85, s: 3, c: "central",   d: -16 },
  { x: "50%", y: "6%",  z: 65, s: 4, c: "northeast", d: -11 },
  { x: "20%", y: "38%", z: 90, s: 3, c: "central",   d: -2 },
];

/* ═══ SVG MAP ═══════════════════════════════════════════════════════════════
   One hue, depth = density (or the region/language hues when `tinted`).
   Hover state lives inside this component so moving the cursor over the map
   never re-renders the page around it. */
function IndiaMap({ mode, stateData, selectedId, onSelect, onHover, tinted, P }) {
  const isLang = mode === "language";
  const isRegion = mode === "region";
  const maxCr = Math.max(1, ...Object.values(stateData).map(d => d.creators));
  const outline = `${P.text}47`;   // hairline between states — flips with theme
  const landFill = P.raised;       // opaque base silhouette under the washes
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const [hovId, setHovId] = useState(null);

  /* The one hue everything is painted in, unless regional colours are on. */
  const colorOf = (meta) =>
    !tinted ? P.accent : isLang ? (LC[meta.lang] || P.mute) : RC[meta.region];

  /* Spring-driven tilt with inertia — the map keeps drifting after the cursor
     stops, which is what sells the "3D scene" feel */
  const rx = useSpring(0, { stiffness: 110, damping: 16, mass: 0.6 });
  const ry = useSpring(0, { stiffness: 110, damping: 16, mass: 0.6 });
  const glowX = useSpring(50, { stiffness: 140, damping: 22 });
  const glowY = useSpring(40, { stiffness: 140, damping: 22 });
  const specular = useMotionTemplate`radial-gradient(340px circle at ${glowX}% ${glowY}%, rgba(255,255,255,0.32), transparent 65%)`;

  /* Hover is reported upward so the pinned detail card can render it, and kept
     locally so only this component repaints as the cursor crosses states. */
  const setHov = (id) => { setHovId(id); onHover(id); };

  const handleMove = (e) => {
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    if (!reduced) { rx.set((0.5 - py) * 12); ry.set((px - 0.5) * 14); }
    glowX.set(px * 100); glowY.set(py * 100);
  };
  const handleLeave = () => { rx.set(0); ry.set(0); glowX.set(50); glowY.set(40); setHov(null); };

  /* Cinematic zoom: selecting a state (or region) eases the "camera" toward it.
     Depends only on stable values so the spring target doesn't churn identity
     every render (which restarted the animation and made the map feel stuck). */
  const zoom = useMemo(() => {
    if (!selectedId) return { scale: 1, x: 0, y: 0 };
    const targets = isRegion
      ? STATE_IDS.filter(id => STATES_META[id].region === selectedId)
      : [selectedId];
    const pts = targets.map(id => CENTROIDS[id]).filter(Boolean);
    if (!pts.length) return { scale: 1, x: 0, y: 0 };
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const s = isRegion ? 1.32 : 1.75;
    // transform-origin is the viewBox centre (240,280): translate the target
    // centroid there, accounting for the scale applied about that origin.
    return { scale: s, x: (240 - cx) * s, y: (280 - cy) * s };
  }, [selectedId, isRegion]);
  const zoomSpring = { type: "spring", stiffness: 170, damping: 26 };

  /* One merged dark silhouette = the extruded "slab" under the map (a single
     <path> per layer instead of ~35 elements) */
  const slab = (z, op, blur) => (
    <svg viewBox="0 0 480 560" aria-hidden
      className="pointer-events-none absolute inset-0 mx-auto block w-full"
      style={{ transform: `translateZ(${z}px)`, filter: blur ? `blur(${blur}px)` : undefined, opacity: op }}>
      <motion.g animate={zoom} transition={zoomSpring} style={{ transformBox: "view-box", transformOrigin: "240px 280px" }}>
        <path d={MERGED_PATH} fill="#000" />
      </motion.g>
    </svg>
  );

  return (
    <div ref={wrapRef} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{ perspective: "1600px" }} className="relative mx-auto w-full max-w-[640px]">

      {/* DECORATIVE 3D layer — glow bed, extruded slabs, specular sheen,
          drifting particles. Purely cosmetic (pointer-events-none throughout),
          so its spring-driven lag never has to agree with where a click lands. */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
        <div className="absolute inset-x-10 top-10 -z-10 h-[78%] rounded-[50%] bg-accent/[0.14] blur-[70px]" style={{ transform: "translateZ(-70px)" }} />
        {slab(-18, 0.07, 3)}
        {slab(-9, 0.13)}
        <div className="absolute inset-0 mix-blend-soft-light" style={{ background: specular, transform: "translateZ(4px)" }} />
        {!reduced && PARTICLES.map((p, i) => (
          <span key={i} className="ambient-blob absolute rounded-full"
            style={{ left: p.x, top: p.y, width: p.s, height: p.s, background: tinted ? RC[p.c] : P.accent,
              opacity: 0.35, transform: `translateZ(${p.z}px)`, animationDelay: `${p.d}s`, filter: "blur(0.5px)" }} />
        ))}
      </motion.div>

      {/* INTERACTIVE layer — deliberately flat (no tilt). What you see here is
          always exactly what you can click. */}
      <svg viewBox="0 0 480 560" className="relative mx-auto block w-full drop-shadow-[0_30px_50px_rgba(25,22,17,0.16)]">
        <rect width="480" height="560" fill="transparent" onClick={() => selectedId && onSelect(null)} />
        <motion.g animate={zoom} transition={zoomSpring} style={{ transformBox: "view-box", transformOrigin: "240px 280px" }}>
          {/* opaque warm base silhouette — hides the slab beneath so state
              washes stay warm; the extrusion only peeks out at the edges */}
          <path d={MERGED_PATH} fill={landFill} stroke={landFill} strokeWidth={0.6} />
          {STATE_IDS.map((id, i) => {
            const meta = STATES_META[id], data = stateData[id], path = PATHS[id];
            const isSel = selectedId === id || (isRegion && selectedId === meta.region);
            const isHov = hovId === id;
            const has = data?.creators > 0;
            const baseColor = colorOf(meta);
            // Monochrome mode leans harder on density so one hue still ranks
            // the country; tinted mode keeps the flatter washes it needs to
            // stay legible with six competing colours.
            const intensity = has
              ? (isRegion || isLang ? (tinted ? 0.38 : 0.34) : (tinted ? 0.22 : 0.14) + (data.creators / maxCr) * (tinted ? 0.55 : 0.72))
              : (isRegion || isLang ? 0.10 : 0.05);
            const dimmed = selectedId && !isSel;
            // Hover lifts a state enough to confirm what you're pointing at,
            // but an EMPTY state only lifts a little: giving it the same
            // emphasis as a populated one made states with no creators read as
            // the brand's strongest markets on the way past.
            const fillOp = isSel ? 0.85
              : isHov ? Math.max(intensity, has ? 0.55 : 0.2)
              : dimmed ? intensity * 0.4
              : intensity;
            const [cx, cy] = CENTROIDS[id];
            const showLabel = isSel || isHov || ["rj","up","mp","mh","gj","ka","tn","ap","tg","wb","or","as","jk","ct","br","jh","kl","hr","pb"].includes(id);
            // Once zoomed in, other states stop being directly clickable — you
            // back out first (Back button, or clicking the empty map).
            const locked = selectedId && !isSel;
            return (
              <g key={id}
                onClick={() => { if (locked) return; onSelect(isRegion ? meta.region : id); }}
                onPointerEnter={() => setHov(id)}
                onPointerLeave={() => setHov(hovId === id ? null : hovId)}
                style={{ cursor: locked ? "default" : "pointer" }}>
                {/* Hit target + colour wash — geometry NEVER changes on
                    hover/select, only paint. Letting the interactive element
                    shift shape under the cursor is what caused the old "stuck
                    hover" bug near state borders. */}
                <motion.path d={path} fill={baseColor}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, fillOpacity: fillOp, strokeOpacity: isSel ? 0.95 : isHov ? 0.85 : dimmed ? 0.35 : 0.6 }}
                  transition={{ opacity: { delay: 0.15 + i * 0.014, duration: 0.4 }, fillOpacity: { type: "spring", stiffness: 300, damping: 28 }, strokeOpacity: { type: "spring", stiffness: 300, damping: 28 } }}
                  stroke={isSel || isHov ? baseColor : outline}
                  strokeWidth={isSel ? 1.8 : isHov ? 1.3 : 0.5} />
                {/* Cosmetic "lift" overlay — pointer-events-none twin of the
                    same path, so it can scale freely without hit-testing. */}
                <AnimatePresence>
                  {(isHov || isSel) && (
                    <motion.path key={`${id}-lift`} d={path} fill="none" pointerEvents="none"
                      stroke={baseColor} strokeWidth={isSel ? 1.8 : 1.3}
                      initial={{ opacity: 0, scale: 1 }} exit={{ opacity: 0, scale: 1 }}
                      animate={{ opacity: 1, scale: isSel ? 1.015 : 1.022, y: isSel ? 0 : -1.5 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      style={{ transformBox: "fill-box", transformOrigin: "center",
                        filter: isSel ? `drop-shadow(0 0 10px ${baseColor}70) drop-shadow(0 6px 10px rgba(25,22,17,0.25))` : "drop-shadow(0 4px 8px rgba(25,22,17,0.2))" }} />
                  )}
                </AnimatePresence>
                {showLabel && (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                    fill={isSel || isHov ? P.text : P.sub} fontSize={isSel ? 9.5 : 7.5}
                    fontWeight={isSel ? 700 : 500} fontFamily="'Sora'" pointerEvents="none"
                    style={{ textShadow: isSel ? `0 0 5px ${P.bg}` : "", transition: "all 0.2s", opacity: dimmed ? 0.35 : 1 }}>
                    {id.toUpperCase()}
                  </text>
                )}
                {has && !isSel && (
                  <g pointerEvents="none" style={{ opacity: dimmed ? 0.3 : 1, transition: "opacity 0.3s" }}>
                    <motion.circle cx={cx + 14} cy={cy - 10} fill={baseColor} opacity={0.92}
                      animate={{ r: isHov ? 7.5 : 6.5 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      style={{ filter: isHov ? `drop-shadow(0 3px 6px ${baseColor}80)` : "" }} />
                    <text x={cx + 14} y={cy - 10} textAnchor="middle" dominantBaseline="central"
                      fill="#fff" fontSize={7} fontWeight={700} fontFamily="'Sora'">{data.creators}</text>
                  </g>
                )}
              </g>
            );
          })}
        </motion.g>
      </svg>
    </div>
  );
}

/* ═══ SIDE PANELS ═══════════════════════════════════════════════════════════ */

/** Ranked list row — the shared shape behind the states and languages lists. */
function RankRow({ color, title, sub, stats, share, onClick, index = 0 }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      className="anim-up group mb-2 block w-full rounded-[16px] border border-line bg-[--color-glass] px-4 py-3 text-left shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]"
      style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-3">
        <span className="relative flex size-8 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
          <Dot color={color} sz={8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">{title}</span>
          {sub && <span className="mt-px block truncate text-[10.5px] text-sub">{sub}</span>}
        </span>
        {stats.map(([label, value, tone]) => (
          <span key={label} className="min-w-[52px] text-right">
            <span className={`tnum block text-[15px] font-bold ${tone}`}>{value}</span>
            <span className="block text-[9px] uppercase text-mute">{label}</span>
          </span>
        ))}
        {onClick && <span className="text-[13px] text-mute opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">→</span>}
      </div>
      {share != null && (
        <span className="mt-2.5 block h-[5px] overflow-hidden rounded-full bg-well">
          <span className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${share}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
        </span>
      )}
    </Tag>
  );
}

function StatesPanel({ stateData, onSelect, colorOf }) {
  const rows = Object.entries(stateData).filter(([, d]) => d.creators > 0).sort((a, b) => b[1].creators - a[1].creators);
  if (!rows.length) return <PanelEmpty>No creators have a location on file yet.</PanelEmpty>;
  const peak = rows[0][1].creators;
  return (
    <div>
      <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">States with creators — click to drill down</div>
      {rows.map(([code, d], i) => {
        const m = STATES_META[code];
        return (
          <RankRow key={code} index={i} color={colorOf(m)} title={m.name} sub={`${RN[m.region]} · ${m.lang}`}
            share={(d.creators / peak) * 100} onClick={() => onSelect(code)}
            stats={[
              ["creators", <AnimatedNumber key="c" value={d.creators} />, "text-accent"],
              ["campaigns", <AnimatedNumber key="k" value={d.campaigns} />, "text-green"],
              ["followers", d.followers ? fmtNum(d.followers) : "—", "text-ink"],
            ]} />
        );
      })}
    </div>
  );
}

function LangPanel({ langData, colorOf }) {
  const rows = Object.entries(langData).sort((a, b) => b[1].creators - a[1].creators);
  if (!rows.length) return <PanelEmpty>No creator language data yet.</PanelEmpty>;
  return (
    <div>
      <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Language distribution</div>
      {rows.map(([lang, d], i) => (
        <RankRow key={lang} index={i} color={colorOf({ lang })} title={lang}
          stats={[
            ["campaigns", <AnimatedNumber key="k" value={d.campaigns} />, "text-accent"],
            ["creators", <AnimatedNumber key="c" value={d.creators} />, "text-green"],
            ["followers", d.followers ? fmtNum(d.followers) : "—", "text-ink"],
          ]} />
      ))}
    </div>
  );
}

/* Campaign card in the drill panel — expands inline to list the creators this
   campaign has in the selected state/region. */
function CampCard({ c, i, scope, open, onToggle, onOpenCampaign, colorOf, P }) {
  const pc = phaseColors(P);
  const here = c.creators.filter(cr => scope.type === "state" ? cr.stateCode === scope.id : cr.region === scope.id);
  return (
    <Subpanel className="anim-up mb-2 overflow-hidden transition-all duration-200 ease-out hover:shadow-[0_12px_28px_rgba(25,22,17,0.09)]" style={{ animationDelay: `${i * 30}ms` }}>
      <button className="group w-full px-4 py-3 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h4 className="text-[13px] font-medium text-ink transition-colors group-hover:text-accent">{c.name}</h4>
            <span className="text-[10px] uppercase tracking-[0.04em] text-accent">{c.service}</span>
          </div>
          <div className="flex items-center gap-1">
            <Dot color={pc[c.phase] || P.mute} />
            <span className="text-[11px] text-sub">{PL[c.phase]}</span>
            <span className="tnum text-[11px] font-semibold" style={{ color: pc[c.phase] }}>{c.progress}%</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-sub">Budget {fmtINR(c.budget)}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-accent">
            {here.length} creator{here.length === 1 ? "" : "s"} here
            <span className={`text-[9px] transition-transform duration-200 ${open ? "-rotate-180" : ""}`}>▾</span>
          </span>
        </div>
      </button>
      {open && (
        <div className="fi border-t border-line">
          {here.map((cr, j) => (
            <div key={`${cr.key}-${j}`} className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 transition-colors duration-150 hover:bg-accent/[0.03]">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: colorOf(STATES_META[cr.stateCode]) }}>
                {initials(cr.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-ink">{cr.name}</span>
                <span className="block text-[10px] text-sub">{cr.niche || "—"} · {cr.state}</span>
              </span>
              <span className="text-right">
                <span className="tnum block text-[11.5px] font-semibold text-accent">{cr.followers ? fmtNum(cr.followers) : "—"}</span>
                <span className="block text-[8.5px] uppercase tracking-[0.06em] text-mute">followers</span>
              </span>
              <span className="min-w-[44px] text-right">
                <span className="tnum block text-[11.5px] font-semibold text-pink">{cr.er != null ? `${cr.er.toFixed(1)}%` : "—"}</span>
                <span className="block text-[8.5px] uppercase tracking-[0.06em] text-mute">avg er</span>
              </span>
            </div>
          ))}
          <button onClick={onOpenCampaign} className="block w-full px-4 py-2.5 text-center text-[11.5px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/[0.05]">
            Open campaign page →
          </button>
        </div>
      )}
    </Subpanel>
  );
}

function DrillPanel({ type, id, data, onBack, onOpenCampaign, colorOf, P }) {
  const { stateData, regionData, campaigns } = data;
  const [openCamp, setOpenCamp] = useState(null);
  const isState = type === "state";
  const meta = isState ? STATES_META[id] : null;
  const d = isState ? stateData[id] : regionData[id];
  if (!d || (isState && !meta)) return null;

  const color = colorOf(meta || { region: id, lang: "" });
  const camps = campaigns.filter(c => (isState ? c.states.has(id) : c.regions.has(id)));
  const statesInRegion = isState ? [] : Object.entries(STATES_META).filter(([, m]) => m.region === id);

  return (
    <div className="au">
      <button onClick={onBack} className="mb-3 flex items-center gap-1 rounded-full border border-line bg-well/70 px-3 py-1.5 text-[11px] text-sub transition-all duration-150 hover:-translate-x-0.5 hover:text-ink">← Back</button>

      <Subpanel className="mb-3 flex items-center gap-2.5 px-4 py-3">
        <span className="relative flex size-9 items-center justify-center">
          <span className="pulse absolute inset-0 rounded-full opacity-25" style={{ background: color }} />
          <Dot color={color} sz={9} />
        </span>
        <h3 className="font-serif text-[19px] font-semibold italic text-ink">{isState ? meta.name : `${RN[id]} India`}</h3>
        {isState && <span className="text-[11px] text-sub">{RN[meta.region]} · {meta.lang}</span>}
      </Subpanel>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[["Campaigns", d.campaigns], ["Creators", d.creators], ["Followers", d.followers ? fmtNum(d.followers) : "—"]].map(([l, v], i) => (
          <Subpanel key={l} className="anim-up px-3.5 py-3" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div>
            <div className={`tnum mt-1 text-[19px] font-bold ${v && v !== "—" ? "text-ink" : "text-donetxt"}`}>{v}</div>
          </Subpanel>
        ))}
      </div>

      {!isState && (
        <>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">State breakdown</div>
          <Subpanel className="mb-4 overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 border-b border-line bg-black/[0.015] px-3.5 py-2">
              {["State", "Camp.", "Creators", "Followers"].map(h => <span key={h} className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mute">{h}</span>)}
            </div>
            {statesInRegion.map(([sid, m], i) => {
              const s = stateData[sid];
              return (
                <div key={sid} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 px-3.5 py-2.5 transition-colors duration-150 hover:bg-accent/[0.03] ${i < statesInRegion.length - 1 ? "border-b border-line" : ""}`}>
                  <span className="text-[12px] font-medium text-ink">{m.name}</span>
                  <span className={`tnum text-[12px] ${s.campaigns ? "text-ink" : "text-donetxt"}`}>{s.campaigns}</span>
                  <span className={`tnum text-[12px] ${s.creators ? "text-ink" : "text-donetxt"}`}>{s.creators}</span>
                  <span className={`tnum text-[12px] ${s.followers ? "text-ink" : "text-donetxt"}`}>{s.followers ? fmtNum(s.followers) : "—"}</span>
                </div>
              );
            })}
          </Subpanel>
        </>
      )}

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaigns with creators here — tap to see who</div>
      {camps.length
        ? camps.map((c, i) => (
            <CampCard key={c.id} c={c} i={i} scope={{ type, id }} open={openCamp === c.id}
              onToggle={() => setOpenCamp(openCamp === c.id ? null : c.id)}
              onOpenCampaign={() => onOpenCampaign(c)} colorOf={colorOf} P={P} />
          ))
        : <PanelEmpty>No campaigns reach here yet.</PanelEmpty>}
    </div>
  );
}

/* ═══ PAGE ═══════════════════════════════════════════════════════════════ */

export default function RegionalMap() {
  const { P, setPage } = useApp();
  const [mode, setMode] = useState("state");
  const [sel, setSel] = useState(null);
  const [selType, setSelType] = useState(null);
  const [hovId, setHovId] = useState(null);
  const [tinted, setTinted] = useState(false);   // "Regional colours"
  const { data: campaigns, error, retry } = usePortalCampaigns();

  const data = useMemo(() => {
    if (!campaigns) return null;
    return regionalRollup(campaigns, flattenCreators(campaigns));
  }, [campaigns]);

  const colorOf = useMemo(
    () => (meta) => !tinted ? P.accent : mode === "language" ? (LC[meta?.lang] || P.mute) : (RC[meta?.region] || P.accent),
    [tinted, mode, P],
  );

  const handleSelect = (id) => {
    if (id == null) { setSel(null); setSelType(null); return; }
    setSel(id); setSelType(mode === "region" ? "region" : "state");
  };
  const handleBack = () => { setSel(null); setSelType(null); };
  const switchMode = (m) => { setMode(m); setSel(null); setSelType(null); };

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <PageSkeleton />;

  const t = data.totals;
  const hovMeta = hovId ? STATES_META[hovId] : null;
  const hovData = hovId ? data.stateData[hovId] : null;

  const KPIS = [
    { label: "Campaigns", value: t.campaigns, format: Math.round, Icon: Megaphone },
    { label: "Reach", value: t.followers, format: fmtNum, Icon: Users },
    { label: "Creators", value: t.creators, format: Math.round, Icon: MapPin },
    { label: "Budget", value: t.budget, format: fmtINR, Icon: Wallet },
  ];

  return (
    <div className="relative min-h-screen w-full bg-page font-sans text-ink">
      <AmbientBackground variant="b" />

      <div className="mx-auto max-w-[1600px] px-5 pb-12 sm:px-9">
        <header className="pb-5 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="microlabel mb-1.5 tracking-[0.2em]">Regional</div>
              <h1 className="font-serif text-[clamp(30px,4vw,42px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Reach across India</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-sub">
                {[[t.creators, "creator", "mapped"], [t.states, "state", ""], [t.regions, "region", ""], [t.languages, "language", ""]].map(([n, noun, suffix], i) => (
                  <span key={noun} className="fi rounded-full border border-line bg-[--color-glass] px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{ animationDelay: `${i * 60}ms` }}>
                    <b className="tnum text-ink"><AnimatedNumber value={n} /></b> {noun}{n === 1 ? "" : "s"}{suffix ? ` ${suffix}` : ""}
                  </span>
                ))}
                {data.unplaced > 0 && <span className="text-mute">{data.unplaced} without a location yet</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Regional colours — off by default; the map ranks by density in
                  one hue, and this brings the six region colours back. */}
              <button
                onClick={() => setTinted(v => !v)}
                role="switch"
                aria-checked={tinted}
                className="flex items-center gap-2 rounded-full border border-line bg-[--color-glass] py-1.5 pl-1.5 pr-3.5 text-[12px] font-medium text-sub shadow-sm backdrop-blur-sm transition-colors hover:text-ink"
              >
                <span className={`relative h-[18px] w-[32px] rounded-full transition-colors duration-200 ${tinted ? "bg-accent" : "bg-well"}`}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    className="absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm"
                    style={{ left: tinted ? 16 : 2 }} />
                </span>
                Regional colours
              </button>

              <div className="flex gap-1 rounded-full border border-line bg-[--color-glass] p-1.5 shadow-[0_1px_10px_rgba(25,22,17,0.04)] backdrop-blur-xl">
                {MODES.map(([k, l]) => (
                  <button key={k} onClick={() => switchMode(k)}
                    className={`relative rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors duration-200 ease-out ${mode === k ? "text-white" : "text-sub hover:text-ink"}`}>
                    {mode === k && <motion.span layoutId="regional-mode" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-accent shadow-[0_4px_14px_rgba(44,62,126,0.35)]" />}
                    <span className="relative">{l}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI strip — the account totals behind the map */}
          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {KPIS.map(({ label, value, format, Icon }, i) => (
              <Panel key={label} reveal delay={i * 0.05} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-accent/[0.08] text-accent">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span>
                  <span className="microlabel block">{label}</span>
                  <span className="tnum mt-0.5 block text-[20px] font-bold leading-none text-ink">
                    {value ? <AnimatedNumber value={value} format={format} /> : "—"}
                  </span>
                </span>
              </Panel>
            ))}
          </div>
        </header>

        <div className="grid min-h-[56vh] items-start gap-6 pb-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          {/* Map — the centrepiece: large, borderless, sticky while the rail scrolls */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="relative top-28 self-start px-2 py-4 lg:sticky">

            {/* Pinned hover card — reads like a caption on the map rather than a
                tooltip chasing the cursor. Reserves its height so the map
                doesn't jump as you move on and off the country. */}
            <div className="pointer-events-none absolute left-2 top-4 z-20 min-h-[62px]">
              <AnimatePresence>
                {hovMeta && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="glass-panel rounded-[14px] px-4 py-2.5">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Dot color={colorOf(hovMeta)} sz={6} />{hovMeta.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-sub">
                      {hovData?.creators || 0} creator{(hovData?.creators || 0) === 1 ? "" : "s"}
                      {hovData?.followers ? <> · <b className="tnum text-ink">{fmtNum(hovData.followers)}</b> reach</> : null}
                    </div>
                    <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-mute">{RN[hovMeta.region]} · {hovMeta.lang}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <IndiaMap mode={mode} stateData={data.stateData} selectedId={sel}
              onSelect={handleSelect} onHover={setHovId} tinted={tinted} P={P} />

            <div className="mt-4 min-h-4 text-center text-[12px] text-mute transition-all duration-200">
              {mode === "state" ? "Deeper tint = more creators · move the cursor to tilt · click a state to zoom in"
                : mode === "region" ? "Click to zoom into a region"
                : "Grouped by each creator's primary language"}
            </div>

            {tinted && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {(mode === "language"
                  ? Object.entries(data.langData).sort((a, b) => b[1].creators - a[1].creators).slice(0, 6).map(([l, d]) => [l, l, LC[l] || P.mute, d.creators])
                  : Object.entries(RN).map(([r, label]) => [r, label, RC[r], data.regionData[r]?.creators || 0])
                ).map(([key, label, color, n], i) => (
                  <span key={key} className={`fi flex items-center gap-1.5 rounded-full border border-line bg-[--color-glass] px-2.5 py-1 text-[10.5px] shadow-sm backdrop-blur-sm ${n ? "text-sub" : "text-donetxt"}`} style={{ animationDelay: `${i * 40}ms` }}>
                    <Dot color={color} sz={6} /><span className={n ? "" : "opacity-45"}>{label}</span>
                    {n > 0 && <b className="tnum text-ink">{n}</b>}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Side rail — differs per view; crossfades between drill levels */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={sel && selType ? `${selType}-${sel}` : mode}
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                {sel && selType ? (
                  <DrillPanel type={selType} id={sel} data={data} onBack={handleBack}
                    onOpenCampaign={(c) => setPage("campaigns", { campaignId: c.id })} colorOf={colorOf} P={P} />
                ) : mode === "language" ? (
                  <LangPanel langData={data.langData} colorOf={colorOf} />
                ) : mode === "state" ? (
                  <StatesPanel stateData={data.stateData} onSelect={(code) => { setSel(code); setSelType("state"); }} colorOf={colorOf} />
                ) : (
                  <div>
                    <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Regions — click to drill down</div>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
                      {Object.entries(data.regionData).filter(([, d]) => d.creators > 0).map(([r, d], i) => (
                        <button key={r} onClick={() => { setSel(r); setSelType("region"); }}
                          className="anim-up group cursor-pointer rounded-[16px] border border-line bg-[--color-glass] px-4 py-3.5 text-left shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]"
                          style={{ animationDelay: `${i * 30}ms` }}>
                          <span className="mb-2.5 flex items-center gap-1.5">
                            <span className="relative flex size-6 items-center justify-center">
                              <span className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-150" style={{ background: colorOf({ region: r }) }} />
                              <Dot color={colorOf({ region: r })} sz={6} />
                            </span>
                            <span className="text-[13.5px] font-semibold text-ink">{RN[r]}</span>
                            <span className="tnum ml-auto text-[12.5px] font-semibold" style={{ color: colorOf({ region: r }) }}>{d.campaigns}</span>
                          </span>
                          <span className="grid grid-cols-2 gap-1">
                            {[["Creators", d.creators], ["Followers", d.followers ? fmtNum(d.followers) : "—"]].map(([l, v]) => (
                              <span key={l} className="block">
                                <span className="block text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</span>
                                <span className="tnum mt-px block text-[13px] font-semibold text-ink">{v}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                      ))}
                      {!Object.values(data.regionData).some(d => d.creators > 0) && <PanelEmpty>No creators have a location on file yet.</PanelEmpty>}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
