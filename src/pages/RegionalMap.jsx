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
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Users, Wallet, Megaphone } from "lucide-react";

import { useApp } from "../context";
import { usePortalCampaigns } from "../lib/usePortalData";
import { fmtNum, fmtINR, initials } from "../lib/format";
import { STATES_META, regionColors, REGION_NAMES as RN } from "../lib/geo";
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

/* Centroid + bounding box, from the same single parse. The paths are pure
   M/L/Z, so every number is a coordinate — the bbox is what lets the hover
   card sit beside a state's edge instead of on top of its middle. */
function geometry(path){const nums=path.replace(/[MLZHVCSQTA]/gi," ").trim().split(/[\s,]+/).map(Number).filter(n=>!isNaN(n));let cx=0,cy=0,n=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<nums.length;i+=2){const x=nums[i],y=nums[i+1];cx+=x;cy+=y;n++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return n?{c:[cx/n,cy/n],x0,y0,x1,y1}:{c:[0,0],x0:0,y0:0,x1:0,y1:0};}

/* Precomputed once at module load — centroid() parses hundreds of coordinates
   per state, so doing it per-render made every hover re-render expensive.
   The length floor drops the offshore-island stubs (ld, dd) whose paths are
   zero-area placeholders that would render as invisible, unhoverable slivers. */
const STATE_IDS = Object.keys(PATHS).filter(id => STATES_META[id] && PATHS[id] && PATHS[id].length >= 20);
const GEO = Object.fromEntries(STATE_IDS.map(id => [id, geometry(PATHS[id])]));
const CENTROIDS = Object.fromEntries(STATE_IDS.map(id => [id, GEO[id].c]));
/* All states merged into one path string — the base silhouette renders as a
   single <path> instead of ~35 elements. */
const MERGED_PATH = STATE_IDS.map(id => PATHS[id]).join(" ");

/* ═══ SVG MAP ═══════════════════════════════════════════════════════════════
   One hue, depth = density (or the region/language hues when `tinted`).

   Deliberately flat: a state is picked out by paint alone. The map used to sit
   on an extruded slab under a cursor-driven tilt, with a specular sheen and
   drifting particles — none of which carried data, and the tilt meant the
   shape you aimed at was a spring-lagged copy of the shape that took the
   click. What you see now is exactly what you can click.

   Hover state lives inside this component so moving the cursor over the map
   never re-renders the page around it. */
function IndiaMap({ mode, stateData, selectedId, onSelect, tinted, P }) {
  const isLang = mode === "language";
  const isRegion = mode === "region";
  const maxCr = Math.max(1, ...Object.values(stateData).map(d => d.creators));
  const outline = `${P.text}47`;   // hairline between states — flips with theme
  const [hovId, setHovId] = useState(null);

  /* The one hue everything is painted in, unless regional colours are on. */
  const RC = regionColors(P);
  const colorOf = (meta) =>
    !tinted ? P.accent : isLang ? (LC[meta.lang] || P.mute) : RC[meta.region];

  /* Hover lives here and nowhere else: the detail card is rendered inside this
     component too, so crossing states never re-renders the page around it. */
  const setHov = setHovId;

  /* Selecting a state (or region) eases the "camera" toward it. Depends only
     on stable values so the spring target doesn't churn identity every render
     (which restarted the animation and made the map feel stuck). */
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

  /* The card that names what you're pointing at. It rides beside the state
     itself rather than parking in the map's top-left corner — you read the
     name without your eye ever leaving the shape it belongs to.

     Anchored in the SVG's own coordinates, then expressed as a percentage of
     the map box, so it follows the zoom: the group is drawn as
     translate(x,y)·scale(s) about (240,280), so a point p lands at
     240 + x + s·(p − 240). The clamp keeps a card whose state has been
     pushed near the edge by the zoom from hanging off the map. */
  const focusId = hovId || (!isRegion && selectedId) || null;
  const focusMeta = focusId ? STATES_META[focusId] : null;
  const focusData = focusId ? stateData[focusId] : null;
  const card = useMemo(() => {
    const g = focusId && GEO[focusId];
    if (!g) return null;
    const toX = (x) => 240 + zoom.x + zoom.scale * (x - 240);
    const toY = (y) => 280 + zoom.y + zoom.scale * (y - 280);
    // Flip to whichever side has room, and hang the card off the state's own
    // bounding edge — anchoring on the centroid laid it across Rajasthan and
    // Madhya Pradesh, the two shapes wide enough to swallow it whole.
    const flip = toX(g.c[0]) > 240;
    const ax = flip ? toX(g.x0) - 9 : toX(g.x1) + 9;
    return {
      flip,
      x: Math.min(97, Math.max(3, (ax / 480) * 100)),
      y: Math.min(90, Math.max(7, (toY(g.c[1]) / 560) * 100)),
    };
  }, [focusId, zoom]);

  const SLIDE = { type: "spring", stiffness: 400, damping: 36 };

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <svg viewBox="0 0 480 560" onMouseLeave={() => setHov(null)}
        className="block w-full">
        <rect width="480" height="560" fill="transparent" onClick={() => selectedId && onSelect(null)} />
        <motion.g animate={zoom} transition={{ type: "spring", stiffness: 170, damping: 26 }}
          style={{ transformBox: "view-box", transformOrigin: "240px 280px" }}>
          {/* One merged silhouette under the washes, so an unpopulated state
              still reads as part of the country rather than as a hole. */}
          <path d={MERGED_PATH} fill={P.raised} stroke={P.raised} strokeWidth={0.6} />
          {STATE_IDS.map((id, i) => {
            const meta = STATES_META[id], data = stateData[id];
            const isSel = selectedId === id || (isRegion && selectedId === meta.region);
            const isHov = hovId === id;
            const has = data?.creators > 0;
            const baseColor = colorOf(meta);
            // With the count bubble gone the fill IS the number, so every
            // mode ramps by creator density now — the region and language
            // views used to be a flat wash that said only "someone is here".
            // Monochrome leans hardest on it (one hue has to rank the whole
            // country); the tinted views stay flatter, which is what keeps six
            // competing colours legible against each other.
            const ramp = has ? data.creators / maxCr : 0;
            const intensity = has
              ? (isRegion || isLang
                  ? (tinted ? 0.26 : 0.22) + ramp * (tinted ? 0.50 : 0.45)
                  : (tinted ? 0.22 : 0.14) + ramp * (tinted ? 0.60 : 0.78))
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
            return (
              // Zoomed in, every other state stays live: clicking one moves the
              // camera straight there rather than making you back out first.
              <g key={id} className="cursor-pointer"
                onClick={() => onSelect(isRegion ? meta.region : id)}
                onPointerEnter={() => setHov(id)}
                onPointerLeave={() => setHov(null)}>
                {/* Geometry NEVER changes on hover/select, only paint. Letting
                    the interactive element shift shape under the cursor is what
                    caused the old "stuck hover" bug near state borders. */}
                <motion.path d={PATHS[id]} fill={baseColor}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, fillOpacity: fillOp }}
                  transition={{ opacity: { delay: 0.15 + i * 0.014, duration: 0.4 }, fillOpacity: { type: "spring", stiffness: 300, damping: 28 } }}
                  stroke={isSel || isHov ? baseColor : outline}
                  strokeWidth={isSel ? 1.8 : isHov ? 1.3 : 0.5} />
                {/* No count bubble — the depth of the fill carries the number,
                    and the exact figure is in the card that pins to whichever
                    state you are pointing at. What the bubble also did was give
                    a territory a few pixels wide something you could actually
                    hit, so that part stays as an invisible target. */}
                {has && <circle cx={cx} cy={cy} r={7} fill="transparent" pointerEvents="all" />}
              </g>
            );
          })}
        </motion.g>
      </svg>

      {/* One element that moves, NOT one per state: keyed by state it would
          remount on every hover, so the new copy played its entrance where
          the old one was still exiting. Keeping it mounted turns a switch
          between states into a glide from one to the next. */}
      <AnimatePresence>
        {focusMeta && card && (
          <motion.div key="focus-card" initial={false}
            animate={{ left: `${card.x}%`, top: `${card.y}%` }} transition={SLIDE}
            className="pointer-events-none absolute z-20">
            <motion.div initial={false} animate={{ x: card.flip ? "-100%" : "0%", y: "-50%" }} transition={SLIDE}>
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.14 }}
                style={{ transformOrigin: card.flip ? "right center" : "left center" }}
                className="glass-panel w-max max-w-[210px] rounded-[13px] px-3.5 py-2.5 shadow-[0_12px_30px_rgba(25,22,17,0.14)]">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <Dot color={colorOf(focusMeta)} sz={6} />{focusMeta.name}
                </div>
                <div className="mt-0.5 text-[11px] text-sub">
                  {focusData?.creators || 0} creator{(focusData?.creators || 0) === 1 ? "" : "s"}
                  {focusData?.followers ? <> · <b className="tnum text-ink">{fmtNum(focusData.followers)}</b> reach</> : null}
                </div>
                <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-mute">{RN[focusMeta.region]} · {focusMeta.lang}</div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ SIDE PANELS ═══════════════════════════════════════════════════════════ */

/** Ranked list row — the shared shape behind the states and languages lists. */
function RankRow({ color, title, sub, stats, share, onClick, index = 0 }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      // The row's colour is carried by the dot and its share bar alone. A
      // colour spine down the left edge as well said the same thing a third
      // time, and a stack of them read as a chart of stripes rather than a
      // ranked list.
      className="anim-up group relative mb-3 block w-full overflow-hidden rounded-[16px] border border-line bg-[--color-glass] px-5 py-4 text-left shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]"
      style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-4">
        <span className="relative flex size-9 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
          <Dot color={color} sz={9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{title}</span>
          {sub && <span className="mt-0.5 block truncate text-[10.5px] text-sub">{sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-5">
          {stats.map(([label, value, tone]) => (
            <span key={label} className="min-w-[58px] text-right">
              <span className={`tnum block text-[15px] font-bold ${tone}`}>{value}</span>
              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.06em] text-mute">{label}</span>
            </span>
          ))}
        </span>
        {onClick && <span className="shrink-0 text-[13px] text-mute opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">→</span>}
      </div>
      {share != null && (
        <span className="mt-3.5 block h-[6px] overflow-hidden rounded-full bg-well">
          <span className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(share, 2)}%`, background: color }} />
        </span>
      )}
    </Tag>
  );
}

function StatesPanel({ stateData, onSelect, colorOf }) {
  /* Ranked and sized by REACH, not by creator count. A brand with one creator
     per state — which is most of them early on — gave every row the same count
     and therefore a bar pinned at 100%, so the list ranked nothing and every
     row looked identical. Reach is the figure that actually separates them
     (12K against 213K), and it is what the panel's own KPI strip leads with.
     Falls back to creators while no follower counts are on file. */
  const rows = Object.entries(stateData).filter(([, d]) => d.creators > 0);
  if (!rows.length) return <PanelEmpty>No creators have a location on file yet.</PanelEmpty>;
  const byReach = rows.some(([, d]) => d.followers > 0);
  const rank = ([, d]) => (byReach ? d.followers : d.creators);
  rows.sort((a, b) => rank(b) - rank(a) || b[1].creators - a[1].creators);
  const peak = rank(rows[0]) || 1;
  return (
    <div>
      <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">
        States with creators · ranked by {byReach ? "reach" : "creators"} — click to drill down
      </div>
      {rows.map(([code, d], i) => {
        const m = STATES_META[code];
        return (
          <RankRow key={code} index={i} color={colorOf(m)} title={m.name} sub={`${RN[m.region]} · ${m.lang}`}
            share={(rank([code, d]) / peak) * 100} onClick={() => onSelect(code)}
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
  const [tinted, setTinted] = useState(false);   // "Regional colours"
  const { data: campaigns, error, retry } = usePortalCampaigns();

  const data = useMemo(() => {
    if (!campaigns) return null;
    return regionalRollup(campaigns, flattenCreators(campaigns));
  }, [campaigns]);

  const RC = useMemo(() => regionColors(P), [P]);
  const colorOf = useMemo(
    () => (meta) => !tinted ? P.accent : mode === "language" ? (LC[meta?.lang] || P.mute) : (RC[meta?.region] || P.accent),
    [tinted, mode, P, RC],
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

            <IndiaMap mode={mode} stateData={data.stateData} selectedId={sel}
              onSelect={handleSelect} tinted={tinted} P={P} />

            <div className="mt-4 min-h-4 text-center text-[12px] text-mute transition-all duration-200">
              {mode === "state" ? "Deeper tint = more creators · click a state to zoom in, or click another to move on"
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
