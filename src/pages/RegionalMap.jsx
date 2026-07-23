import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionTemplate, useReducedMotion } from "motion/react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI, phaseOf } from "../lib/api";
import { parseFollowers, fmtNum, fmtINR, initials } from "../lib/format";
import { STATES_META, stateCode, REGION_COLORS as RC, REGION_NAMES as RN } from "../lib/geo";
import { PATHS } from "../lib/indiaPaths";
import { PHASE_LABELS as PL, phaseColors } from "../lib/phases";
import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState } from "../components/PageStates";
import AnimatedNumber from "../components/AnimatedNumber";
import { AmbientBackground } from "../components/motion/Motion";

/* Shared count-up (extracted to components/AnimatedNumber during the redesign) */
const CountUp = AnimatedNumber;
// Language tints drawn from the theme palette (base hues + lighter tints)
// so the language view matches the rest of the portal.
const LC = {"Hindi":"#2C3E7E","Tamil":"#17915A","Telugu":"#A2489A","Kannada":"#A8720C","Malayalam":"#6C55CE","Bengali":"#96792A","Marathi":"#BE3A3A","Gujarati":"#178E80","Punjabi":"#5B6FA3","Odia":"#4FA97E","Assamese":"#9B85DE","English":"#6F6A5A","Kashmiri":"#6E86C4","Konkani":"#C27FBA","Nepali":"#55B3A6","Meitei":"#8A6FD0","Khasi":"#2FA98F","Mizo":"#7D93CF"};

/* Aggregate the client's campaigns/creators by state, region and language.
   Everything shown on this page derives from creator.state / .language
   (backfilled in the DB) — nothing is mocked. */
function aggregate(campaigns) {
  const states = {};   // code -> { camps:Set, creators, followers }
  const langs = {};    // lang -> { camps:Set, creators }
  let unassigned = 0;

  const campMeta = campaigns.map(c => ({
    id: c.id, n: c.name, s: c.service || "—", p: phaseOf(c.stage),
    pr: Number(c.progress) || 0, b: fmtINR(Number(c.budget) || null),
    states: new Set(), regions: new Set(), crs: [],
  }));

  campaigns.forEach((c, i) => {
    (c.creators || []).forEach(cr => {
      const code = stateCode(cr.state);
      if (!code) { unassigned++; return; }
      if (!states[code]) states[code] = { camps:new Set(), creators:0, followers:0 };
      states[code].camps.add(c.id);
      states[code].creators++;
      states[code].followers += parseFollowers(cr.followers);
      campMeta[i].states.add(code);
      campMeta[i].regions.add(STATES_META[code].region);
      // Keep the located creators on the campaign so the drill panel can list
      // exactly who this campaign has in the selected state/region.
      campMeta[i].crs.push({
        name: cr.name || "—", niche: cr.niche || "—",
        followers: parseFollowers(cr.followers), er: Number(cr.avgER) || 0, code,
      });
      const lang = cr.language || STATES_META[code].lang;
      if (!langs[lang]) langs[lang] = { camps:new Set(), creators:0 };
      langs[lang].camps.add(c.id);
      langs[lang].creators++;
    });
  });

  const stateData = {};
  Object.keys(STATES_META).forEach(code => {
    const s = states[code];
    stateData[code] = s
      ? { c:s.camps.size, cr:s.creators, f:s.followers }
      : { c:0, cr:0, f:0 };
  });

  const regions = {};
  Object.entries(stateData).forEach(([code, d]) => {
    const r = STATES_META[code].region;
    if (!regions[r]) regions[r] = { c:new Set(), cr:0, f:0 };
    if (d.c) states[code].camps.forEach(id => regions[r].c.add(id));
    regions[r].cr += d.cr;
    regions[r].f += d.f;
  });
  const regionData = Object.fromEntries(Object.entries(regions).map(([r, v]) =>
    [r, { c:v.c.size, cr:v.cr, f:v.f }]));

  const langData = Object.fromEntries(Object.entries(langs).map(([l, v]) =>
    [l, { c:v.camps.size, cr:v.creators }]));

  return { stateData, regionData, langData, campMeta, unassigned };
}

/* Centroid calculator */
function centroid(path){const nums=path.replace(/[MLZHVCSQTA]/gi," ").trim().split(/[\s,]+/).map(Number).filter(n=>!isNaN(n));let cx=0,cy=0,n=0;for(let i=0;i<nums.length;i+=2){cx+=nums[i];cy+=nums[i+1];n++;}return n?[cx/n,cy/n]:[0,0];}

/* ═══ SVG MAP — floats in 3D, tilts gently toward the cursor ═══
   Each mode colours the map differently so the three views aren't redundant:
   - state:    region colours, saturation scales with that state's creator count
   - region:   flat region zones (uniform tint per region)
   - language: states tinted by their primary language                         */
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

function IndiaMap({mode,stateData,selectedId,hovId,onSelect,onHover,P}){
  const isLang=mode==="language";const isRegion=mode==="region";
  const stateIds=Object.keys(PATHS).filter(id=>STATES_META[id]);
  const maxCr=Math.max(1,...Object.values(stateData).map(d=>d.cr));
  const outline="rgba(25,22,17,0.28)"; // always-visible hairline between states
  const reduced=useReducedMotion();
  const wrapRef=useRef(null);
  const [tip,setTip]=useState(null); // cursor-following tooltip {x,y}

  /* Spring-driven tilt with inertia — the map keeps drifting after the cursor
     stops, which is what sells the "3D scene" feel */
  const rx=useSpring(0,{stiffness:110,damping:16,mass:0.6});
  const ry=useSpring(0,{stiffness:110,damping:16,mass:0.6});
  const glowX=useSpring(50,{stiffness:140,damping:22});
  const glowY=useSpring(40,{stiffness:140,damping:22});
  const specular=useMotionTemplate`radial-gradient(340px circle at ${glowX}% ${glowY}%, rgba(255,255,255,0.32), transparent 65%)`;

  const handleMove=(e)=>{
    const el=wrapRef.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width; const py=(e.clientY-r.top)/r.height;
    if(!reduced){ rx.set((0.5-py)*12); ry.set((px-0.5)*14); }
    glowX.set(px*100); glowY.set(py*100);
    setTip({ x:e.clientX-r.left, y:e.clientY-r.top });
  };
  const handleLeave=()=>{ rx.set(0); ry.set(0); glowX.set(50); glowY.set(40); setTip(null); };

  /* Cinematic zoom: selecting a state (or region) eases the "camera" toward it */
  const zoom=useMemo(()=>{
    if(!selectedId) return { scale:1, x:0, y:0 };
    const targets=isRegion
      ? stateIds.filter(id=>STATES_META[id].region===selectedId)
      : [selectedId];
    const pts=targets.map(id=>PATHS[id]).filter(Boolean).map(centroid);
    if(!pts.length) return { scale:1, x:0, y:0 };
    const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length;
    const cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
    const s=isRegion?1.32:1.75;
    // transform-origin is the viewBox centre (240,280): translate the target
    // centroid there, accounting for the scale applied about that origin.
    return { scale:s, x:(240-cx)*s, y:(280-cy)*s };
  },[selectedId,isRegion,stateIds]);

  const hovMeta=hovId?STATES_META[hovId]:null;
  const hovData=hovId?stateData[hovId]:null;

  /* One merged dark copy of every path = the extruded "slab" under the map */
  const slab=(z,op,blur)=>(
    <svg viewBox="0 0 480 560" aria-hidden
      className="pointer-events-none absolute inset-0 mx-auto block w-full"
      style={{ transform:`translateZ(${z}px)`, filter:blur?`blur(${blur}px)`:undefined, opacity:op }}>
      <motion.g animate={zoom} transition={{type:"spring",stiffness:170,damping:26}}
        style={{ transformBox:"view-box", transformOrigin:"240px 280px" }}>
        {stateIds.map(id=>PATHS[id]&&PATHS[id].length>=20&&(
          <path key={id} d={PATHS[id]} fill={P.text}/>
        ))}
      </motion.g>
    </svg>
  );

  return(
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ perspective:"1600px" }}
      className="relative mx-auto w-full max-w-[640px]"
    >
      <motion.div
        className="relative"
        style={{ rotateX:rx, rotateY:ry, transformStyle:"preserve-3d" }}
      >
        {/* deep glow bed */}
        <div className="pointer-events-none absolute inset-x-10 top-10 -z-10 h-[78%] rounded-[50%] bg-accent/[0.14] blur-[70px]" style={{ transform:"translateZ(-70px)" }}/>
        {/* extruded slab layers — the map reads as a solid 3D object when tilting */}
        {slab(-18,0.07,3)}
        {slab(-9,0.13)}

        {/* main interactive surface */}
        <svg viewBox="0 0 480 560" className="relative mx-auto block w-full drop-shadow-[0_30px_50px_rgba(25,22,17,0.16)]" style={{ transform:"translateZ(0px)" }}>
          <rect width="480" height="560" fill="transparent" onClick={()=>selectedId&&onSelect(null)}/>
          <motion.g animate={zoom} transition={{type:"spring",stiffness:170,damping:26}}
            style={{ transformBox:"view-box", transformOrigin:"240px 280px" }}>
            {/* opaque warm base silhouette — hides the slab beneath so state
                washes stay warm; the extrusion only peeks out at the edges */}
            {stateIds.map(id=>PATHS[id]&&PATHS[id].length>=20&&(
              <path key={`base-${id}`} d={PATHS[id]} fill="#F2EFE7" stroke="#F2EFE7" strokeWidth={0.6}/>
            ))}
            {stateIds.map((id,i)=>{
              const meta=STATES_META[id];const data=stateData[id];if(!meta)return null;
              const path=PATHS[id];if(!path||path.length<20)return null;
              const isSel=selectedId===id||(isRegion&&selectedId===meta.region);
              const isHov=hovId===id;const has=data?.cr>0;
              const baseColor=isLang?(LC[meta.lang]||"#B9B4A6"):RC[meta.region];
              const intensity=has
                ?(isRegion||isLang?0.38:0.22+(data.cr/maxCr)*0.55) // state mode: deeper colour = more creators
                :(isRegion||isLang?0.10:0.05);                      // empty states stay a faint wash
              const dimmed=selectedId&&!isSel;                      // zoomed: non-selected states recede
              const fillOp=isSel?0.78:(isHov?Math.max(intensity,0.5):dimmed?intensity*0.4:intensity);
              const [cx,cy]=centroid(path);
              const showLabel=isSel||isHov||["rj","up","mp","mh","gj","ka","tn","ap","wb","or","as","jk","ct","br","jh","kl","hr","pb"].includes(id);
              return(<g key={id} onClick={()=>onSelect(isRegion?meta.region:id)} onMouseEnter={()=>onHover(id)} onMouseLeave={()=>onHover(null)} className="cursor-pointer">
                <motion.path d={path} fill={baseColor}
                  initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.15+i*0.014,duration:0.4}}
                  fillOpacity={fillOp}
                  stroke={isSel||isHov?baseColor:outline} strokeOpacity={isSel?0.95:isHov?0.85:dimmed?0.35:0.6}
                  strokeWidth={isSel?1.8:isHov?1.3:0.5}
                  style={{
                    transition:"fill-opacity 0.3s, stroke-opacity 0.3s, transform 0.25s cubic-bezier(0.16,1,0.3,1), filter 0.25s",
                    transformBox:"fill-box", transformOrigin:"center",
                    transform: isHov?"scale(1.02) translateY(-1.5px)":isSel?"scale(1.015)":"scale(1)",
                    filter:isSel?`drop-shadow(0 0 10px ${baseColor}70) drop-shadow(0 6px 10px rgba(25,22,17,0.25))`:isHov?`drop-shadow(0 4px 8px rgba(25,22,17,0.2))`:""
                  }}/>
                {showLabel&&<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={isSel||isHov?P.text:P.sub} fontSize={isSel?9.5:7.5} fontWeight={isSel?700:500} fontFamily="'Sora'" style={{pointerEvents:"none",textShadow:isSel?`0 0 5px ${P.bg}`:"", transition:"all 0.2s", opacity:dimmed?0.35:1}}>{id.toUpperCase()}</text>}
                {has&&!isSel&&<g style={{opacity:dimmed?0.3:1, transition:"opacity 0.3s"}}>
                  <circle cx={cx+14} cy={cy-10} r={isHov?7.5:6.5} fill={baseColor} opacity={0.92} style={{pointerEvents:"none", transition:"r 0.2s", filter:isHov?`drop-shadow(0 3px 6px ${baseColor}80)`:""}}/>
                  <text x={cx+14} y={cy-10} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={7} fontWeight={700} fontFamily="'Sora'" style={{pointerEvents:"none"}}>{data.cr}</text>
                </g>}
              </g>);
            })}
          </motion.g>
        </svg>

        {/* specular highlight tracks the cursor across the surface */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background:specular, transform:"translateZ(4px)" }}/>

        {/* floating particles at different depths — parallax when tilting */}
        {!reduced&&PARTICLES.map((p,i)=>(
          <span key={i} aria-hidden
            className="ambient-blob pointer-events-none absolute rounded-full"
            style={{ left:p.x, top:p.y, width:p.s, height:p.s, background:RC[p.c], opacity:0.35,
              transform:`translateZ(${p.z}px)`, animationDelay:`${p.d}s`, filter:"blur(0.5px)" }}/>
        ))}
      </motion.div>

      {/* cursor-following data tooltip */}
      <AnimatePresence>
        {tip&&hovMeta&&(
          <motion.div
            initial={{opacity:0, y:6, scale:0.95}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, scale:0.95}}
            transition={{duration:0.15}}
            className="glass-panel pointer-events-none absolute z-20 rounded-[12px] px-3 py-2"
            style={{ left:Math.min(tip.x+16, 460), top:Math.max(tip.y-14, 0) }}>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <Dot color={isLang?(LC[hovMeta.lang]||P.mute):RC[hovMeta.region]} sz={6}/>{hovMeta.name}
            </div>
            <div className="mt-0.5 text-[10.5px] text-sub">
              {hovData?.cr||0} creator{(hovData?.cr||0)===1?"":"s"} · {hovData?.c||0} campaign{(hovData?.c||0)===1?"":"s"}
              {hovData?.f?<> · <b className="text-ink">{fmtNum(hovData.f)}</b> followers</>:null}
            </div>
            <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.08em] text-mute">{RN[hovMeta.region]} · {hovMeta.lang}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>);
}

/* ═══ STATES PANEL — default right side of the States view ═══ */
function StatesPanel({stateData,onSelect,P}){
  const rows=Object.entries(stateData).filter(([,d])=>d.cr>0)
    .sort((a,b)=>b[1].cr-a[1].cr);
  if(!rows.length)return<div className="p-8 text-center text-[12.5px] text-mute">No creators have locations yet</div>;
  return(<div>
    <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">States with creators — click to drill down</div>
    {rows.map(([code,d],i)=>{const m=STATES_META[code];const maxCr=rows[0][1].cr;return(
      <div key={code} className="anim-up group mb-2 cursor-pointer rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-[3px] hover:scale-[1.01] hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]"
        style={{animationDelay:`${i*30}ms`}}
        onClick={()=>onSelect(code)}
        onMouseOver={e=>e.currentTarget.style.borderColor=RC[m.region]+"55"} onMouseOut={e=>e.currentTarget.style.borderColor="rgba(25,22,17,0.06)"}>
        <div className="flex items-center gap-3">
          <div className="relative flex size-8 shrink-0 items-center justify-center">
            <div className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-125" style={{background:RC[m.region]}}/>
            <Dot color={RC[m.region]} sz={8}/>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-ink">{m.name}</div>
            <div className="mt-px text-[10.5px] text-sub">{RN[m.region]} · {m.lang}</div>
          </div>
          <div className="text-right"><div className="text-[15px] font-bold text-accent"><CountUp value={d.cr}/></div><div className="text-[9px] uppercase text-mute">creators</div></div>
          <div className="text-right"><div className="text-[15px] font-bold text-green"><CountUp value={d.c}/></div><div className="text-[9px] uppercase text-mute">campaigns</div></div>
          <div className="min-w-[56px] text-right"><div className="text-[15px] font-bold text-ink">{d.f?fmtNum(d.f):"—"}</div><div className="text-[9px] uppercase text-mute">followers</div></div>
          <span className="text-[13px] text-mute opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100">→</span>
        </div>
        {/* creator share bar, coloured by region */}
        <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-well">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{width:`${(d.cr/maxCr)*100}%`,background:RC[m.region],boxShadow:`0 0 8px ${RC[m.region]}60`}}/>
        </div>
      </div>);})}
  </div>);
}

/* Legend chips shown under the map */
function MapLegend({mode,stateData,langData,P}){
  if(mode==="language"){
    const langs=Object.entries(langData).sort((a,b)=>b[1].cr-a[1].cr).slice(0,6);
    if(!langs.length)return null;
    return(<div className="mt-3 flex flex-wrap justify-center gap-2">
      {langs.map(([l,d],i)=>(<span key={l} className="fi flex items-center gap-1.5 rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 text-[10.5px] text-sub shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px" style={{animationDelay:`${i*40}ms`}}><Dot color={LC[l]||P.mute} sz={6}/>{l} <b className="text-ink">{d.cr}</b></span>))}
    </div>);
  }
  const active=new Set(Object.entries(stateData).filter(([,d])=>d.cr>0).map(([c])=>STATES_META[c].region));
  return(<div className="mt-3 flex flex-wrap justify-center gap-2">
    {Object.entries(RN).map(([r,label],i)=>(
      <span key={r} className={`fi flex items-center gap-1.5 rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 text-[10.5px] shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px ${active.has(r)?"text-sub":"text-donetxt"}`} style={{animationDelay:`${i*40}ms`}}>
        <Dot color={RC[r]} sz={6}/><span className={active.has(r)?"":"opacity-45"}>{label}</span>
      </span>))}
  </div>);
}

/* Campaign card in the drill panel — expands inline to list the creators this
   campaign has in the selected state/region, so seeing who's where no longer
   requires opening the campaign page. */
function CampCard({c,i,scope,open,onToggle,onOpenCampaign,P}){
  const pc=phaseColors(P);
  const crs=c.crs.filter(cr=>scope.type==="state"?cr.code===scope.id:STATES_META[cr.code].region===scope.id);
  return(<div className="anim-up mb-2 overflow-hidden rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/65 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:shadow-[0_12px_28px_rgba(25,22,17,0.09)]" style={{animationDelay:`${i*30}ms`}}>
    <div className="group cursor-pointer px-4 py-3" onClick={onToggle}>
      <div className="mb-1 flex items-center justify-between"><div><h4 className="text-[13px] font-medium text-ink transition-colors group-hover:text-accent">{c.n}</h4><span className="text-[10px] uppercase tracking-[0.04em] text-accent">{c.s}</span></div>
        <div className="flex items-center gap-1"><Dot color={pc[c.p]||P.mute}/><span className="text-[11px] text-sub">{PL[c.p]}</span><span className="text-[11px] font-semibold" style={{color:pc[c.p]}}>{c.pr}%</span></div></div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-sub">Budget {c.b}</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-accent">
          {crs.length} creator{crs.length===1?"":"s"} here
          <span className={`text-[9px] transition-transform duration-200 ${open?"-rotate-180":""}`}>▾</span>
        </span>
      </div>
    </div>
    {open&&(<div className="fi border-t border-[rgba(25,22,17,0.05)]">
      {crs.map((cr,j)=>{const m=STATES_META[cr.code];return(
        <div key={`${cr.name}-${j}`} className="flex items-center gap-2.5 border-b border-[rgba(25,22,17,0.04)] px-4 py-2.5 transition-colors duration-150 hover:bg-accent/[0.03]">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{background:RC[m.region]}}>{initials(cr.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-ink">{cr.name}</div>
            <div className="text-[10px] text-sub">{cr.niche} · {m.name}</div>
          </div>
          <div className="text-right"><div className="text-[11.5px] font-semibold text-accent">{cr.followers?fmtNum(cr.followers):"—"}</div><div className="text-[8.5px] uppercase tracking-[0.06em] text-mute">followers</div></div>
          <div className="min-w-[44px] text-right"><div className="text-[11.5px] font-semibold text-pink">{cr.er?`${cr.er.toFixed(1)}%`:"—"}</div><div className="text-[8.5px] uppercase tracking-[0.06em] text-mute">avg er</div></div>
        </div>);})}
      <button onClick={onOpenCampaign} className="block w-full px-4 py-2.5 text-center text-[11.5px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/[0.05]">
        Open Campaign Page →
      </button>
    </div>)}
  </div>);
}

/* ═══ DRILL PANEL ═══ */
function DrillPanel({type,id,data,onBack,onOpenCampaign,P}){
  const {stateData,regionData,campMeta}=data;
  const [openCamp,setOpenCamp]=useState(null); // expanded campaign id (keyed remount resets on drill change)
  const campList=(camps,scope)=>camps.map((c,i)=>(
    <CampCard key={c.id} c={c} i={i} scope={scope} open={openCamp===c.id}
      onToggle={()=>setOpenCamp(openCamp===c.id?null:c.id)}
      onOpenCampaign={()=>onOpenCampaign(c)} P={P}/>
  ));
  const backBtn=(<button onClick={onBack} className="mb-3 flex items-center gap-1 rounded-full border border-[rgba(25,22,17,0.08)] bg-well/70 px-3 py-1.5 text-[11px] text-sub transition-all duration-150 hover:-translate-x-0.5 hover:text-ink">← Back</button>);
  const statCard=([l,v],i)=>(
    <div key={l} className="anim-up rounded-[14px] border border-[rgba(25,22,17,0.06)] bg-white/65 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md" style={{animationDelay:`${i*50}ms`}}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div>
      <div className={`mt-1 text-[19px] font-bold ${v&&v!=="—"?"text-ink":"text-donetxt"}`}>{v}</div>
    </div>);

  if(type==="state"){
    const meta=STATES_META[id];const d=stateData[id];if(!meta||!d)return null;
    const color=RC[meta.region];
    const camps=campMeta.filter(c=>c.states.has(id));
    return(<div className="au">
      {backBtn}
      <div className="mb-3 flex items-center gap-2.5 rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="relative flex size-9 items-center justify-center">
          <div className="pulse absolute inset-0 rounded-full opacity-25" style={{background:color}}/>
          <Dot color={color} sz={9}/>
        </div>
        <h3 className="font-serif text-[19px] italic font-semibold text-ink">{meta.name}</h3>
        <span className="text-[11px] text-sub">{RN[meta.region]} · {meta.lang}</span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[["Campaigns",d.c],["Creators",d.cr],["Followers",d.f?fmtNum(d.f):"—"]].map(statCard)}
      </div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaigns with creators here — tap to see who</div>
      {camps.length?campList(camps,{type:"state",id}):<div className="p-7 text-center text-[12.5px] text-mute">No campaigns here yet</div>}
    </div>);
  }

  // Region
  const meta=regionData[id];if(!meta)return null;
  const statesInR=Object.entries(STATES_META).filter(([,m])=>m.region===id);
  const camps=campMeta.filter(c=>c.regions.has(id));
  return(<div className="au">
    {backBtn}
    <div className="mb-3 flex items-center gap-2.5 rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="relative flex size-9 items-center justify-center">
        <div className="pulse absolute inset-0 rounded-full opacity-25" style={{background:RC[id]}}/>
        <Dot color={RC[id]} sz={9}/>
      </div>
      <h3 className="font-serif text-[19px] italic font-semibold text-ink">{RN[id]} India</h3>
    </div>
    <div className="mb-4 grid grid-cols-3 gap-2">
      {[["Campaigns",meta.c],["Creators",meta.cr],["Followers",meta.f?fmtNum(meta.f):"—"]].map(statCard)}
    </div>
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">State Breakdown</div>
    <div className="mb-4 overflow-hidden rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/65 shadow-sm backdrop-blur-md">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 border-b border-[rgba(25,22,17,0.06)] bg-black/[0.015] px-3.5 py-2">{["State","Camp.","Creators","Followers"].map(h=><span key={h} className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mute">{h}</span>)}</div>
      {statesInR.map(([sid,m],i)=>{const d=stateData[sid];return<div key={sid} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 px-3.5 py-2.5 transition-colors duration-150 hover:bg-accent/[0.03] ${i<statesInR.length-1?"border-b border-[rgba(25,22,17,0.05)]":""}`}><span className="text-[12px] font-medium text-ink">{m.name}</span><span className={`text-[12px] ${d.c?"text-ink":"text-donetxt"}`}>{d.c}</span><span className={`text-[12px] ${d.cr?"text-ink":"text-donetxt"}`}>{d.cr}</span><span className={`text-[12px] ${d.f?"text-ink":"text-donetxt"}`}>{d.f?fmtNum(d.f):"—"}</span></div>;})}
    </div>
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaigns with creators here — tap to see who</div>
    {campList(camps,{type:"region",id})}
  </div>);
}

/* ═══ LANGUAGE PANEL ═══ */
function LangPanel({langData,P}){
  const sorted=Object.entries(langData).sort((a,b)=>b[1].cr-a[1].cr);
  if(!sorted.length)return<div className="p-8 text-center text-[12.5px] text-mute">No creator language data yet</div>;
  return(<div><div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Language Distribution</div>
    {sorted.map(([lang,d],i)=><div key={lang} className="anim-up group mb-2 flex items-center gap-3 rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-[0_12px_28px_rgba(25,22,17,0.08)]" style={{animationDelay:`${i*30}ms`}}>
      <div className="relative flex size-8 items-center justify-center">
        <div className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-125" style={{background:LC[lang]||P.mute}}/>
        <Dot color={LC[lang]||P.mute} sz={8}/>
      </div>
      <div className="flex-1"><div className="text-[13.5px] font-semibold text-ink">{lang}</div></div>
      <div className="text-right"><div className={`text-[15px] font-bold ${d.c?"text-accent":"text-donetxt"}`}><CountUp value={d.c}/></div><div className="text-[9px] uppercase text-mute">campaigns</div></div>
      <div className="text-right"><div className={`text-[15px] font-bold ${d.cr?"text-green":"text-donetxt"}`}><CountUp value={d.cr}/></div><div className="text-[9px] uppercase text-mute">creators</div></div>
    </div>)}
  </div>);
}

/* ═══ MAIN ═══ */
export default function RegionalMap(){
  const { P, setPage } = useApp();
  const { user } = useAuth();
  const[mode,setMode]=useState("state");
  const[sel,setSel]=useState(null);const[selType,setSelType]=useState(null);
  const[hov,setHov]=useState(null);
  const[campaigns,setCampaigns]=useState(null);const[error,setError]=useState(null);

  useEffect(()=>{
    if (!user?.clientName) return;
    PortalAPI.campaigns(user.clientName).then(setCampaigns).catch(e=>setError(e.message));
  },[user?.clientName]);

  const data=useMemo(()=>campaigns?aggregate(campaigns):null,[campaigns]);

  const handleSelect=(id)=>{
    if(id==null){setSel(null);setSelType(null);return;} // click on empty map area resets the zoom
    setSel(id);setSelType(mode==="region"?"region":"state");
  };
  const handleBack=()=>{setSel(null);setSelType(null);};

  if(error)return<ErrorState message={error}/>;
  if(!data)return<PageSkeleton/>;

  const totalCreators=Object.values(data.stateData).reduce((s,d)=>s+d.cr,0);

  return(<div className="relative min-h-screen w-full bg-page font-sans text-ink">
    <AmbientBackground variant="b"/>

    <div className="mx-auto max-w-[1600px] px-5 sm:px-9">
      <header className="pb-5 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[42px] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Regional Reach</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-sub">
              <span className="fi rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm"><b className="text-ink"><CountUp value={totalCreators}/></b> creator{totalCreators===1?"":"s"} mapped</span>
              <span className="fi rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"60ms"}}><b className="text-ink"><CountUp value={Object.values(data.stateData).filter(d=>d.cr>0).length}/></b> states</span>
              <span className="fi rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"120ms"}}><b className="text-ink"><CountUp value={Object.values(data.regionData).filter(d=>d.cr>0).length}/></b> regions</span>
              <span className="fi rounded-full border border-[rgba(25,22,17,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"180ms"}}><b className="text-ink"><CountUp value={Object.keys(data.langData).length}/></b> languages</span>
              {data.unassigned>0&&<span className="text-mute">{data.unassigned} creator{data.unassigned===1?"":"s"} without a location yet</span>}
            </div>
          </div>
          <div className="flex gap-1 rounded-full border border-line bg-white/70 p-1.5 shadow-[0_1px_10px_rgba(25,22,17,0.04)] backdrop-blur-xl">
            {[["state","States"],["region","Regions"],["language","Languages"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setMode(k);setSel(null);setSelType(null);}}
                className={`relative rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors duration-200 ease-out ${mode===k?"text-white":"text-sub hover:text-ink"}`}>
                {mode===k&&<motion.span layoutId="regional-mode" transition={{type:"spring",stiffness:420,damping:34}} className="absolute inset-0 rounded-full bg-accent shadow-[0_4px_14px_rgba(44,62,126,0.35)]"/>}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid min-h-[56vh] items-start gap-6 pb-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        {/* Map — the centrepiece: large, borderless, sticky while the side rail scrolls */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="top-28 self-start px-2 py-4 lg:sticky">
          <IndiaMap mode={mode} stateData={data.stateData} selectedId={sel} hovId={hov} onSelect={handleSelect} onHover={setHov} P={P}/>
          <div className="mt-4 min-h-4 text-center text-[12px] text-mute transition-all duration-200">
            {mode==="state"?"Deeper colour = more creators · move the cursor to tilt · click a state to zoom in"
              : mode==="region"?"Coloured by region · click to zoom into a region"
              : "Coloured by primary language"}
          </div>
          <MapLegend mode={mode} stateData={data.stateData} langData={data.langData} P={P}/>
        </motion.div>
        {/* Side rail — differs per view; crossfades between drill levels */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
          <motion.div
            key={sel&&selType?`${selType}-${sel}`:mode}
            initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
          {sel&&selType?(
            <DrillPanel type={selType} id={sel} data={data} onBack={handleBack}
              onOpenCampaign={(c)=>setPage("campaigns",{campaignId:c.id})} P={P}/>
          ):mode==="language"?(
            <LangPanel langData={data.langData} P={P}/>
          ):mode==="state"?(
            <StatesPanel stateData={data.stateData} onSelect={(code)=>{setSel(code);setSelType("state");}} P={P}/>
          ):(
            <div>
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Regions — click to drill down</div>
              <div className="grid gap-2.5" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))"}}>
                {Object.entries(data.regionData).filter(([,d])=>d.cr>0).map(([r,d],i)=>(
                  <div key={r} onClick={()=>{setSel(r);setSelType("region");}} className="anim-up group cursor-pointer rounded-[16px] border border-[rgba(25,22,17,0.06)] bg-white/65 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]" style={{animationDelay:`${i*30}ms`}}>
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <div className="relative flex size-6 items-center justify-center">
                        <div className="absolute inset-0 rounded-full opacity-20 transition-transform duration-300 group-hover:scale-150" style={{background:RC[r]}}/>
                        <Dot color={RC[r]} sz={6}/>
                      </div>
                      <span className="text-[13.5px] font-semibold text-ink">{RN[r]}</span><span className="ml-auto text-[12.5px] font-semibold" style={{color:RC[r]}}>{d.c}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">{[["Creators",d.cr],["Followers",d.f?fmtNum(d.f):"—"]].map(([l,v])=>(<div key={l}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div><div className="mt-px text-[13px] font-semibold text-ink">{v}</div></div>))}</div>
                  </div>
                ))}
                {!Object.values(data.regionData).some(d=>d.cr>0)&&<div className="p-4 text-[12px] text-mute">No creators have locations yet</div>}
              </div>
            </div>
          )}
          </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>);
}