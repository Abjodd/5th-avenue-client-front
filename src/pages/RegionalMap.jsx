import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI, phaseOf } from "../lib/api";
import { parseFollowers, fmtNum, fmtINR } from "../lib/format";
import { STATES_META, stateCode, REGION_COLORS as RC, REGION_NAMES as RN } from "../lib/geo";
import { PATHS } from "../lib/indiaPaths";
import { PHASE_LABELS as PL, phaseColors } from "../lib/phases";
import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState } from "../components/PageStates";
// Language tints drawn from the theme palette (base hues + lighter tints)
// so the language view matches the rest of the portal.
const LC = {"Hindi":"#2F3E6B","Tamil":"#1E9E5A","Telugu":"#A8519E","Kannada":"#B5790A","Malayalam":"#7860D6","Bengali":"#A6862E","Marathi":"#C13A3A","Gujarati":"#1C9C8C","Punjabi":"#5B6FA3","Odia":"#4FA97E","Assamese":"#9B85DE","English":"#7A7566","Kashmiri":"#6E86C4","Konkani":"#C27FBA","Nepali":"#55B3A6","Meitei":"#8A6FD0","Khasi":"#2FA98F","Mizo":"#7D93CF"};

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
    states: new Set(), regions: new Set(),
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

/* Lightweight count-up used on the header stat chips */
function CountUp({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now(); const from = 0; const to = Number(value) || 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

/* ═══ SVG MAP — floats in 3D, tilts gently toward the cursor ═══
   Each mode colours the map differently so the three views aren't redundant:
   - state:    region colours, saturation scales with that state's creator count
   - region:   flat region zones (uniform tint per region)
   - language: states tinted by their primary language                         */
function IndiaMap({mode,stateData,selectedId,hovId,onSelect,onHover,P}){
  const isLang=mode==="language";const isRegion=mode==="region";
  const stateIds=Object.keys(PATHS).filter(id=>STATES_META[id]);
  const maxCr=Math.max(1,...Object.values(stateData).map(d=>d.cr));
  const outline="rgba(28,24,16,0.28)"; // always-visible hairline between states
  const wrapRef=useRef(null);
  const [tilt,setTilt]=useState({ rx:0, ry:0 });

  const handleMove=(e)=>{
    const el=wrapRef.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width; const py=(e.clientY-r.top)/r.height;
    setTilt({ rx:(0.5-py)*10, ry:(px-0.5)*12 });
  };
  const resetTilt=()=>setTilt({ rx:0, ry:0 });

  return(
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={resetTilt}
      style={{ perspective: "1400px" }}
      className="relative mx-auto max-w-[420px]"
    >
      <div
        className="relative transition-transform duration-200 ease-out"
        style={{ transform:`rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle:"preserve-3d" }}
      >
        {/* soft floating glow beneath the map, deepens the 3D read */}
        <div className="pointer-events-none absolute inset-x-6 top-8 -z-10 h-[80%] rounded-[50%] bg-accent/[0.12] blur-[60px]" style={{ transform:"translateZ(-40px)" }}/>
        <svg viewBox="0 0 480 560" className="mx-auto block w-full drop-shadow-[0_30px_50px_rgba(15,23,42,0.16)]">
          <rect width="480" height="560" fill="transparent"/>
          {stateIds.map(id=>{
            const meta=STATES_META[id];const data=stateData[id];if(!meta)return null;
            const path=PATHS[id];if(!path||path.length<20)return null;
            const isSel=selectedId===id||(isRegion&&selectedId===meta.region);
            const isHov=hovId===id;const has=data?.cr>0;
            const baseColor=isLang?(LC[meta.lang]||"#B9B4A6"):RC[meta.region];
            const intensity=has
              ?(isRegion||isLang?0.38:0.22+(data.cr/maxCr)*0.55) // state mode: deeper colour = more creators
              :(isRegion||isLang?0.10:0.05);                      // empty states stay a faint wash
            const fillOp=isSel?0.72:(isHov?Math.max(intensity,0.5):intensity);
            const [cx,cy]=centroid(path);
            const showLabel=isSel||isHov||["rj","up","mp","mh","gj","ka","tn","ap","wb","or","as","jk","ct","br","jh","kl","hr","pb"].includes(id);
            return(<g key={id} onClick={()=>onSelect(isRegion?meta.region:id)} onMouseEnter={()=>onHover(id)} onMouseLeave={()=>onHover(null)} className="cursor-pointer">
              <path d={path} fill={baseColor} fillOpacity={fillOp}
                stroke={isSel||isHov?baseColor:outline} strokeOpacity={isSel?0.95:isHov?0.85:0.6}
                strokeWidth={isSel?1.8:isHov?1.3:0.5}
                style={{
                  transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  transformBox:"fill-box", transformOrigin:"center",
                  transform: isHov?"scale(1.02) translateY(-1.5px)":isSel?"scale(1.015)":"scale(1)",
                  filter:isSel?`drop-shadow(0 0 10px ${baseColor}70) drop-shadow(0 6px 10px rgba(15,23,42,0.25))`:isHov?`drop-shadow(0 4px 8px rgba(15,23,42,0.2))`:""
                }}/>
              {showLabel&&<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={isSel||isHov?P.text:P.sub} fontSize={isSel?9.5:7.5} fontWeight={isSel?700:500} fontFamily="'Sora'" style={{pointerEvents:"none",textShadow:isSel?`0 0 5px ${P.bg}`:"", transition:"all 0.2s"}}>{id.toUpperCase()}</text>}
              {has&&!isSel&&<>
                <circle cx={cx+14} cy={cy-10} r={isHov?7.5:6.5} fill={baseColor} opacity={0.92} style={{pointerEvents:"none", transition:"r 0.2s", filter:isHov?`drop-shadow(0 3px 6px ${baseColor}80)`:""}}/>
                <text x={cx+14} y={cy-10} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={7} fontWeight={700} fontFamily="'Sora'" style={{pointerEvents:"none"}}>{data.cr}</text>
              </>}
            </g>);
          })}
        </svg>
      </div>
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
      <div key={code} className="anim-up group mb-2 cursor-pointer rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-[3px] hover:scale-[1.01] hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]"
        style={{animationDelay:`${i*30}ms`}}
        onClick={()=>onSelect(code)}
        onMouseOver={e=>e.currentTarget.style.borderColor=RC[m.region]+"55"} onMouseOut={e=>e.currentTarget.style.borderColor="rgba(15,23,42,0.06)"}>
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
      {langs.map(([l,d],i)=>(<span key={l} className="fi flex items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 text-[10.5px] text-sub shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px" style={{animationDelay:`${i*40}ms`}}><Dot color={LC[l]||P.mute} sz={6}/>{l} <b className="text-ink">{d.cr}</b></span>))}
    </div>);
  }
  const active=new Set(Object.entries(stateData).filter(([,d])=>d.cr>0).map(([c])=>STATES_META[c].region));
  return(<div className="mt-3 flex flex-wrap justify-center gap-2">
    {Object.entries(RN).map(([r,label],i)=>(
      <span key={r} className={`fi flex items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 text-[10.5px] shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px ${active.has(r)?"text-sub":"text-donetxt"}`} style={{animationDelay:`${i*40}ms`}}>
        <Dot color={RC[r]} sz={6}/><span className={active.has(r)?"":"opacity-45"}>{label}</span>
      </span>))}
  </div>);
}

function CampCard({c,i,onClick,P}){
  const pc=phaseColors(P);
  return(<div className="anim-up group mb-2 cursor-pointer rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)]" onClick={onClick} style={{animationDelay:`${i*30}ms`}}>
    <div className="mb-1 flex items-center justify-between"><div><h4 className="text-[13px] font-medium text-ink transition-colors group-hover:text-accent">{c.n}</h4><span className="text-[10px] uppercase tracking-[0.04em] text-accent">{c.s}</span></div>
      <div className="flex items-center gap-1"><Dot color={pc[c.p]||P.mute}/><span className="text-[11px] text-sub">{PL[c.p]}</span><span className="text-[11px] font-semibold" style={{color:pc[c.p]}}>{c.pr}%</span></div></div>
    <div className="text-[11px] text-sub">Budget {c.b}</div>
  </div>);
}

/* ═══ DRILL PANEL ═══ */
function DrillPanel({type,id,data,onBack,onCampClick,P}){
  const {stateData,regionData,campMeta}=data;
  const backBtn=(<button onClick={onBack} className="mb-3 flex items-center gap-1 rounded-full border border-[rgba(15,23,42,0.08)] bg-well/70 px-3 py-1.5 text-[11px] text-sub transition-all duration-150 hover:-translate-x-0.5 hover:text-ink">← Back</button>);
  const statCard=([l,v],i)=>(
    <div key={l} className="anim-up rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md" style={{animationDelay:`${i*50}ms`}}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div>
      <div className={`mt-1 text-[19px] font-bold ${v&&v!=="—"?"text-ink":"text-donetxt"}`}>{v}</div>
    </div>);

  if(type==="state"){
    const meta=STATES_META[id];const d=stateData[id];if(!meta||!d)return null;
    const color=RC[meta.region];
    const camps=campMeta.filter(c=>c.states.has(id));
    return(<div className="au">
      {backBtn}
      <div className="mb-3 flex items-center gap-2.5 rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
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
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaigns with creators here</div>
      {camps.length?camps.map((c,i)=><CampCard key={c.id} c={c} i={i} onClick={()=>onCampClick(c)} P={P}/>):<div className="p-7 text-center text-[12.5px] text-mute">No campaigns here yet</div>}
    </div>);
  }

  // Region
  const meta=regionData[id];if(!meta)return null;
  const statesInR=Object.entries(STATES_META).filter(([,m])=>m.region===id);
  const camps=campMeta.filter(c=>c.regions.has(id));
  return(<div className="au">
    {backBtn}
    <div className="mb-3 flex items-center gap-2.5 rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md">
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
    <div className="mb-4 overflow-hidden rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 shadow-sm backdrop-blur-md">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 border-b border-[rgba(15,23,42,0.06)] bg-black/[0.015] px-3.5 py-2">{["State","Camp.","Creators","Followers"].map(h=><span key={h} className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mute">{h}</span>)}</div>
      {statesInR.map(([sid,m],i)=>{const d=stateData[sid];return<div key={sid} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 px-3.5 py-2.5 transition-colors duration-150 hover:bg-accent/[0.03] ${i<statesInR.length-1?"border-b border-[rgba(15,23,42,0.05)]":""}`}><span className="text-[12px] font-medium text-ink">{m.name}</span><span className={`text-[12px] ${d.c?"text-ink":"text-donetxt"}`}>{d.c}</span><span className={`text-[12px] ${d.cr?"text-ink":"text-donetxt"}`}>{d.cr}</span><span className={`text-[12px] ${d.f?"text-ink":"text-donetxt"}`}>{d.f?fmtNum(d.f):"—"}</span></div>;})}
    </div>
    {camps.map((c,i)=><CampCard key={c.id} c={c} i={i} onClick={()=>onCampClick(c)} P={P}/>)}
  </div>);
}

function CampPopup({c,onClose,setPage,P}){
  const pc=phaseColors(P);
  return(<div className="fixed inset-0 z-[200] flex items-center justify-center"><div onClick={onClose} className="fi absolute inset-0 bg-[rgba(3,6,16,0.5)] backdrop-blur-[10px]"/>
    <div className="au relative w-[min(400px,90vw)] rounded-[22px] border border-[rgba(15,23,42,0.07)] bg-[#F7F8FA]/95 px-7 py-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop-blur-2xl" style={{ animation:"popIn 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <button onClick={onClose} className="absolute right-3.5 top-3.5 flex size-7 items-center justify-center rounded-full border border-[rgba(15,23,42,0.08)] bg-well/70 text-[12.5px] text-sub transition-colors hover:bg-red/[0.08] hover:text-red">✕</button>
      <h3 className="mb-1 font-serif text-[20px] italic font-semibold text-ink">{c.n}</h3><span className="text-[10.5px] uppercase tracking-[0.04em] text-accent">{c.s}</span>
      <div className="mt-3 flex items-center gap-1.5 rounded-[12px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3 py-2"><Dot color={pc[c.p]||P.mute}/><span className="text-[12px] text-sub">{PL[c.p]}</span><span className="text-[12px] font-semibold" style={{color:pc[c.p]}}>{c.pr}%</span><span className="ml-auto text-[12px] text-sub">Budget {c.b}</span></div>
      <button onClick={()=>{onClose();setPage&&setPage("campaigns",{campaignId:c.id});}} className="mt-4 block w-full rounded-full bg-accent py-2.5 text-center text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(37,99,235,0.35)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(37,99,235,0.45)]">Open Campaign Page →</button>
    </div>
  </div>);
}

/* ═══ LANGUAGE PANEL ═══ */
function LangPanel({langData,P}){
  const sorted=Object.entries(langData).sort((a,b)=>b[1].cr-a[1].cr);
  if(!sorted.length)return<div className="p-8 text-center text-[12.5px] text-mute">No creator language data yet</div>;
  return(<div><div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Language Distribution</div>
    {sorted.map(([lang,d],i)=><div key={lang} className="anim-up group mb-2 flex items-center gap-3 rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-[2px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]" style={{animationDelay:`${i*30}ms`}}>
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
  const[hov,setHov]=useState(null);const[popup,setPopup]=useState(null);
  const[campaigns,setCampaigns]=useState(null);const[error,setError]=useState(null);

  useEffect(()=>{
    if (!user?.clientName) return;
    PortalAPI.campaigns(user.clientName).then(setCampaigns).catch(e=>setError(e.message));
  },[user?.clientName]);

  const data=useMemo(()=>campaigns?aggregate(campaigns):null,[campaigns]);

  const handleSelect=(id)=>{setSel(id);setSelType(mode==="region"?"region":"state");};
  const handleBack=()=>{setSel(null);setSelType(null);};
  const hState=hov?STATES_META[hov]:null;const hData=hov&&data?data.stateData[hov]:null;

  if(error)return<ErrorState message={error}/>;
  if(!data)return<PageSkeleton/>;

  const totalCreators=Object.values(data.stateData).reduce((s,d)=>s+d.cr,0);

  return(<div className="relative min-h-screen w-full bg-page font-sans text-ink">
    <style>{`
      @keyframes popIn { from { opacity:0; transform:translateY(14px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
      @keyframes floatSlow { 0%,100% { transform:translateY(0) translateX(0); } 50% { transform:translateY(-18px) translateX(10px); } }
      @keyframes floatSlower { 0%,100% { transform:translateY(0) translateX(0); } 50% { transform:translateY(14px) translateX(-14px); } }
    `}</style>

    {/* Ambient floating background */}
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 size-[560px] rounded-full opacity-[0.11] blur-[120px]" style={{ background:"radial-gradient(circle,#2563EB,transparent 70%)", animation:"floatSlow 14s ease-in-out infinite" }}/>
      <div className="absolute -right-32 top-24 size-[480px] rounded-full opacity-[0.09] blur-[120px]" style={{ background:"radial-gradient(circle,#7860D6,transparent 70%)", animation:"floatSlower 17s ease-in-out infinite" }}/>
      <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full opacity-[0.08] blur-[110px]" style={{ background:"radial-gradient(circle,#1E9E5A,transparent 70%)", animation:"floatSlow 20s ease-in-out infinite" }}/>
    </div>

    <div className="mx-auto max-w-[1600px] px-5 sm:px-9">
      <header className="pb-5 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[42px] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Regional Reach</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-sub">
              <span className="fi rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm"><b className="text-ink"><CountUp value={totalCreators}/></b> creator{totalCreators===1?"":"s"} mapped</span>
              <span className="fi rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"60ms"}}><b className="text-ink"><CountUp value={Object.values(data.stateData).filter(d=>d.cr>0).length}/></b> states</span>
              <span className="fi rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"120ms"}}><b className="text-ink"><CountUp value={Object.values(data.regionData).filter(d=>d.cr>0).length}/></b> regions</span>
              <span className="fi rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-2.5 py-1 shadow-sm backdrop-blur-sm" style={{animationDelay:"180ms"}}><b className="text-ink"><CountUp value={Object.keys(data.langData).length}/></b> languages</span>
              {data.unassigned>0&&<span className="text-mute">{data.unassigned} creator{data.unassigned===1?"":"s"} without a location yet</span>}
            </div>
          </div>
          <div className="flex gap-1 rounded-full border border-[rgba(15,23,42,0.07)] bg-white/70 p-1.5 shadow-[0_1px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            {[["state","States"],["region","Regions"],["language","Languages"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setMode(k);setSel(null);setSelType(null);}}
                className={`rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all duration-200 ease-out ${mode===k?"bg-accent text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]":"text-sub hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-[56vh] flex-wrap gap-5 pb-10">
        {/* Map card */}
        <div className="max-w-full flex-[0_0_460px] self-start rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-5 py-6 shadow-[0_8px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
          <IndiaMap mode={mode} stateData={data.stateData} selectedId={sel} hovId={hov} onSelect={handleSelect} onHover={setHov} P={P}/>
          <div className="mt-3 min-h-4 text-center text-[12.5px] text-sub transition-all duration-200">
            {hState
              ? <><b className="text-ink">{hState.name}</b> · {hData?.cr||0} creator{(hData?.cr||0)===1?"":"s"} · {hData?.c||0} campaign{(hData?.c||0)===1?"":"s"}</>
              : mode==="state"?"Deeper colour = more creators · hover to tilt the map"
              : mode==="region"?"Coloured by region"
              : "Coloured by primary language"}
          </div>
          <MapLegend mode={mode} stateData={data.stateData} langData={data.langData} P={P}/>
        </div>
        {/* Side panel — differs per view */}
        <div className="min-w-[280px] flex-1">
          {sel&&selType?(
            <DrillPanel type={selType} id={sel} data={data} onBack={handleBack} onCampClick={setPopup} P={P}/>
          ):mode==="language"?(
            <LangPanel langData={data.langData} P={P}/>
          ):mode==="state"?(
            <StatesPanel stateData={data.stateData} onSelect={(code)=>{setSel(code);setSelType("state");}} P={P}/>
          ):(
            <div>
              <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Regions — click to drill down</div>
              <div className="grid gap-2.5" style={{gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))"}}>
                {Object.entries(data.regionData).filter(([,d])=>d.cr>0).map(([r,d],i)=>(
                  <div key={r} onClick={()=>{setSel(r);setSelType("region");}} className="anim-up group cursor-pointer rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]" style={{animationDelay:`${i*30}ms`}}>
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
        </div>
      </div>
    </div>
    {popup&&<CampPopup c={popup} onClose={()=>setPopup(null)} setPage={setPage} P={P}/>}
  </div>);
}