import { useState, useEffect, useMemo } from "react";
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

/* ═══ SVG MAP ═══
   Each mode colours the map differently so the three views aren't redundant:
   - state:    region colours, saturation scales with that state's creator count
   - region:   flat region zones (uniform tint per region)
   - language: states tinted by their primary language                         */
function IndiaMap({mode,stateData,selectedId,hovId,onSelect,onHover,P}){
  const isLang=mode==="language";const isRegion=mode==="region";
  const stateIds=Object.keys(PATHS).filter(id=>STATES_META[id]);
  const maxCr=Math.max(1,...Object.values(stateData).map(d=>d.cr));
  const outline="rgba(28,24,16,0.28)"; // always-visible hairline between states
  return(
    <svg viewBox="0 0 480 560" className="mx-auto block w-full max-w-[420px]">
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
        const fillOp=isSel?0.7:(isHov?Math.max(intensity,0.5):intensity);
        const [cx,cy]=centroid(path);
        const showLabel=isSel||isHov||["rj","up","mp","mh","gj","ka","tn","ap","wb","or","as","jk","ct","br","jh","kl","hr","pb"].includes(id);
        return(<g key={id} onClick={()=>onSelect(isRegion?meta.region:id)} onMouseEnter={()=>onHover(id)} onMouseLeave={()=>onHover(null)} className="cursor-pointer">
          <path d={path} fill={baseColor} fillOpacity={fillOp}
            stroke={isSel||isHov?baseColor:outline} strokeOpacity={isSel?0.95:isHov?0.8:0.6}
            strokeWidth={isSel?1.6:isHov?1.1:0.5}
            style={{transition:"all 0.2s",filter:isSel?`drop-shadow(0 0 6px ${baseColor}40)`:""}}/>
          {showLabel&&<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={isSel||isHov?P.text:P.sub} fontSize={isSel?9:7.5} fontWeight={isSel?700:500} fontFamily="'Sora'" style={{pointerEvents:"none",textShadow:isSel?`0 0 4px ${P.bg}`:""}}>{id.toUpperCase()}</text>}
          {has&&!isSel&&<><circle cx={cx+14} cy={cy-10} r={6.5} fill={baseColor} opacity={0.9} style={{pointerEvents:"none"}}/><text x={cx+14} y={cy-10} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={7} fontWeight={700} fontFamily="'Sora'" style={{pointerEvents:"none"}}>{data.cr}</text></>}
        </g>);
      })}
    </svg>);
}

/* ═══ STATES PANEL — default right side of the States view ═══ */
function StatesPanel({stateData,onSelect,P}){
  const rows=Object.entries(stateData).filter(([,d])=>d.cr>0)
    .sort((a,b)=>b[1].cr-a[1].cr);
  if(!rows.length)return<div className="p-8 text-center text-[12.5px] text-mute">No creators have locations yet</div>;
  return(<div>
    <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">States with creators — click to drill down</div>
    {rows.map(([code,d],i)=>{const m=STATES_META[code];const maxCr=rows[0][1].cr;return(
      <div key={code} className="au mb-1.5 cursor-pointer rounded-lg border border-line bg-surface px-[13px] py-2.5 transition-colors"
        style={{animationDelay:`${i*25}ms`}}
        onClick={()=>onSelect(code)}
        onMouseOver={e=>e.currentTarget.style.borderColor=RC[m.region]} onMouseOut={e=>e.currentTarget.style.borderColor=P.border}>
        <div className="flex items-center gap-2.5">
          <Dot color={RC[m.region]} sz={7}/>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">{m.name}</div>
            <div className="mt-px text-[10.5px] text-sub">{RN[m.region]} · {m.lang}</div>
          </div>
          <div className="text-right"><div className="text-[14px] font-bold text-accent">{d.cr}</div><div className="text-[9px] uppercase text-mute">creators</div></div>
          <div className="text-right"><div className="text-[14px] font-bold text-green">{d.c}</div><div className="text-[9px] uppercase text-mute">campaigns</div></div>
          <div className="min-w-[52px] text-right"><div className="text-[14px] font-bold text-ink">{d.f?fmtNum(d.f):"—"}</div><div className="text-[9px] uppercase text-mute">followers</div></div>
        </div>
        {/* creator share bar, coloured by region */}
        <div className="mt-2 h-[3px] rounded-sm bg-well">
          <div className="h-full rounded-sm transition-[width] duration-500" style={{width:`${(d.cr/maxCr)*100}%`,background:RC[m.region]}}/>
        </div>
      </div>);})}
  </div>);
}

/* Legend chips shown under the map */
function MapLegend({mode,stateData,langData,P}){
  if(mode==="language"){
    const langs=Object.entries(langData).sort((a,b)=>b[1].cr-a[1].cr).slice(0,6);
    if(!langs.length)return null;
    return(<div className="mt-2.5 flex flex-wrap justify-center gap-2">
      {langs.map(([l,d])=>(<span key={l} className="flex items-center gap-1 text-[10.5px] text-sub"><Dot color={LC[l]||P.mute} sz={6}/>{l} <b className="text-ink">{d.cr}</b></span>))}
    </div>);
  }
  const active=new Set(Object.entries(stateData).filter(([,d])=>d.cr>0).map(([c])=>STATES_META[c].region));
  return(<div className="mt-2.5 flex flex-wrap justify-center gap-2">
    {Object.entries(RN).map(([r,label])=>(
      <span key={r} className={`flex items-center gap-1 text-[10.5px] ${active.has(r)?"text-sub":"text-donetxt"}`}>
        <Dot color={RC[r]} sz={6}/><span className={active.has(r)?"":"opacity-45"}>{label}</span>
      </span>))}
  </div>);
}

function CampCard({c,i,onClick,P}){
  const pc=phaseColors(P);
  return(<div className="au mb-1.5 cursor-pointer rounded-lg border border-line bg-surface px-[13px] py-2.5" onClick={onClick} style={{animationDelay:`${i*30}ms`}}>
    <div className="mb-1 flex items-center justify-between"><div><h4 className="text-[13px] font-medium text-ink">{c.n}</h4><span className="text-[10px] uppercase text-accent">{c.s}</span></div>
      <div className="flex items-center gap-1"><Dot color={pc[c.p]||P.mute}/><span className="text-[11px] text-sub">{PL[c.p]}</span><span className="text-[11px] font-semibold" style={{color:pc[c.p]}}>{c.pr}%</span></div></div>
    <div className="text-[11px] text-sub">Budget {c.b}</div>
  </div>);
}

/* ═══ DRILL PANEL ═══ */
function DrillPanel({type,id,data,onBack,onCampClick,P}){
  const {stateData,regionData,campMeta}=data;
  const backBtn=(<button onClick={onBack} className="mb-2.5 rounded-[5px] border border-line bg-well px-2.5 py-1 text-[11px] text-sub">← Back</button>);
  const statCard=([l,v])=>(
    <div key={l} className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div>
      <div className={`mt-0.5 text-[17px] font-bold ${v&&v!=="—"?"text-ink":"text-donetxt"}`}>{v}</div>
    </div>);

  if(type==="state"){
    const meta=STATES_META[id];const d=stateData[id];if(!meta||!d)return null;
    const color=RC[meta.region];
    const camps=campMeta.filter(c=>c.states.has(id));
    return(<div className="au">
      {backBtn}
      <div className="mb-2.5 flex items-center gap-2">
        <Dot color={color} sz={8}/><h3 className="font-serif text-lg italic font-semibold text-ink">{meta.name}</h3>
        <span className="text-[11px] text-sub">{RN[meta.region]} · {meta.lang}</span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {[["Campaigns",d.c],["Creators",d.cr],["Followers",d.f?fmtNum(d.f):"—"]].map(statCard)}
      </div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Campaigns with creators here</div>
      {camps.length?camps.map((c,i)=><CampCard key={c.id} c={c} i={i} onClick={()=>onCampClick(c)} P={P}/>):<div className="p-7 text-center text-[12.5px] text-mute">No campaigns here yet</div>}
    </div>);
  }

  // Region
  const meta=regionData[id];if(!meta)return null;
  const statesInR=Object.entries(STATES_META).filter(([,m])=>m.region===id);
  const camps=campMeta.filter(c=>c.regions.has(id));
  return(<div className="au">
    {backBtn}
    <div className="mb-2.5 flex items-center gap-2">
      <Dot color={RC[id]} sz={8}/><h3 className="font-serif text-lg italic font-semibold text-ink">{RN[id]} India</h3>
    </div>
    <div className="mb-3 grid grid-cols-3 gap-1.5">
      {[["Campaigns",meta.c],["Creators",meta.cr],["Followers",meta.f?fmtNum(meta.f):"—"]].map(statCard)}
    </div>
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">State Breakdown</div>
    <div className="mb-3 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 border-b border-line px-3 py-1.5">{["State","Camp.","Creators","Followers"].map(h=><span key={h} className="text-[9px] font-semibold uppercase tracking-[0.08em] text-mute">{h}</span>)}</div>
      {statesInR.map(([sid,m],i)=>{const d=stateData[sid];return<div key={sid} className={`grid grid-cols-[2fr_1fr_1fr_1fr] gap-1 px-3 py-2 ${i<statesInR.length-1?"border-b border-line":""}`}><span className="text-[12px] font-medium text-ink">{m.name}</span><span className={`text-[12px] ${d.c?"text-ink":"text-donetxt"}`}>{d.c}</span><span className={`text-[12px] ${d.cr?"text-ink":"text-donetxt"}`}>{d.cr}</span><span className={`text-[12px] ${d.f?"text-ink":"text-donetxt"}`}>{d.f?fmtNum(d.f):"—"}</span></div>;})}
    </div>
    {camps.map((c,i)=><CampCard key={c.id} c={c} i={i} onClick={()=>onCampClick(c)} P={P}/>)}
  </div>);
}

function CampPopup({c,onClose,setPage,P}){
  const pc=phaseColors(P);
  return(<div className="fixed inset-0 z-[200] flex items-center justify-center"><div onClick={onClose} className="fi absolute inset-0 bg-[rgba(3,6,16,0.75)] backdrop-blur-[6px]"/>
    <div className="au relative w-[min(400px,90vw)] rounded-[13px] border border-line bg-page px-6 py-5">
      <button onClick={onClose} className="absolute right-3 top-3 flex size-[22px] items-center justify-center rounded-[5px] border border-line bg-well text-[12.5px] text-sub">✕</button>
      <h3 className="mb-[3px] font-serif text-lg italic font-semibold text-ink">{c.n}</h3><span className="text-[10.5px] uppercase text-accent">{c.s}</span>
      <div className="mt-2 flex items-center gap-[5px]"><Dot color={pc[c.p]||P.mute}/><span className="text-[12px] text-sub">{PL[c.p]}</span><span className="text-[12px] font-semibold" style={{color:pc[c.p]}}>{c.pr}%</span><span className="ml-auto text-[12px] text-sub">Budget {c.b}</span></div>
      <button onClick={()=>{onClose();setPage&&setPage("campaigns",{campaignId:c.id});}} className="mt-3.5 block w-full rounded-[7px] bg-accent py-[9px] text-center text-[12.5px] font-semibold text-white">Open Campaign Page →</button>
    </div>
  </div>);
}

/* ═══ LANGUAGE PANEL ═══ */
function LangPanel({langData,P}){
  const sorted=Object.entries(langData).sort((a,b)=>b[1].cr-a[1].cr);
  if(!sorted.length)return<div className="p-8 text-center text-[12.5px] text-mute">No creator language data yet</div>;
  return(<div><div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Language Distribution</div>
    {sorted.map(([lang,d],i)=><div key={lang} className="au mb-[5px] flex items-center gap-[9px] rounded-lg border border-line bg-surface px-3 py-[9px]" style={{animationDelay:`${i*25}ms`}}>
      <Dot color={LC[lang]||P.mute} sz={7}/><div className="flex-1"><div className="text-[13px] font-semibold text-ink">{lang}</div></div>
      <div className="text-right"><div className={`text-[14px] font-bold ${d.c?"text-accent":"text-donetxt"}`}>{d.c}</div><div className="text-[9px] uppercase text-mute">campaigns</div></div>
      <div className="text-right"><div className={`text-[14px] font-bold ${d.cr?"text-green":"text-donetxt"}`}>{d.cr}</div><div className="text-[9px] uppercase text-mute">creators</div></div>
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

  return(<div className="min-h-screen w-full bg-page font-sans text-ink">
    <div className="mx-auto max-w-[1360px] px-4 sm:px-7">
      <header className="pb-3 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-serif text-[22px] italic font-semibold tracking-[-0.02em] text-ink">Regional Reach</h1>
            <div className="mt-[3px] flex flex-wrap items-center gap-1.5 text-[12px] text-sub">
              <span><b className="text-ink">{totalCreators}</b> creator{totalCreators===1?"":"s"} mapped</span>
              <span className="text-donetxt">·</span>
              <span><b className="text-ink">{Object.values(data.stateData).filter(d=>d.cr>0).length}</b> states</span>
              <span className="text-donetxt">·</span>
              <span><b className="text-ink">{Object.values(data.regionData).filter(d=>d.cr>0).length}</b> regions</span>
              <span className="text-donetxt">·</span>
              <span><b className="text-ink">{Object.keys(data.langData).length}</b> languages</span>
              {data.unassigned>0&&<span className="text-mute">· {data.unassigned} creator{data.unassigned===1?"":"s"} without a location yet</span>}
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-line bg-surface p-[3px]">
            {[["state","States"],["region","Regions"],["language","Languages"]].map(([k,l])=>(
              <button key={k} onClick={()=>{setMode(k);setSel(null);setSelType(null);}}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${mode===k?"bg-accent/[0.07] text-accent":"text-sub"}`}>{l}</button>
            ))}
          </div>
        </div>
      </header>
      <div className="flex min-h-[56vh] flex-wrap gap-[18px] pb-8">
        {/* Map card */}
        <div className="max-w-full flex-[0_0_460px] self-start rounded-xl border border-line bg-surface px-4 py-[18px] shadow-card">
          <IndiaMap mode={mode} stateData={data.stateData} selectedId={sel} hovId={hov} onSelect={handleSelect} onHover={setHov} P={P}/>
          <div className="mt-2 min-h-3.5 text-center text-[12px] text-sub">
            {hState
              ? <><b className="text-ink">{hState.name}</b> · {hData?.cr||0} creator{(hData?.cr||0)===1?"":"s"} · {hData?.c||0} campaign{(hData?.c||0)===1?"":"s"}</>
              : mode==="state"?"Deeper colour = more creators"
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
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Regions — click to drill down</div>
              <div className="grid gap-2" style={{gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))"}}>
                {Object.entries(data.regionData).filter(([,d])=>d.cr>0).map(([r,d])=>(
                  <div key={r} onClick={()=>{setSel(r);setSelType("region");}} className="cursor-pointer rounded-[9px] border border-line bg-surface px-[13px] py-[11px]">
                    <div className="mb-2 flex items-center gap-1.5"><Dot color={RC[r]} sz={6}/><span className="text-[13px] font-semibold text-ink">{RN[r]}</span><span className="ml-auto text-[12px] font-semibold" style={{color:RC[r]}}>{d.c}</span></div>
                    <div className="grid grid-cols-2 gap-1">{[["Creators",d.cr],["Followers",d.f?fmtNum(d.f):"—"]].map(([l,v])=>(<div key={l}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div><div className="mt-px text-[12.5px] font-semibold text-ink">{v}</div></div>))}</div>
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
