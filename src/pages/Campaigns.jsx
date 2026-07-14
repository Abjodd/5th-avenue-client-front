import { useState, useEffect, useRef } from "react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI, phaseOf } from "../lib/api";
import { parseFollowers, sizeOf, fmtNum, fmtINR, initials } from "../lib/format";
import { STATES_META, stateCode } from "../lib/geo";
import { PHASES } from "../lib/phases";
import { Dot } from "../components/Dot";
import { StatusPill, StatusLegend } from "../components/StatusPill";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";

const useP = () => useApp().P;
// Every status maps to a client-facing tier (components/ui.jsx TIERS):
// action = waiting on you · progress = agency at work · done · dropped.
const STATUS_MAP = {yet_to_pick:{label:"Yet to Pick",t:"neutral"},shortlisted:{label:"Shortlisted",t:"progress"},reached_out:{label:"Reached Out",t:"progress"},in_negotiation:{label:"Negotiating",t:"action"},locked:{label:"Locked",t:"done"},dropped:{label:"Dropped",t:"dropped"},brand_reject:{label:"Rejected",t:"dropped"},finalized:{label:"Finalised",t:"progress"},briefed:{label:"Briefed",t:"progress"},concept_received:{label:"Concept In",t:"action"},concept_approved:{label:"Concept OK",t:"done"},rework:{label:"Rework",t:"progress"},pending_brand:{label:"Pending You",t:"action"},video_received:{label:"Video In",t:"action"},video_approved:{label:"Video OK",t:"done"},posted:{label:"Posted",t:"done"},tracking:{label:"Live Tracking",t:"done"}};
const NICHES = ["Lifestyle","Fashion","Fitness","Dance","Music","Storytellers","Video Editors","Animation Artists","Mommy and Baby","Housewives","Food Reviews","Cooking Recipes"];
const SIZES = ["Nano","Micro","Macro","Mega","Celebrity"];
const AGE_GROUPS = ["18–24","25–30","31–40","41–50","50+"];
const REGIONS_ST = ["Maharashtra","Karnataka","Tamil Nadu","Kerala","Telangana","Delhi NCR","Uttar Pradesh","Gujarat","Rajasthan","West Bengal","Assam","Punjab","Madhya Pradesh","Bihar","Odisha","Goa"];
const TIERS = ["Tier 1","Tier 2","Tier 3"];
const LANGUAGES = ["Hindi","English","Tamil","Telugu","Kannada","Malayalam","Marathi","Bengali","Gujarati","Punjabi","Odia","Assamese","Urdu"];
const PLATFORMS = ["Instagram","YouTube","LinkedIn","Facebook","Reddit","X (Twitter)","Snapchat","Pinterest"];
const SERVICES_ALL = ["Influencer Marketing","AEO","Offline Activation"];
const IM_PRODUCTS = [{id:"reel_collab",label:"Reel — Collab"},{id:"reel_non_collab",label:"Reel — Non-Collab"},{id:"carousel_single",label:"Carousel — Single"},{id:"carousel_multi",label:"Carousel — Multi"},{id:"story",label:"Story"}];
const TEAM = [{name:"Rahul Sharma",role:"Manager"},{name:"Priya Nair",role:"Manager"},{name:"Arjun Reddy",role:"Executive"},{name:"Sneha Iyer",role:"Executive"},{name:"Vikram Das",role:"Manager"},{name:"Meera Joshi",role:"Executive"}];
// Chart series drawn from the theme palette (accent/teal/pink/amber/purple/
// green/gold + tints) so charts read as part of the same system.
const BCOLORS = ["#2F3E6B","#1C9C8C","#A8519E","#B5790A","#7860D6","#1E9E5A","#A6862E","#5B6FA3","#4FA97E","#C27FBA"];

/* Shared class strings for chips / selectable pills */
const chipOn  = "border-accent/15 bg-accent/[0.07] text-accent";
const chipOff = "border-line bg-well text-sub";
const inputCls = "w-full rounded-md border border-line bg-surface px-2.5 py-[7px] text-[13px] text-ink outline-none";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute";
const closeBtnCls = "flex size-6 items-center justify-center rounded-[5px] border border-line bg-well text-[13px] text-sub";

/* ═══ DB → VIEW MAPPING ═══
   Campaigns come from GET /api/portal/campaigns (see lib/api.js) in the
   backend's shape; these helpers convert them into what this page renders.
   Anything the DB doesn't store yet (deliverables, docs, tracking numbers)
   renders as "—" / hidden rather than being invented. */

// A creator's display status: prefer the furthest workflow signal we have.
function creatorStatus(cr) {
  if (cr.live?.postUrl) return "posted";
  if (cr.demo?.status === "approved") return "video_approved";
  if (cr.demo?.status === "rework") return "rework";
  if (cr.demo?.status === "received") return "video_received";
  if (cr.concept?.status === "approved") return "concept_approved";
  if (cr.concept?.status === "received") return "concept_received";
  if (cr.status === "reached_out" || cr.status === "negotiating") return "in_negotiation";
  return STATUS_MAP[cr.status] ? cr.status : "yet_to_pick";
}

function toViewCreator(cr) {
  const followers = parseFollowers(cr.followers);
  return {
    name: cr.name || "—",
    handle: cr.handle ? (cr.handle.startsWith("@") ? cr.handle : `@${cr.handle}`) : "",
    url: cr.igUrl || null,
    followers: fmtNum(followers),
    platform: cr.platform || "—",
    status: creatorStatus(cr),
    deliverables: "—", // not tracked per-creator in the DB yet
    engRate: cr.avgER != null && cr.avgER !== "" ? `${cr.avgER}%` : "—",
    niche: cr.niche || "—",
    size: sizeOf(followers),
    region: STATES_META[stateCode(cr.state)]?.name || cr.state || "—",
    language: cr.language || "—",
    avatar: initials(cr.name),
    briefDoc: cr.concept?.fileLink ? { name: "Concept file", url: cr.concept.fileLink } : null,
    videoDoc: cr.demo?.fileLink ? { name: "Demo video", url: cr.demo.fileLink } : null,
    approval: { exec: null, mgmt: null, execLocked: false, mgmtLocked: false },
  };
}

function toViewCampaign(c) {
  const phase = phaseOf(c.stage);
  const creators = (c.creators || []).map(toViewCreator);
  const ers = (c.creators || []).map(cr => Number(cr.avgER)).filter(v => v > 0);
  const avgER = ers.length ? `${(ers.reduce((a, b) => a + b, 0) / ers.length).toFixed(1)}%` : "—";
  const views = (c.creators || []).reduce((s, cr) => s + (Number(cr.tracking?.views) || 0), 0);
  const brief = c.brief && typeof c.brief === "object" ? c.brief : null;
  const briefLocked = c.briefStatus === "locked";
  const briefView = brief ? {
    objective: brief.objective || "", targetAudience: brief.audience || "",
    keyMessages: brief.messages || "", deliverables: brief.deliverables || "",
    budget: brief.budget || fmtINR(Number(c.budget) || null), timeline: brief.timeline || "",
    vars: Object.fromEntries(["objective","targetAudience","keyMessages","deliverables","budget","timeline"]
      .map(k => [k, briefLocked ? "approved" : "pending"])),
  } : null;
  return {
    id: c.id,
    name: c.name,
    service: c.service || "Influencer Marketing",
    region: c.region || "—",
    phase,
    progress: Number(c.progress) || Math.round((PHASES.findIndex(p => p.id === phase) / (PHASES.length - 1)) * 100),
    reach: "—", // no reach tracking in the DB yet
    engagement: avgER,
    impressions: "—",
    engRate: avgER,
    views: views ? fmtNum(views) : "—",
    start: c.start || "—",
    end: c.end || "—",
    budget: fmtINR(Number(c.budget) || null),
    brief: brief?.objective || "",
    lockedBrief: briefLocked ? briefView : null,
    pendingBrief: !briefLocked ? briefView : null,
    status: phase === "completed" ? "done" : "active",
    creators,
    topAssets: [],
    chat: [],
  };
}

/* ═══ UTILS ═══ */
const Donut=({value,size=40,stroke=4.5})=>{const P=useP();const r=(size-stroke)/2;const c=2*Math.PI*r;const col=value===100?P.doneTxt:P.accent;
  return(<div className="relative shrink-0" style={{width:size,height:size}}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={P.barBg} strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c-(value/100)*c} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s ease"}}/></svg><span className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold leading-none ${value===100?"text-donetxt":"text-ink"}`}>{value}%</span></div>);};

function Stepper({value,onChange,min=1}){
  const b="flex size-[26px] items-center justify-center rounded-[5px] border border-line bg-surface text-[14px] text-ink";
  return(<div className="flex items-center gap-1.5"><button className={`${b} ${value<=min?"opacity-30":""}`} onClick={()=>onChange(Math.max(min,value-1))}>−</button><span className="min-w-6 text-center text-[14px] font-semibold text-ink">{value}</span><button className={b} onClick={()=>onChange(value+1)}>+</button></div>);}

function Slider({value,onChange,min=0,max=100,step=1,suffix=""}){const P=useP();const pct=((value-min)/(max-min))*100;
  return(<div className="flex w-full items-center gap-2"><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="h-1 flex-1 cursor-pointer appearance-none rounded-sm outline-none" style={{background:`linear-gradient(to right,${P.accent} ${pct}%,${P.barBg} ${pct}%)`}}/><span className="min-w-12 text-right text-[12.5px] font-semibold text-ink">{value}{suffix}</span></div>);}

function ChipSelect({options,selected,onChange}){return(<div className="flex flex-wrap gap-1">{options.map(o=>{const a=selected.includes(o);return(<button key={o} onClick={()=>onChange(a?selected.filter(x=>x!==o):[...selected,o])} className={`whitespace-nowrap rounded-[5px] border px-[9px] py-1 text-[11px] font-medium ${a?chipOn:chipOff}`}>{o}</button>);})}</div>);}

function DropdownSelect({options:io,value,onChange,placeholder,allowNew}){const[open,setOpen]=useState(false);const[opts,setOpts]=useState(io);const[nv,setNv]=useState("");const ref=useRef(null);
  useEffect(()=>{if(!open)return;const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  return(<div ref={ref} className="relative"><button onClick={()=>setOpen(!open)} className={`flex w-full items-center justify-between rounded-md border border-line bg-surface px-2.5 py-[7px] text-left text-[13px] ${value?"text-ink":"text-mute"}`}><span className="truncate">{value||placeholder}</span><span className="text-[10px] text-mute">▾</span></button>
    {open&&(<div className="absolute inset-x-0 top-[calc(100%+3px)] z-[60] max-h-[170px] overflow-y-auto rounded-[7px] border border-line bg-surface py-[3px] shadow-modal">
      {opts.map(o=>(<div key={o} onClick={()=>{onChange(o);setOpen(false);}} className="cursor-pointer px-[11px] py-1.5 text-[12px] text-ink hover:bg-wash">{o}</div>))}
      {allowNew&&(<div className="flex gap-[3px] border-t border-line px-[9px] py-[5px]"><input value={nv} onChange={e=>setNv(e.target.value)} placeholder="Add new..." className="flex-1 rounded border border-line bg-surface px-[7px] py-[3px] text-[12px] text-ink outline-none"/><button onClick={()=>{if(nv.trim()){setOpts(p=>[...p,nv.trim()]);onChange(nv.trim());setNv("");setOpen(false);}}} className="rounded bg-accent px-2 py-[3px] text-[11px] font-semibold text-white">Add</button></div>)}
    </div>)}</div>);}

function HBars({data}){if(!data||!data.length)return null;const max=Math.max(...data.map(d=>d.value),0.1);
  return(<div className="flex flex-col gap-1">{data.map((d,i)=>(<div key={i} className="flex items-center gap-[7px]"><span className="w-16 shrink-0 truncate text-right text-[10px] text-sub">{d.label}</span><div className="h-2 flex-1 overflow-hidden rounded-[3px] bg-well"><div className="h-full min-w-0.5 rounded-[3px] transition-[width] duration-500" style={{width:`${(d.value/max)*100}%`,background:BCOLORS[i%BCOLORS.length]}}/></div><span className="w-8 shrink-0 text-[10px] font-semibold text-ink">{typeof d.value==="number"&&d.value%1?d.value.toFixed(1):d.value}{d.suffix||""}</span></div>))}</div>);}

/* ═══ PHASE TRACKER — more significant ═══ */
function PhaseTracker({currentPhase}){const P=useP();const idx=PHASES.findIndex(p=>p.id===currentPhase);
  return(<div className="mb-3.5 rounded-xl border border-line bg-surface px-5 py-4">
    <div className="flex items-center">
      {PHASES.map((p,i)=>{const isCur=i===idx,isDone=i<idx;
        return(<div key={p.id} className="flex flex-1 items-center">
          <div className="relative flex flex-1 flex-col items-center gap-[5px]">
            <div className={`flex size-9 items-center justify-center rounded-[10px] border-2 text-[17px] transition-all ${isDone?"border-green bg-green/[0.08]":isCur?"border-accent bg-accent/[0.08]":"border-ink/5 bg-well"}`} style={{boxShadow:isCur?`0 0 12px ${P.accent}30`:"none"}}>{isDone?"✓":p.icon}</div>
            <span className={`text-center text-[10.5px] uppercase tracking-[0.04em] ${isCur?"font-bold text-ink":isDone?"font-medium text-green":"font-normal text-mute"}`}>{p.label}</span>
            {isCur&&<div className="pulse absolute -top-1 right-[20%] size-2 rounded-full bg-accent"/>}
          </div>
          {i<PHASES.length-1&&(<div className={`mb-5 h-0.5 max-w-10 flex-[0_0_100%] rounded-px transition-colors ${isDone?"bg-green":"bg-ink/[0.03]"}`}/>)}
        </div>);})}
    </div>
  </div>);}

/* ═══ BUDGET CARD ═══ */
// Plain figure only — the DB doesn't store an operational budget split, so
// none is invented here. A real split can return once the backend has one.
function BudgetCard({value}){
  return(<div className="rounded-lg border border-line bg-surface px-3 py-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Budget</div>
    <div className="mt-0.5 text-[17px] font-semibold text-ink">{value}</div>
  </div>);}

/* ═══ METRIC CARD — optional expandable breakdown; suffix ("%") for rates ═══ */
function MetricCard({label,value,breakdowns,suffix=""}){const[open,setOpen]=useState(false);const[filter,setFilter]=useState(breakdowns?Object.keys(breakdowns)[0]:null);
  const has=breakdowns&&Object.keys(breakdowns).length>0&&value!=="—"&&value!=="0";
  return(<div className={`rounded-lg border border-line bg-surface px-3 py-2.5 ${has?"cursor-pointer":""}`} onClick={()=>has&&setOpen(!open)}>
    <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>{has&&<span className="text-[9px] text-accent">{open?"▴":"▾"}</span>}</div>
    <div className={`mt-0.5 text-[17px] font-semibold ${value==="—"||value==="0"?"text-donetxt":"text-ink"}`}>{value}</div>
    {open&&breakdowns&&(<div className="mt-2 border-t border-line pt-2">
      <div className="mb-1.5 flex flex-wrap gap-[3px]">{Object.keys(breakdowns).map(f=>(<button key={f} onClick={e=>{e.stopPropagation();setFilter(f);}} className={`rounded border px-[7px] py-0.5 text-[10px] font-medium capitalize ${filter===f?chipOn:"border-line bg-transparent text-mute"}`}>{f}</button>))}</div>
      <HBars data={suffix?(breakdowns[filter]||[]).map(d=>({...d,suffix})):breakdowns[filter]||[]}/>
    </div>)}
  </div>);}

/* ═══ OBSERVATIONS + STRATEGY INSIGHTS ═══ */
function Observations({creators,topAssets}){
  const obs=[];
  if(topAssets?.length){const best=topAssets[0];obs.push(`Top performer: ${best.creator} with ${best.label.split("—")[1]?.trim()||"strong results"}.`);}
  if(creators?.length>1){const rates=creators.filter(c=>c.engRate&&c.engRate!=="—").map(c=>({n:c.name,r:parseFloat(c.engRate)}));if(rates.length){const top=rates.sort((a,b)=>b.r-a.r)[0];obs.push(`Highest engagement: ${top.n} at ${top.r}%.`);const avg=(rates.reduce((s,r)=>s+r.r,0)/rates.length).toFixed(1);obs.push(`Average creator engagement: ${avg}% across ${rates.length} creators.`);}}
  if(creators?.length){const niches={};creators.forEach(c=>{niches[c.niche]=(niches[c.niche]||0)+1;});const topN=Object.entries(niches).sort((a,b)=>b[1]-a[1])[0];if(topN)obs.push(`Most represented niche: ${topN[0]} (${topN[1]} creator${topN[1]>1?"s":""}).`);}
  if(creators?.length){const platforms={};creators.forEach(c=>{platforms[c.platform]=(platforms[c.platform]||0)+1;});const topP=Object.entries(platforms).sort((a,b)=>b[1]-a[1])[0];if(topP)obs.push(`Primary platform: ${topP[0]} (${topP[1]} of ${creators.length} creators).`);}
  if(!obs.length)return null;

  // Generate strategy insights by connecting observations
  const strategies=[];
  if(creators?.length>1){
    const rates=creators.filter(c=>c.engRate&&c.engRate!=="—").map(c=>({n:c.name,r:parseFloat(c.engRate),niche:c.niche,size:c.size,platform:c.platform}));
    if(rates.length>1){
      const top=rates.sort((a,b)=>b.r-a.r)[0];
      const bottom=rates[rates.length-1];
      if(top.r>bottom.r*1.3){strategies.push(`${top.niche} creators are outperforming others — consider increasing allocation to this niche in future campaigns.`);}
      const igCount=rates.filter(r=>r.platform==="Instagram").length;
      const ytCount=rates.filter(r=>r.platform==="YouTube").length;
      if(igCount>0&&ytCount>0){
        const igAvg=rates.filter(r=>r.platform==="Instagram").reduce((s,r)=>s+r.r,0)/igCount;
        const ytAvg=rates.filter(r=>r.platform==="YouTube").reduce((s,r)=>s+r.r,0)/ytCount;
        if(ytAvg>igAvg*1.1)strategies.push(`YouTube creators show ${((ytAvg/igAvg-1)*100).toFixed(0)}% higher engagement than Instagram — consider shifting budget toward long-form content.`);
        else if(igAvg>ytAvg*1.1)strategies.push(`Instagram Reels driving ${((igAvg/ytAvg-1)*100).toFixed(0)}% higher engagement — double down on short-form content.`);
      }
    }
    const sizes={};rates.forEach(r=>{if(!sizes[r.size])sizes[r.size]={total:0,count:0};sizes[r.size].total+=r.r;sizes[r.size].count++;});
    const sizeAvgs=Object.entries(sizes).map(([k,v])=>({size:k,avg:v.total/v.count})).sort((a,b)=>b.avg-a.avg);
    if(sizeAvgs.length>1&&sizeAvgs[0].avg>sizeAvgs[sizeAvgs.length-1].avg*1.2){
      strategies.push(`${sizeAvgs[0].size} creators deliver the best engagement-to-cost ratio — prioritise this tier for ROI-focused campaigns.`);
    }
  }
  if(topAssets?.length>1){strategies.push(`Repurpose top-performing assets as paid ad creatives to maximise reach with proven content.`);}
  if(creators?.length>=3){
    const regions={};creators.forEach(c=>{regions[c.region]=(regions[c.region]||0)+1;});
    const regionCount=Object.keys(regions).length;
    if(regionCount<=2)strategies.push(`Current creators are concentrated in ${regionCount} region${regionCount>1?"s":""}. Expanding to new regions could unlock untapped audiences.`);
  }

  return(<div className="mt-3">
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Observations</div>
    <div className={`rounded-lg border border-line bg-surface px-3.5 py-2.5 ${strategies.length?"mb-2.5":""}`}>
      {obs.map((o,i)=>(<div key={i} className={`flex items-start gap-1.5 ${i<obs.length-1?"mb-[5px]":""}`}>
        <span className="mt-[3px] shrink-0 text-[10px] text-accent">●</span>
        <span className="text-[12px] leading-normal text-ink">{o}</span>
      </div>))}
    </div>
    {strategies.length>0&&(<>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Strategy Insights</div>
      <div className="rounded-lg border border-accent/[0.07] bg-accent/[0.02] px-3.5 py-2.5">
        {strategies.map((s,i)=>(<div key={i} className={`flex items-start gap-1.5 ${i<strategies.length-1?"mb-1.5":""}`}>
          <span className="mt-0.5 shrink-0 text-[11px] text-amber">→</span>
          <span className="text-[12px] leading-relaxed text-ink">{s}</span>
        </div>))}
      </div>
    </>)}
  </div>);
}

/* ═══ CREATOR ROW — independent approvals ═══ */
function CreatorRow({cr,idx,userRole,onUpdateApproval}){
  const P=useP();const st=STATUS_MAP[cr.status]||STATUS_MAP.yet_to_pick;
  const actionable=["pending_brand","in_negotiation"].includes(cr.status);
  const[expanded,setExpanded]=useState(false);
  const a=cr.approval||{exec:null,mgmt:null,execLocked:false,mgmtLocked:false};
  const bothLocked=a.execLocked&&a.mgmtLocked;
  const autoResult=bothLocked?(a.exec==="tick"&&a.mgmt==="tick"?"approved":"rejected"):null;

  const renderApprovalUI=(role,label)=>{
    const isOwn=(role==="exec"&&userRole==="execution")||(role==="mgmt"&&userRole==="management");
    const val=a[role];const locked=a[`${role}Locked`];
    return(<div className="flex items-center gap-1">
      <span className="w-9 text-[10px] font-semibold text-mute">{label}</span>
      {locked?(<span className={`flex items-center gap-0.5 text-[11px] font-semibold ${val==="tick"?"text-green":"text-red"} ${isOwn?"":"opacity-50"}`}>
        {val==="tick"?"✓ Yes":"✗ No"}<span className="ml-0.5 text-[9px] text-mute">locked</span>
      </span>):(isOwn?(<div className="flex gap-[3px]">
        <button onClick={()=>onUpdateApproval(idx,role,"tick")} className={`flex size-[22px] items-center justify-center rounded-[5px] border-[1.5px] text-[12px] text-green ${val==="tick"?"border-green bg-green/[0.08]":"border-line bg-transparent"}`}>✓</button>
        <button onClick={()=>onUpdateApproval(idx,role,"cross")} className={`flex size-[22px] items-center justify-center rounded-[5px] border-[1.5px] text-[12px] text-red ${val==="cross"?"border-red bg-red/[0.08]":"border-line bg-transparent"}`}>✗</button>
        {val&&<button onClick={()=>onUpdateApproval(idx,role+"Lock",true)} className="rounded border border-accent/10 bg-accent/5 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Lock</button>}
      </div>):(<span className={`text-[11px] opacity-50 ${val==="tick"?"text-green":val==="cross"?"text-red":"text-mute"}`}>{val==="tick"?"✓":"✗"}{val?" ("+label+")":"pending"}</span>))}
    </div>);};

  return(<div className="anim-up mb-1.5 rounded-[9px] border bg-surface px-[13px] py-[11px]" style={{animationDelay:`${idx*35}ms`,borderColor:actionable?P.amber+"20":autoResult==="approved"?P.green+"20":autoResult==="rejected"?P.red+"15":P.border}}>
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/[0.07] text-[12.5px] font-semibold text-accent">{cr.avatar||cr.name[0]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-medium text-ink">{cr.name}</span>
          <a href={cr.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-[12px] text-accent no-underline">{cr.handle}</a></div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[12px] text-sub"><span>{cr.followers}</span><span>{cr.platform}</span><span>{cr.deliverables}</span><span className="font-medium text-accent">ER: {cr.engRate}</span></div>
      </div>
      {autoResult&&<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${autoResult==="approved"?"bg-green/[0.07] text-green":"bg-red/5 text-red"}`}>{autoResult}</span>}
      <StatusPill tier={st.t}>{st.label}</StatusPill>
    </div>
    <button onClick={()=>setExpanded(!expanded)} className="mt-[5px] p-0 text-[11px] font-medium text-accent">{expanded?"Show less ▴":"See more ▾"}</button>
    {expanded&&(<div className="mt-[5px] flex flex-col gap-1 border-t border-line pt-[7px]">
      <div className="flex flex-wrap gap-2.5 text-[11px] text-sub"><span>Niche: <b className="text-ink">{cr.niche}</b></span><span>Size: <b className="text-ink">{cr.size}</b></span><span>State: <b className="text-ink">{cr.region}</b></span><span>Language: <b className="text-ink">{cr.language}</b></span></div>
      <div className="mt-0.5 flex gap-3.5 text-[12px]">
        <span className="text-mute">Brief: {cr.briefDoc?<a href={cr.briefDoc.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-accent no-underline">📄 {cr.briefDoc.name}</a>:<em>Not uploaded</em>}</span>
        <span className="text-mute">Video: {cr.videoDoc?<a href={cr.videoDoc.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-accent no-underline">🎬 {cr.videoDoc.name}</a>:<em>Not uploaded</em>}</span>
      </div>
    </div>)}
    {actionable&&!autoResult&&(<div className="mt-[7px] flex items-center gap-4 border-t border-line pt-[7px]">
      {renderApprovalUI("exec","Exec")}{renderApprovalUI("mgmt","Mgmt")}
    </div>)}
  </div>);}

/* ═══ BRIEF PAGE — with variable-level status ═══ */
function BriefPage({lockedBrief,pendingBrief}){const P=useP();
  const brief=lockedBrief||pendingBrief;if(!brief)return(<div className="px-5 py-9 text-center text-mute"><div className="mb-[5px] text-[26px] opacity-15">📋</div><div className="text-[13px]">No brief created yet</div></div>);
  const isLocked=!!lockedBrief;const vars=brief.vars||{};
  const statusIcon=(s)=>s==="approved"?{icon:"✓",color:P.green}:s==="rejected"?{icon:"✗",color:P.red}:s==="pending"?{icon:"⏳",color:P.amber}:{icon:"…",color:P.mute};
  return(<div>
    <div className={`mb-2.5 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${isLocked?"border-green/[0.08] bg-green/[0.02]":"border-amber/[0.08] bg-amber/[0.02]"}`}>
      <Dot color={isLocked?P.green:P.amber}/><span className={`text-[12px] font-medium ${isLocked?"text-green":"text-amber"}`}>{isLocked?`Locked ${brief.approvedOn}`:"Waiting — under review by 5th Avenue"}</span>
      <span className="ml-auto text-[10.5px] italic text-mute">{isLocked?"Read-only":"Pending approval"}</span></div>
    {[["Objective","objective"],["Target Audience","targetAudience"],["Key Messages","keyMessages"],["Deliverables","deliverables"],["Budget","budget"],["Timeline","timeline"]].map(([label,key])=>{
      const val=brief[key];const si=statusIcon(vars[key]);
      return(<div key={key} className="mb-[5px] flex items-start gap-2 rounded-[7px] border border-line bg-surface px-3 py-[9px]">
        <div className="flex-1"><div className="mb-[3px] flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}<span className="text-[11px]" style={{color:si.color}}>{si.icon}</span></div>
          <div className={`text-[13px] leading-normal ${val?"text-ink":"italic text-mute"}`}>{val||"Awaiting input"}</div></div>
      </div>);})}
  </div>);}

/* ═══ GUIDED BRIEF WIZARD — step-by-step conversational flow ═══ */
function GuidedBriefWizard({onComplete}){
  const STEPS=[
    {id:"service",q:"What service are you looking for?",options:["Influencer Marketing","AEO","Offline Activation"]},
    {id:"description",q:"Describe your campaign goal in a sentence or two.",type:"text",placeholder:"e.g. Launch awareness for our new summer snack range..."},
    {id:"budget",q:"What's your budget range?",options:["Under ₹5L","₹5L – ₹15L","₹15L – ₹50L","₹50L – ₹1.5Cr"]},
    {id:"category",q:"Which brand category or team is this for?",options:["Snacks","Beverages","Health & Wellness","Fashion","Beauty","Other"],allowCustom:true},
    {id:"platforms",q:"Which platforms should we target?",options:["Instagram","YouTube","LinkedIn","Facebook","Reddit","X (Twitter)"],multi:true,condition:(d)=>d.service==="Influencer Marketing"},
    {id:"numCreators",q:"How many creators are you thinking?",options:["1 – 5","6 – 15","16 – 30","30+"],condition:(d)=>d.service==="Influencer Marketing"},
    {id:"creatorNiche",q:"What kind of creators? Pick all that apply.",options:["Lifestyle","Fashion","Fitness","Food Reviews","Cooking Recipes","Dance","Music","Storytellers","Mommy and Baby","Housewives"],multi:true,condition:(d)=>d.service==="Influencer Marketing"},
    {id:"creatorSize",q:"What creator tier do you prefer?",options:["Nano","Micro","Macro","Mega","Celebrity","Mix of sizes"],condition:(d)=>d.service==="Influencer Marketing"},
    {id:"usage",q:"What usage rights do you need?",options:["Ad Rights (time-limited)","Media Rights (perpetual)"],condition:(d)=>d.service==="Influencer Marketing"},
    {id:"region",q:"Any specific regions or states to target?",type:"text",placeholder:"e.g. South India, Maharashtra, Pan-India..."},
    {id:"reference",q:"Any reference creators or campaign links? (optional)",type:"text",placeholder:"Paste a profile link or skip...",optional:true},
  ];

  const[step,setStep]=useState(0);const[data,setData]=useState({});const[msgs,setMsgs]=useState([]);const[customInput,setCustomInput]=useState("");const[multiSel,setMultiSel]=useState([]);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,step]);

  // Initialize first message
  useEffect(()=>{setMsgs([{role:"assistant",content:STEPS[0].q}]);},[]);

  const getNextStep=(curIdx)=>{
    for(let i=curIdx+1;i<STEPS.length;i++){if(!STEPS[i].condition||STEPS[i].condition(data))return i;}
    return -1;
  };

  const advance=(answer)=>{
    const curStep=STEPS[step];
    const newData={...data,[curStep.id]:answer};setData(newData);
    const newMsgs=[...msgs,{role:"user",content:Array.isArray(answer)?answer.join(", "):answer}];

    const nextIdx=getNextStep(step);
    if(nextIdx===-1){
      // Done
      const budgetMap={"Under ₹5L":3,"₹5L – ₹15L":10,"₹15L – ₹50L":30,"₹50L – ₹1.5Cr":100};
      newMsgs.push({role:"assistant",content:"All set! Here's your brief summary. Review and submit."});
      setMsgs(newMsgs);setStep(-1);
      setData({...newData,_budgetNum:budgetMap[newData.budget]||10});
    }else{
      newMsgs.push({role:"assistant",content:STEPS[nextIdx].q});
      setMsgs(newMsgs);setStep(nextIdx);setMultiSel([]);setCustomInput("");
    }
  };

  const handleOption=(opt)=>advance(opt);
  const handleMultiConfirm=()=>{if(multiSel.length)advance(multiSel);};
  const handleTextSubmit=()=>{const v=customInput.trim();if(v)advance(v);else if(STEPS[step]?.optional)advance("—");};
  const handleSkip=()=>advance("—");

  const curStep=step>=0&&step<STEPS.length?STEPS[step]:null;
  const isDone=step===-1;

  return(<div className="flex h-full flex-col">
    <div className="flex-1 overflow-y-auto py-1">
      {msgs.map((m,i)=>(<div key={i} className={`anim-up mb-2 flex flex-col ${m.role==="user"?"items-end":"items-start"}`} style={{animationDelay:`${Math.min(i,4)*30}ms`}}>
        <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-[13px] leading-normal text-ink ${m.role==="user"?"border-accent/[0.07] bg-accent/[0.04]":"border-line bg-surface"}`}>{m.content}</div>
      </div>))}
      <div ref={endRef}/>
    </div>

    {/* Options / Input area */}
    {curStep&&!isDone&&(<div className="border-t border-line pt-2">
      {curStep.type==="text"?(
        <div className="flex gap-1">
          <input value={customInput} onChange={e=>setCustomInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleTextSubmit()} placeholder={curStep.placeholder||"Type here..."} className="flex-1 rounded-[7px] border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none"/>
          <button onClick={handleTextSubmit} className={`rounded-[7px] px-3.5 py-2 text-[12px] font-semibold ${customInput.trim()?"bg-accent text-white":"bg-well text-mute"}`}>Next</button>
          {curStep.optional&&<button onClick={handleSkip} className="rounded-[7px] border border-line bg-well px-2.5 py-2 text-[12px] text-mute">Skip</button>}
        </div>
      ):curStep.multi?(
        <div>
          <div className="mb-1.5 flex flex-wrap gap-1">{curStep.options.map(o=>{const sel=multiSel.includes(o);return(<button key={o} onClick={()=>setMultiSel(sel?multiSel.filter(x=>x!==o):[...multiSel,o])} className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${sel?chipOn:chipOff}`}>{o}</button>);})}</div>
          <button onClick={handleMultiConfirm} disabled={!multiSel.length} className={`w-full rounded-[7px] py-[7px] text-[12px] font-semibold ${multiSel.length?"cursor-pointer bg-accent text-white":"cursor-not-allowed bg-well text-mute"}`}>Confirm ({multiSel.length} selected)</button>
        </div>
      ):(
        <div>
          <div className="flex flex-wrap gap-1">{curStep.options.map(o=>(<button key={o} onClick={()=>handleOption(o)} className="rounded-md border border-accent/[0.12] bg-accent/[0.03] px-[13px] py-1.5 text-[12px] font-medium text-accent">{o}</button>))}</div>
          {curStep.allowCustom&&(<div className="mt-1.5 flex gap-1">
            <input value={customInput} onChange={e=>setCustomInput(e.target.value)} placeholder="Or type your own..." className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none"/>
            <button onClick={handleTextSubmit} disabled={!customInput.trim()} className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${customInput.trim()?"bg-accent text-white":"bg-well text-mute"}`}>Go</button>
          </div>)}
        </div>
      )}
    </div>)}

    {/* Summary + Submit */}
    {isDone&&(<div className="border-t border-line pt-2">
      <div className="mb-[5px] text-[11px] font-semibold uppercase text-green">Brief Summary</div>
      <div className="rounded-[7px] border border-green/[0.12] bg-surface px-2.5 py-2 text-[12px] leading-relaxed text-ink">
        {data.service&&<div><span className="text-mute">Service:</span> {data.service}</div>}
        {data.description&&data.description!=="—"&&<div><span className="text-mute">Goal:</span> {data.description}</div>}
        {data.budget&&<div><span className="text-mute">Budget:</span> {data.budget}</div>}
        {data.category&&data.category!=="—"&&<div><span className="text-mute">Category:</span> {data.category}</div>}
        {data.platforms&&data.platforms!=="—"&&<div><span className="text-mute">Platforms:</span> {data.platforms}</div>}
        {data.numCreators&&<div><span className="text-mute">Creators:</span> {data.numCreators}</div>}
        {data.creatorNiche&&<div><span className="text-mute">Niches:</span> {data.creatorNiche}</div>}
        {data.creatorSize&&<div><span className="text-mute">Size:</span> {data.creatorSize}</div>}
        {data.usage&&<div><span className="text-mute">Usage:</span> {data.usage}</div>}
        {data.region&&data.region!=="—"&&<div><span className="text-mute">Region:</span> {data.region}</div>}
      </div>
      <button onClick={()=>onComplete({svc:data.service||"Influencer Marketing",budget:data._budgetNum||10,description:data.description||"Campaign brief"})} className="mt-2 w-full rounded-[7px] bg-accent py-[9px] text-[13px] font-semibold text-white">Submit Requirement</button>
    </div>)}
  </div>);}

/* ═══ NEW REQ MODAL ═══ */
function NewReqModal({onClose,onSubmit}){const P=useP();const[mode,setMode]=useState(null);
  const[svc,setSvc]=useState("");const[budgetText,setBudgetText]=useState("5");
  const[numCreators,setNumCreators]=useState(5);const[niches,setNiches]=useState([]);const[sizes,setSizes]=useState([]);const[ageGroups,setAgeGroups]=useState([]);const[regions,setRegions]=useState([]);const[tiers,setTiers]=useState([]);const[languages,setLanguages]=useState([]);const[platforms,setPlatforms]=useState([]);
  const[products,setProducts]=useState([]);const[productVols,setProductVols]=useState({});const[usage,setUsage]=useState("");const[adDays,setAdDays]=useState(30);
  const[description,setDescription]=useState("");const[refLink,setRefLink]=useState("");const[brandCat,setBrandCat]=useState("");const[poc1,setPoc1]=useState("");const[poc2,setPoc2]=useState("");const[creatorDesc,setCreatorDesc]=useState("");

  const handleBudgetInput=(v)=>setBudgetText(v);
  const toggleProduct=(id)=>{if(products.includes(id)){setProducts(products.filter(p=>p!==id));const pv={...productVols};delete pv[id];setProductVols(pv);}else setProducts([...products,id]);};
  const canSubmit=svc&&parseFloat(budgetText)>0&&description.trim();
  const showPlatform=svc==="Influencer Marketing";
  const modeCard="flex-1 cursor-pointer rounded-xl border border-line bg-surface px-4 py-[22px] text-center transition-colors hover:border-accent/25";

  return(<div className="fixed inset-0 z-[300] flex items-center justify-center">
    <div onClick={onClose} className="fade-in absolute inset-0 bg-[rgba(3,6,16,0.82)] backdrop-blur-[6px]"/>
    <div className="anim-up relative flex max-h-[90vh] w-[min(560px,94vw)] flex-col overflow-hidden rounded-[14px] border border-line bg-page">
      <div className="flex items-center justify-between border-b border-line px-[18px] pb-2.5 pt-3.5">
        <div><h3 className="font-serif text-[18px] italic font-semibold text-ink">New Requirement</h3></div>
        <div className="flex gap-[3px]">{mode&&<button onClick={()=>setMode(null)} className="rounded border border-line bg-well px-[7px] py-[3px] text-[11px] text-sub">← Back</button>}
          <button onClick={onClose} className={closeBtnCls}>✕</button></div></div>
      <div className="flex-1 overflow-y-auto px-[18px] pb-[18px] pt-3">
        {!mode&&(<div className="flex gap-2.5 py-4">
          <div onClick={()=>setMode("chat")} className={modeCard}>
            <div className="mb-2 text-2xl">💬</div><div className="mb-[3px] text-[13px] font-semibold text-ink">Guided Brief</div><div className="text-[12px] leading-normal text-sub">Answer step-by-step questions. We'll build the brief for you.</div></div>
          <div onClick={()=>setMode("form")} className={modeCard}>
            <div className="mb-2 text-2xl">📋</div><div className="mb-[3px] text-[13px] font-semibold text-ink">Manual Form</div><div className="text-[12px] leading-normal text-sub">Fill each field yourself.</div></div>
        </div>)}
        {mode==="chat"&&<GuidedBriefWizard onComplete={d=>onSubmit({svc:d.svc||d.service||"Influencer Marketing",budget:d.budget||5,description:d.description||"Campaign brief"})}/>}
        {mode==="form"&&(<>
          <div className="mb-2.5"><label className={labelCls}>Service</label><div className="flex gap-1">{SERVICES_ALL.map(s=>(<button key={s} onClick={()=>setSvc(s)} className={`flex-1 rounded-[5px] border py-1.5 text-[12px] font-medium ${svc===s?chipOn:chipOff}`}>{s}</button>))}</div></div>
          <div className="mb-2.5"><label className={labelCls}>Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} placeholder="What do you want to achieve..." className={`${inputCls} resize-y leading-normal`}/></div>
          <div className="mb-2.5"><label className={labelCls}>Brand Category</label><DropdownSelect options={["Snacks","Beverages","Health","Fashion","Beauty","Tech","FMCG","D2C"]} value={brandCat} onChange={setBrandCat} placeholder="Select..." allowNew/></div>
          <div className="mb-2.5 flex gap-[7px]"><div className="flex-1"><label className={labelCls}>POC 1</label><DropdownSelect options={TEAM.map(m=>`${m.name} (${m.role})`)} value={poc1} onChange={setPoc1} placeholder="Select..."/></div>
            <div className="flex-1"><label className={labelCls}>POC 2</label><DropdownSelect options={TEAM.map(m=>`${m.name} (${m.role})`)} value={poc2} onChange={setPoc2} placeholder="Select..."/></div></div>

          {/* Budget — slider + manual, capped at 1.5CR (150L) */}
          <div className="mb-2.5"><label className={labelCls}>Budget (Lakhs ₹) — max 1.5 Cr</label>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={150} step={0.5} value={parseFloat(budgetText)||1} onChange={e=>{setBudgetText(e.target.value);}} className="h-1 flex-1 cursor-pointer appearance-none rounded-sm outline-none" style={{background:`linear-gradient(to right,${P.accent} ${((parseFloat(budgetText)||1)/150)*100}%,${P.barBg} ${((parseFloat(budgetText)||1)/150)*100}%)`}}/>
              <div className="flex items-center gap-0.5">
                <span className="text-[12.5px] text-mute">₹</span>
                <input type="number" min={1} max={150} step={0.5} value={budgetText} onChange={e=>handleBudgetInput(e.target.value)} className="w-[50px] rounded border border-line bg-surface p-1 text-center text-[12.5px] text-ink outline-none"/>
                <span className="text-[12px] text-mute">L</span>
              </div>
            </div>
          </div>

          {showPlatform&&<div className="mb-2.5"><label className={labelCls}>Platform</label><ChipSelect options={PLATFORMS} selected={platforms} onChange={setPlatforms}/></div>}
          {svc==="Influencer Marketing"&&(<>
            <div className="mb-2.5 flex items-center justify-between"><label className={`${labelCls} mb-0`}>Number of Creators</label><Stepper value={numCreators} onChange={setNumCreators}/></div>
            <div className="mb-2.5 rounded-[7px] border border-line bg-surface px-[11px] py-[9px]">
              <div className={`${labelCls} mb-1.5`}>Creator Requirements</div>
              <div className="mb-1.5"><label className={`${labelCls} text-[10px]`}>Niche</label><ChipSelect options={NICHES} selected={niches} onChange={setNiches}/></div>
              <div className="mb-1.5"><label className={`${labelCls} text-[10px]`}>Size</label><ChipSelect options={SIZES} selected={sizes} onChange={setSizes}/></div>
              <div className="mb-1.5"><label className={`${labelCls} text-[10px]`}>Age</label><ChipSelect options={AGE_GROUPS} selected={ageGroups} onChange={setAgeGroups}/></div>
              <div className="mb-1.5"><label className={`${labelCls} text-[10px]`}>Region</label><ChipSelect options={REGIONS_ST} selected={regions} onChange={setRegions}/></div>
              <div className="mb-1.5 flex gap-1.5"><div className="flex-1"><label className={`${labelCls} text-[10px]`}>Tier</label><ChipSelect options={TIERS} selected={tiers} onChange={setTiers}/></div>
                <div className="flex-1"><label className={`${labelCls} text-[10px]`}>Language</label><DropdownSelect options={LANGUAGES} value="" onChange={v=>{if(!languages.includes(v))setLanguages([...languages,v]);}} placeholder="Add..."/></div></div>
              {languages.length>0&&<div className="mb-[5px] flex flex-wrap gap-[3px]">{languages.map(l=>(<span key={l} className="flex items-center gap-0.5 rounded-[3px] bg-accent/[0.07] px-[5px] py-0.5 text-[10.5px] text-accent">{l}<button onClick={()=>setLanguages(languages.filter(x=>x!==l))} className="p-0 text-[10px] text-mute">×</button></span>))}</div>}
            </div>
            <div className="mb-2.5"><label className={labelCls}>Product & Volume</label><div className="flex flex-col gap-[3px]">{IM_PRODUCTS.map(p=>{const a=products.includes(p.id);return(<div key={p.id} className="flex items-center gap-[5px]"><button onClick={()=>toggleProduct(p.id)} className={`flex-1 rounded-[5px] border px-[9px] py-[5px] text-left text-[11px] font-medium ${a?chipOn:chipOff}`}>{p.label}</button>
              {a&&<input type="number" min={1} value={productVols[p.id]||1} onChange={e=>setProductVols({...productVols,[p.id]:Math.max(1,parseInt(e.target.value)||1)})} className="w-[42px] rounded border border-line bg-surface p-1 text-center text-[12px] text-ink outline-none"/>}</div>);})}</div></div>
            <div className="mb-2.5"><label className={labelCls}>Usage Rights</label><div className="flex gap-1">{[{id:"ad",label:"Ad Rights"},{id:"media",label:"Media (Perpetual)"}].map(u=>(<button key={u.id} onClick={()=>setUsage(u.id)} className={`flex-1 rounded-[5px] border py-1.5 text-[12px] font-medium ${usage===u.id?chipOn:chipOff}`}>{u.label}</button>))}</div>
              {usage==="ad"&&<div className="mt-[5px]"><Slider value={adDays} onChange={setAdDays} min={7} max={365} step={1} suffix="d"/></div>}</div>
            <div className="mb-2.5"><label className={labelCls}>Reference Creator</label><input value={refLink} onChange={e=>setRefLink(e.target.value)} placeholder="Profile link..." className={inputCls}/></div>
          </>)}
          {svc==="AEO"&&<div className="mb-2.5"><label className={labelCls}>Target Queries</label><textarea value={creatorDesc} onChange={e=>setCreatorDesc(e.target.value)} rows={3} placeholder="Queries to rank for..." className={`${inputCls} resize-y`}/></div>}
          {svc==="Offline Activation"&&<><div className="mb-2.5"><label className={labelCls}>Activation Type</label><textarea value={creatorDesc} onChange={e=>setCreatorDesc(e.target.value)} rows={2} placeholder="Pop-up, sampling..." className={`${inputCls} resize-y`}/></div><div className="mb-2.5"><label className={labelCls}>Locations</label><input value={refLink} onChange={e=>setRefLink(e.target.value)} placeholder="Mumbai, Bangalore..." className={inputCls}/></div></>}
          <button onClick={()=>{if(canSubmit)onSubmit({svc,budget:parseFloat(budgetText),description,details:{brandCat,poc1,poc2,platforms,numCreators,niches,sizes,ageGroups,regions,tiers,languages,products,productVols,usage,adDays,refLink,creatorDesc}});}} className={`w-full rounded-[7px] py-[9px] text-[12.5px] font-semibold ${canSubmit?"cursor-pointer bg-accent text-white":"cursor-not-allowed bg-well text-mute"}`}>Submit</button>
        </>)}
      </div>
    </div>
  </div>);}

/* ═══ CARD ═══ */
function Card({campaign:c,onClick,delay=0}){const P=useP();const[hov,setHov]=useState(false);const done=c.phase==="completed";const pending=c.status==="pending";
  return(<div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} className={`anim-up cursor-pointer rounded-[11px] border-[1.5px] px-[15px] py-[13px] transition-all duration-250 ${done?"bg-done opacity-50":hov?"bg-wash":"bg-surface"} ${hov?"-translate-y-px":""}`}
    style={{animationDelay:`${delay}ms`,borderColor:pending?P.amber+"60":hov&&!done?P.accent+"30":P.border}}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1"><h3 className="truncate text-[13.5px] font-medium leading-[1.3] text-ink">{c.name}</h3></div>
      {pending&&<span className="shrink-0 rounded bg-amber/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber">Pending</span>}
    </div>
    <div className="mt-2.5 flex items-end gap-3.5">
      {[["Reach",c.reach],["Eng.",c.engagement]].map(([l,v])=>(<div key={l}><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div><div className={`mt-px text-[13.5px] font-semibold ${done?"text-donetxt":"text-ink"}`}>{v}</div></div>))}
      <div className="ml-auto flex items-center gap-[7px]"><span className={`text-[12px] ${done?"text-donetxt":"text-sub"}`}>{c.start}—{c.end}</span><Donut value={c.progress}/></div>
    </div>
    <div className={`flex gap-1 overflow-hidden transition-all duration-250 ${hov?"mt-[7px] max-h-[22px] opacity-100":"max-h-0 opacity-0"}`}>
      {[c.service,c.region].map(t=>(<span key={t} className="rounded-[3px] bg-well px-[5px] py-0.5 text-[10.5px] text-sub">{t}</span>))}</div>
  </div>);}

/* ═══ DETAIL PANEL ═══ */
function DetailPanel({campaign:c,onClose,userRole}){const P=useP();
  const[tab,setTab]=useState("overview");const chatEndRef=useRef(null);const[chatInput,setChatInput]=useState("");
  const[messages,setMessages]=useState(c.chat||[]);const[creators,setCreators]=useState(c.creators||[]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages,tab]);
  const sendMsg=()=>{if(!chatInput.trim())return;setMessages(p=>[...p,{from:"You",role:"client",time:"Just now",msg:chatInput.trim()}]);setChatInput("");};

  const updateApproval=(idx,role,val)=>{setCreators(prev=>prev.map((cr,i)=>{if(i!==idx)return cr;const a={...cr.approval};
    if(role.endsWith("Lock")){a[role.replace("Lock","")+"Locked"]=true;}else{a[role]=val;}
    return{...cr,approval:a};}));};

  const isAEO=c.service==="AEO";const numCr=creators.length;
  const numDel=creators.reduce((s,cr)=>{const m=cr.deliverables.match(/\d+/g);return s+(m?m.reduce((a,n)=>a+parseInt(n),0):0);},0);
  const needsAction=creators.filter(cr=>["pending_brand","in_negotiation","rework","concept_received","video_received"].includes(cr.status));

  const mkBD=(f)=>{if(!creators.length)return[];const g={};creators.forEach(cr=>{g[cr[f]||"Other"]=(g[cr[f]||"Other"]||0)+1;});return Object.entries(g).map(([k,v])=>({label:k,value:v}));};
  const bd=creators.length?{niche:mkBD("niche"),size:mkBD("size"),region:mkBD("region")}:null;
  const engByCreator=creators.filter(c2=>c2.engRate!=="—").map(c2=>({label:c2.name.split(" ")[0],value:parseFloat(c2.engRate)}));
  const engByNiche=(()=>{const g={},c2={};creators.forEach(cr=>{if(cr.engRate!=="—"){const n=cr.niche;g[n]=(g[n]||0)+parseFloat(cr.engRate);c2[n]=(c2[n]||0)+1;}});return Object.entries(g).map(([k,v])=>({label:k,value:Math.round((v/c2[k])*10)/10}));})();
  const engBD=creators.length?{creator:engByCreator,niche:engByNiche}:null;

  const tabs=[{id:"overview",label:"Overview"},{id:"brief",label:"Brief"},...(!isAEO?[{id:"creators",label:"Creators",count:numCr||null}]:[]),...(c.queries?[{id:"queries",label:"Queries"}]:[]),{id:"chat",label:"Chat",count:messages.length||null}];

  return(<div className="fixed inset-0 z-[200] flex justify-end">
    <div onClick={onClose} className="fade-in absolute inset-0 bg-[rgba(3,6,16,0.8)] backdrop-blur-[6px]"/>
    <div className="slide-in relative flex w-[min(680px,94vw)] flex-col overflow-hidden border-l border-line bg-page">
      <div className="shrink-0 border-b border-line px-[18px] pt-3.5">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1"><h2 className="font-serif text-[20px] italic font-semibold text-ink">{c.name}</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-accent">{c.service}</span>
            <p className="mt-[3px] text-[12px] leading-normal text-sub">{c.brief}</p></div>
          <button onClick={onClose} className={`${closeBtnCls} shrink-0`}>✕</button></div>
        {needsAction.length>0&&(<div className="mb-[7px] flex items-center gap-[5px] rounded-[5px] border border-amber/[0.08] bg-amber/[0.03] px-[9px] py-[5px]">
          <Dot color={P.amber}/><span className="flex-1 text-[12px] text-amber">{needsAction.length} need{needsAction.length===1?"s":""} input</span>
          <button onClick={()=>setTab("creators")} className="text-[11px] font-medium text-accent">Review →</button></div>)}
        <div className="flex">{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-[3px] border-b-2 px-[11px] py-1.5 text-[11px] font-medium ${tab===t.id?"border-accent text-accent":"border-transparent text-mute"}`}>
          {t.label}{t.count!=null&&<span className={`rounded px-1 py-px text-[10px] font-bold ${tab===t.id?"bg-accent/[0.08] text-accent":"bg-well text-mute"}`}>{t.count}</span>}
        </button>))}</div></div>

      <div className="flex-1 overflow-y-auto px-[18px] pb-[18px] pt-3">
        {tab==="overview"&&(<div>
          <PhaseTracker currentPhase={c.phase}/>
          <div className="mb-[5px] grid grid-cols-3 gap-[5px]">
            <BudgetCard value={c.budget} creators={creators}/>
            <MetricCard label="Reach" value={c.reach} breakdowns={bd}/>
            <MetricCard label="Views" value={c.views} breakdowns={bd}/>
            <MetricCard label="Impressions" value={c.impressions} breakdowns={bd}/>
            <MetricCard label="Creators" value={`${numCr}`}/>
            <MetricCard label="Deliverables" value={`${numDel}`}/>
          </div>
          <MetricCard label="Engagement Rate" value={c.engRate} breakdowns={engBD} suffix="%"/>
          <div className="mb-2.5 mt-[5px] rounded-lg border border-line bg-surface px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Timeline</div><div className="mt-0.5 text-[12.5px] font-medium text-ink">{c.start} — {c.end}</div></div>
              <span className="text-[12.5px] font-semibold text-accent">{c.progress}%</span></div>
            <div className="mt-[5px] h-[3px] rounded-sm bg-well"><div className="h-full rounded-sm bg-accent" style={{width:`${c.progress}%`}}/></div></div>
          <div className="mb-2.5 flex flex-wrap gap-3.5 rounded-[7px] border border-line bg-surface px-3 py-2">
            {[["Service",c.service],["Region",c.region]].map(([k,v])=>(<div key={k}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{k}</div><div className="mt-px text-[12px] font-medium text-ink">{v}</div></div>))}</div>
          {c.topAssets?.length>0&&(<div><div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Top Performing Assets</div>
            <div className="flex gap-1.5 overflow-x-auto pb-[3px]">{c.topAssets.map((a,i)=>(<div key={i} className="flex min-w-[130px] flex-col items-center gap-[3px] rounded-[9px] border border-line bg-surface px-3 py-2.5">
              <div className="flex size-[38px] items-center justify-center rounded-full bg-accent/[0.08] text-[13px] font-bold text-accent">{a.avatar}</div>
              <span className="text-[11px] font-medium text-ink">{a.creator}</span><span className="text-[10.5px] text-accent">{a.handle}</span><span className="text-[10px] text-sub">{a.label}</span>
              <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="rounded-[3px] bg-accent/5 px-1.5 py-0.5 text-[10px] text-accent no-underline">View →</a>
            </div>))}</div>
            <Observations creators={creators} topAssets={c.topAssets}/>
          </div>)}
        </div>)}

        {tab==="brief"&&<BriefPage lockedBrief={c.lockedBrief} pendingBrief={c.pendingBrief}/>}

        {tab==="creators"&&(<div>
          <div className="mb-2 flex items-center gap-[5px] rounded border border-accent/[0.03] bg-accent/[0.015] px-2 py-1">
            <span className="text-[10.5px] text-sub">Viewing as</span><span className="rounded-[3px] bg-accent/[0.07] px-[5px] py-0.5 text-[10px] font-semibold uppercase text-accent">{userRole==="management"?"Mgmt":"Exec"}</span>
            <div className="ml-auto"><StatusLegend/></div></div>
          {creators.length>0?creators.map((cr,i)=><CreatorRow key={i} cr={cr} idx={i} userRole={userRole} onUpdateApproval={updateApproval}/>):(
            <div className="px-5 py-[34px] text-center"><div className="mb-1.5 text-2xl opacity-[0.12]">{["👤","👤","👤"].map((e,i)=>(<span key={i} className="bounce-1 mx-px inline-block" style={{animationDelay:`${i*0.15}s`}}>{e}</span>))}</div>
              <div className="text-[12.5px] text-sub">No creators yet</div></div>)}
        </div>)}

        {tab==="queries"&&c.queries?.map((q,i)=>(<div key={i} className="anim-up mb-1 flex items-center gap-2 rounded-[7px] border border-line bg-surface px-[11px] py-2" style={{animationDelay:`${i*30}ms`}}>
          <div className="flex-[2]"><div className="text-[12.5px] font-medium text-ink">{q.query}</div><div className="mt-px text-[11px] text-mute">{q.volume}</div></div>
          <div className="flex items-center gap-[3px]"><Dot color={q.status==="live"?P.green:P.amber}/><span className="text-[11px] capitalize text-sub">{q.status}</span></div>
          <span className={`text-[11px] ${q.position!=="—"?"font-semibold text-green":"font-normal text-mute"}`}>{q.position}</span>
          <span className="text-[11px] text-mute">{q.engine}</span></div>))}

        {tab==="chat"&&(<div>
          {messages.length===0&&<div className="px-5 py-[30px] text-center text-[12px] text-mute">No messages yet.</div>}
          {messages.map((m,i)=>{const isYou=m.from==="You";const rc=m.role==="management"?P.accent:m.role==="execution"?P.pink:P.mute;return(
            <div key={i} className={`anim-up mb-1.5 flex flex-col ${isYou?"items-end":"items-start"}`} style={{animationDelay:`${i*15}ms`}}>
              <div className="mb-0.5 flex items-center gap-[3px]">
                <span className="text-[11px] font-medium text-ink">{m.from}</span>
                {!isYou&&m.role!=="system"&&<span className="rounded-sm px-[3px] py-px text-[9px] font-semibold uppercase" style={{color:rc,background:`${rc}15`}}>{m.role}</span>}
                <span className="text-[10px] text-mute">{m.time}</span></div>
              <div className={`max-w-[78%] rounded-[7px] border px-2.5 py-1.5 text-[12.5px] leading-normal text-ink ${isYou?"border-accent/[0.07] bg-accent/[0.04]":"border-line bg-surface"}`}>{m.msg}</div>
            </div>);})}
          <div ref={chatEndRef}/></div>)}
      </div>

      {tab==="chat"&&(<div className="shrink-0 border-t border-line bg-page px-[18px] py-[7px]">
        <div className="flex items-center gap-1 rounded-md border border-line bg-surface py-[3px] pl-2.5 pr-[3px]">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Type..."
            className="flex-1 border-none bg-transparent text-[12px] text-ink outline-none"/>
          <button onClick={sendMsg} className={`rounded-[5px] px-2.5 py-[5px] text-[12px] font-semibold ${chatInput.trim()?"bg-accent text-white":"bg-well text-mute"}`}>Send</button>
        </div>
      </div>)}
    </div>
  </div>);}

/* ═══ MAIN ═══ */
export default function CampaignsPage(){
  const { P, setPage, navParams } = useApp();
  const[campaigns,setCampaigns]=useState(null);const[error,setError]=useState(null);const[selected,setSelected]=useState(null);
  const[view,setView]=useState("board");const[search,setSearch]=useState("");
  const[showNewReq,setShowNewReq]=useState(false);
  const[toast,setToast]=useState("");const[svcFilter,setSvcFilter]=useState("all");
  const userRole="management"; // client-side approvals default to the management view

  const { user } = useAuth();

  useEffect(()=>{
    if (!user?.clientName) return;
    PortalAPI.campaigns(user.clientName).then(data=>setCampaigns(data.map(toViewCampaign))).catch(e=>setError(e.message));
  },[user?.clientName]);

  // Auto-open campaign when navigated from another page
  useEffect(() => {
    if (navParams?.campaignId && campaigns) {
      const match = campaigns.find(c => c.id === navParams.campaignId || c.name === navParams.campaignId);
      if (match) setSelected(match);
    }
  }, [navParams?.campaignId, campaigns]);

  // New requirements are local-only until a portal submission endpoint exists
  // on the backend — they show as "Pending" but won't survive a refresh.
  const handleSubmit=(form)=>{
    setCampaigns(p=>[{id:`req_${Date.now()}`,name:form.description?.slice(0,35)||`${form.svc} Campaign`,service:form.svc,region:"—",phase:"brief",progress:0,reach:"—",engagement:"—",impressions:"—",engRate:"—",views:"—",start:"—",end:"—",budget:`₹${form.budget}L`,brief:form.description||"",lockedBrief:null,status:"pending",creators:[],topAssets:[],chat:[],
      pendingBrief:{objective:form.description||"",targetAudience:"",keyMessages:"",deliverables:"",budget:`₹${form.budget}L`,timeline:"",vars:{objective:"pending",targetAudience:"waiting",keyMessages:"waiting",deliverables:"waiting",budget:"pending",timeline:"waiting"}}},...(p||[])]);
    setShowNewReq(false);setToast("Requirement submitted!");setTimeout(()=>setToast(""),3000);};

  if(error)return<ErrorState message={error}/>;
  if(!campaigns)return<PageSkeleton/>;

  const filtered=campaigns.filter(c=>{if(search&&!c.name.toLowerCase().includes(search.toLowerCase()))return false;if(svcFilter!=="all"&&c.service!==svcFilter)return false;return true;});
  const allServices=[...new Set(campaigns.map(c=>c.service))];
  const segBtn=(on)=>`px-2 py-1 text-[10.5px] font-medium whitespace-nowrap ${on?"bg-accent/5 text-accent":"bg-transparent text-mute"}`;

  return(<>
    <div className="min-h-screen bg-page font-sans text-ink">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-7">
        <header className="pb-3 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="font-serif text-[22px] italic font-semibold tracking-[-0.02em] text-ink">Campaigns</h1>
            <div className="flex items-center gap-2.5">
              <div className="flex items-baseline gap-3">
                {campaigns.filter(c=>c.status==="pending").length>0&&<div className="flex items-baseline gap-0.5"><span className="text-[15px] font-semibold text-amber">{campaigns.filter(c=>c.status==="pending").length}</span><span className="text-[10.5px] text-mute">Pending</span></div>}
                <div className="flex items-baseline gap-0.5"><span className="text-[15px] font-semibold text-ink">{campaigns.filter(c=>c.status==="active").length}</span><span className="text-[10.5px] text-mute">Active</span></div>
                <div className="flex items-baseline gap-0.5"><span className="text-[15px] font-semibold text-donetxt">{campaigns.filter(c=>c.status==="done").length}</span><span className="text-[10.5px] text-mute">Done</span></div></div>
              <button onClick={()=>setShowNewReq(true)} className="rounded-md bg-accent px-[13px] py-1.5 text-[12px] font-semibold text-white">+ New</button>
            </div></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-line pt-2.5">
            <div className="flex items-center gap-1.5">
              <div className="flex w-40 items-center gap-[5px] rounded-[5px] border border-line bg-surface px-2 py-1">
                <span className="text-[12px] text-mute">⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-full border-none bg-transparent text-[12px] text-ink outline-none"/></div>
              {/* Service filter */}
              <div className="flex overflow-hidden rounded-[5px] border border-line bg-surface">
                <button onClick={()=>setSvcFilter("all")} className={segBtn(svcFilter==="all")}>All</button>
                {allServices.map(s=>(<button key={s} onClick={()=>setSvcFilter(s)} className={segBtn(svcFilter===s)}>{s==="Influencer Marketing"?"IM":s==="Performance Ads"?"Ads":s}</button>))}
              </div>
            </div>
            <div className="flex items-center gap-[3px]">
              <div className="flex overflow-hidden rounded-[5px] border border-line bg-surface">
                {[["board","Board"],["grid","Grid"]].map(([k,l])=>(<button key={k} onClick={()=>setView(k)} className={`px-[9px] py-1 text-[11px] font-medium ${view===k?"bg-accent/5 text-accent":"bg-transparent text-mute"}`}>{l}</button>))}</div>
            </div></div>
        </header>

        {toast&&<div className="anim-up mb-2 flex items-center gap-[5px] rounded-[5px] border border-green/[0.09] bg-green/[0.04] px-2.5 py-1.5"><Dot color={P.green}/><span className="text-[12px] font-medium text-green">{toast}</span></div>}

        {campaigns.length===0&&(<div className="pb-8"><EmptyState icon="▤" title="No campaigns yet"
          hint="Send us your first requirement and we'll take it from brief to live."
          actionLabel="+ New Requirement" onAction={()=>setShowNewReq(true)}/></div>)}
        {campaigns.length>0&&view==="board"&&<div className="mb-1 text-[11px] text-mute md:hidden">Swipe sideways to see all stages →</div>}
        {campaigns.length>0&&view==="board"&&(<div className="flex min-h-[52vh] gap-2 overflow-x-auto pb-8">
          {PHASES.map((phase,pi)=>{const items=filtered.filter(c=>c.phase===phase.id);return(<div key={phase.id} className="anim-up flex min-w-[190px] flex-col" style={{animationDelay:`${pi*35}ms`,flex:`1 1 ${100/PHASES.length}%`}}>
            <div className="mb-1 flex items-center justify-between px-[5px] py-1"><span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-sub">{phase.label}</span><span className="text-[10.5px] font-semibold text-mute">{items.length}</span></div>
            <div className="flex flex-1 flex-col gap-[5px]">{items.map((c,ci)=><Card key={c.id} campaign={c} delay={pi*35+ci*25} onClick={()=>setSelected(c)}/>)}
              {items.length===0&&<div className="flex min-h-[45px] flex-1 items-center justify-center rounded-lg border border-dashed border-line px-1.5 py-4 text-center text-[11px] text-mute">—</div>}</div>
          </div>);})}
        </div>)}
        {campaigns.length>0&&view==="grid"&&(<div className="grid gap-1.5 pb-8" style={{gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))"}}>{filtered.map((c,i)=><Card key={c.id} campaign={c} delay={i*25} onClick={()=>setSelected(c)}/>)}</div>)}
      </div>
      {selected&&<DetailPanel campaign={selected} onClose={()=>setSelected(null)} userRole={userRole}/>}
      {showNewReq&&<NewReqModal onClose={()=>setShowNewReq(false)} onSubmit={handleSubmit}/>}
    </div>
  </>);}
