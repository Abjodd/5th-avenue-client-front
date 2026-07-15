import { useState, useEffect, useRef } from "react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI, phaseOf } from "../lib/api";
import { parseFollowers, sizeOf, fmtNum, fmtINR, initials, prettyDate } from "../lib/format";
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

/* Shared class strings for chips / selectable pills — premium glass style */
const chipOn  = "border-accent/20 bg-accent/[0.09] text-accent shadow-sm";
const chipOff = "border-[rgba(15,23,42,0.08)] bg-well/70 text-sub hover:text-ink";
const inputCls = "w-full rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-2 text-[13px] text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]";
const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute";
const closeBtnCls = "flex size-7 items-center justify-center rounded-full border border-[rgba(15,23,42,0.08)] bg-well/70 text-[13px] text-sub transition-all duration-200 hover:bg-red/[0.08] hover:text-red";

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
    start: prettyDate(c.start),
    end: prettyDate(c.end),
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
  const b="flex size-[28px] items-center justify-center rounded-[8px] border border-[rgba(15,23,42,0.08)] bg-white/70 text-[14px] text-ink shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0";
  return(<div className="flex items-center gap-2"><button className={`${b} ${value<=min?"opacity-30":""}`} onClick={()=>onChange(Math.max(min,value-1))}>−</button><span className="min-w-6 text-center text-[14px] font-semibold text-ink">{value}</span><button className={b} onClick={()=>onChange(value+1)}>+</button></div>);}

function Slider({value,onChange,min=0,max=100,step=1,suffix=""}){const P=useP();const pct=((value-min)/(max-min))*100;
  return(<div className="flex w-full items-center gap-2"><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none" style={{background:`linear-gradient(to right,${P.accent} ${pct}%,${P.barBg} ${pct}%)`}}/><span className="min-w-12 text-right text-[12.5px] font-semibold text-ink">{value}{suffix}</span></div>);}

function ChipSelect({options,selected,onChange}){return(<div className="flex flex-wrap gap-1.5">{options.map(o=>{const a=selected.includes(o);return(<button key={o} onClick={()=>onChange(a?selected.filter(x=>x!==o):[...selected,o])} className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-150 ${a?chipOn:chipOff}`}>{o}</button>);})}</div>);}

function DropdownSelect({options:io,value,onChange,placeholder,allowNew}){const[open,setOpen]=useState(false);const[opts,setOpts]=useState(io);const[nv,setNv]=useState("");const ref=useRef(null);
  useEffect(()=>{if(!open)return;const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  return(<div ref={ref} className="relative"><button onClick={()=>setOpen(!open)} className={`flex w-full items-center justify-between rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-2 text-left text-[13px] backdrop-blur-sm transition-all duration-200 ${value?"text-ink":"text-mute"}`}><span className="truncate">{value||placeholder}</span><span className="text-[10px] text-mute">▾</span></button>
    {open&&(<div className="absolute inset-x-0 top-[calc(100%+5px)] z-[60] max-h-[170px] overflow-y-auto rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-white/95 py-1 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
      {opts.map(o=>(<div key={o} onClick={()=>{onChange(o);setOpen(false);}} className="cursor-pointer px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-accent/[0.06]">{o}</div>))}
      {allowNew&&(<div className="flex gap-1 border-t border-[rgba(15,23,42,0.06)] px-2.5 py-1.5"><input value={nv} onChange={e=>setNv(e.target.value)} placeholder="Add new..." className="flex-1 rounded-lg border border-[rgba(15,23,42,0.08)] bg-white/70 px-2 py-1 text-[12px] text-ink outline-none"/><button onClick={()=>{if(nv.trim()){setOpts(p=>[...p,nv.trim()]);onChange(nv.trim());setNv("");setOpen(false);}}} className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">Add</button></div>)}
    </div>)}</div>);}

function HBars({data}){if(!data||!data.length)return null;const max=Math.max(...data.map(d=>d.value),0.1);
  return(<div className="flex flex-col gap-1.5">{data.map((d,i)=>(<div key={i} className="flex items-center gap-2"><span className="w-16 shrink-0 truncate text-right text-[10px] text-sub">{d.label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-well"><div className="h-full min-w-0.5 rounded-full transition-[width] duration-500" style={{width:`${(d.value/max)*100}%`,background:BCOLORS[i%BCOLORS.length]}}/></div><span className="w-8 shrink-0 text-[10px] font-semibold text-ink">{typeof d.value==="number"&&d.value%1?d.value.toFixed(1):d.value}{d.suffix||""}</span></div>))}</div>);}

/* ═══ PHASE TRACKER — more significant ═══ */
function PhaseTracker({currentPhase}){const P=useP();const idx=PHASES.findIndex(p=>p.id===currentPhase);
  return(<div className="mb-4 rounded-[18px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-6 py-5 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl">
    <div className="flex items-center">
      {PHASES.map((p,i)=>{const isCur=i===idx,isDone=i<idx;
        return(<div key={p.id} className="flex flex-1 items-center">
          <div className="relative flex flex-1 flex-col items-center gap-[6px]">
            <div className={`flex size-10 items-center justify-center rounded-[12px] border-2 text-[17px] transition-all duration-300 ${isDone?"border-green bg-green/[0.08]":isCur?"border-accent bg-accent/[0.08]":"border-ink/5 bg-well"}`} style={{boxShadow:isCur?`0 0 16px ${P.accent}35`:isDone?`0 2px 8px ${P.green}20`:"none"}}>{isDone?"✓":p.icon}</div>
            <span className={`text-center text-[10.5px] uppercase tracking-[0.04em] ${isCur?"font-bold text-ink":isDone?"font-medium text-green":"font-normal text-mute"}`}>{p.label}</span>
            {isCur&&<div className="pulse absolute -top-1 right-[20%] size-2 rounded-full bg-accent"/>}
          </div>
          {i<PHASES.length-1&&(<div className={`mb-5 h-0.5 max-w-10 flex-[0_0_100%] rounded-full transition-colors duration-300 ${isDone?"bg-green":"bg-ink/[0.05]"}`}/>)}
        </div>);})}
    </div>
  </div>);}

/* ═══ BUDGET CARD ═══ */
// Plain figure only — the DB doesn't store an operational budget split, so
// none is invented here. A real split can return once the backend has one.
function BudgetCard({value}){
  return(<div className="rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Budget</div>
    <div className="mt-1 text-[18px] font-bold text-ink">{value}</div>
  </div>);}

/* ═══ METRIC CARD — optional expandable breakdown; suffix ("%") for rates ═══ */
function MetricCard({label,value,breakdowns,suffix=""}){const[open,setOpen]=useState(false);const[filter,setFilter]=useState(breakdowns?Object.keys(breakdowns)[0]:null);
  const has=breakdowns&&Object.keys(breakdowns).length>0&&value!=="—"&&value!=="0";
  return(<div className={`rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md ${has?"cursor-pointer":""}`} onClick={()=>has&&setOpen(!open)}>
    <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>{has&&<span className="text-[9px] text-accent">{open?"▴":"▾"}</span>}</div>
    <div className={`mt-1 text-[18px] font-bold ${value==="—"||value==="0"?"text-donetxt":"text-ink"}`}>{value}</div>
    {open&&breakdowns&&(<div className="mt-2.5 border-t border-[rgba(15,23,42,0.06)] pt-2.5">
      <div className="mb-2 flex flex-wrap gap-1">{Object.keys(breakdowns).map(f=>(<button key={f} onClick={e=>{e.stopPropagation();setFilter(f);}} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-all duration-150 ${filter===f?chipOn:"border-[rgba(15,23,42,0.08)] bg-transparent text-mute"}`}>{f}</button>))}</div>
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

  return(<div className="mt-4">
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Observations</div>
    <div className={`rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md ${strategies.length?"mb-3":""}`}>
      {obs.map((o,i)=>(<div key={i} className={`flex items-start gap-1.5 ${i<obs.length-1?"mb-1.5":""}`}>
        <span className="mt-[3px] shrink-0 text-[10px] text-accent">●</span>
        <span className="text-[12px] leading-normal text-ink">{o}</span>
      </div>))}
    </div>
    {strategies.length>0&&(<>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Strategy Insights</div>
      <div className="rounded-[14px] border border-accent/[0.1] bg-accent/[0.03] px-4 py-3 shadow-sm backdrop-blur-md">
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
      </span>):(isOwn?(<div className="flex gap-1">
        <button onClick={()=>onUpdateApproval(idx,role,"tick")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-green transition-all duration-150 ${val==="tick"?"border-green bg-green/[0.08] shadow-sm":"border-[rgba(15,23,42,0.08)] bg-transparent hover:border-green/40"}`}>✓</button>
        <button onClick={()=>onUpdateApproval(idx,role,"cross")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-red transition-all duration-150 ${val==="cross"?"border-red bg-red/[0.08] shadow-sm":"border-[rgba(15,23,42,0.08)] bg-transparent hover:border-red/40"}`}>✗</button>
        {val&&<button onClick={()=>onUpdateApproval(idx,role+"Lock",true)} className="rounded-full border border-accent/15 bg-accent/[0.06] px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm">Lock</button>}
      </div>):(<span className={`text-[11px] opacity-50 ${val==="tick"?"text-green":val==="cross"?"text-red":"text-mute"}`}>{val==="tick"?"✓":"✗"}{val?" ("+label+")":"pending"}</span>))}
    </div>);};

  return(<div className="anim-up mb-2 rounded-[16px] border bg-white/65 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md" style={{animationDelay:`${idx*35}ms`,borderColor:actionable?P.amber+"25":autoResult==="approved"?P.green+"25":autoResult==="rejected"?P.red+"20":"rgba(15,23,42,0.06)"}}>
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] text-[12.5px] font-semibold text-accent shadow-sm">{cr.avatar||cr.name[0]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="text-[13px] font-medium text-ink">{cr.name}</span>
          <a href={cr.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-[12px] text-accent no-underline hover:underline">{cr.handle}</a></div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[12px] text-sub"><span>{cr.followers}</span><span>{cr.platform}</span><span>{cr.deliverables}</span><span className="font-medium text-accent">ER: {cr.engRate}</span></div>
      </div>
      {autoResult&&<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] shadow-sm ${autoResult==="approved"?"bg-green/[0.08] text-green":"bg-red/[0.06] text-red"}`}>{autoResult}</span>}
      <StatusPill tier={st.t}>{st.label}</StatusPill>
    </div>
    <button onClick={()=>setExpanded(!expanded)} className="mt-1.5 p-0 text-[11px] font-medium text-accent transition-opacity hover:opacity-70">{expanded?"Show less ▴":"See more ▾"}</button>
    {expanded&&(<div className="fi mt-1.5 flex flex-col gap-1 border-t border-[rgba(15,23,42,0.06)] pt-2">
      <div className="flex flex-wrap gap-2.5 text-[11px] text-sub"><span>Niche: <b className="text-ink">{cr.niche}</b></span><span>Size: <b className="text-ink">{cr.size}</b></span><span>State: <b className="text-ink">{cr.region}</b></span><span>Language: <b className="text-ink">{cr.language}</b></span></div>
      <div className="mt-0.5 flex gap-3.5 text-[12px]">
        <span className="text-mute">Brief: {cr.briefDoc?<a href={cr.briefDoc.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-accent no-underline hover:underline">📄 {cr.briefDoc.name}</a>:<em>Not uploaded</em>}</span>
        <span className="text-mute">Video: {cr.videoDoc?<a href={cr.videoDoc.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="text-accent no-underline hover:underline">🎬 {cr.videoDoc.name}</a>:<em>Not uploaded</em>}</span>
      </div>
    </div>)}
    {actionable&&!autoResult&&(<div className="mt-2 flex items-center gap-4 border-t border-[rgba(15,23,42,0.06)] pt-2">
      {renderApprovalUI("exec","Exec")}{renderApprovalUI("mgmt","Mgmt")}
    </div>)}
  </div>);}

/* ═══ BRIEF PAGE — with variable-level status ═══ */
function BriefPage({lockedBrief,pendingBrief}){const P=useP();
  const brief=lockedBrief||pendingBrief;if(!brief)return(<div className="px-5 py-9 text-center text-mute"><div className="mb-[5px] text-[26px] opacity-15">📋</div><div className="text-[13px]">No brief created yet</div></div>);
  const isLocked=!!lockedBrief;const vars=brief.vars||{};
  const statusIcon=(s)=>s==="approved"?{icon:"✓",color:P.green}:s==="rejected"?{icon:"✗",color:P.red}:s==="pending"?{icon:"⏳",color:P.amber}:{icon:"…",color:P.mute};
  return(<div>
    <div className={`mb-3 flex items-center gap-1.5 rounded-[12px] border px-3 py-2 backdrop-blur-sm ${isLocked?"border-green/[0.12] bg-green/[0.03]":"border-amber/[0.12] bg-amber/[0.03]"}`}>
      <Dot color={isLocked?P.green:P.amber}/><span className={`text-[12px] font-medium ${isLocked?"text-green":"text-amber"}`}>{isLocked?`Locked ${brief.approvedOn}`:"Waiting — under review by 5th Avenue"}</span>
      <span className="ml-auto text-[10.5px] italic text-mute">{isLocked?"Read-only":"Pending approval"}</span></div>
    {[["Objective","objective"],["Target Audience","targetAudience"],["Key Messages","keyMessages"],["Deliverables","deliverables"],["Budget","budget"],["Timeline","timeline"]].map(([label,key])=>{
      const val=brief[key];const si=statusIcon(vars[key]);
      return(<div key={key} className="mb-1.5 flex items-start gap-2 rounded-[12px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
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
        <div className={`max-w-[85%] rounded-[14px] border px-3.5 py-2.5 text-[13px] leading-normal text-ink shadow-sm ${m.role==="user"?"border-accent/[0.1] bg-accent/[0.05]":"border-[rgba(15,23,42,0.06)] bg-white/70"}`}>{m.content}</div>
      </div>))}
      <div ref={endRef}/>
    </div>

    {/* Options / Input area */}
    {curStep&&!isDone&&(<div className="border-t border-[rgba(15,23,42,0.06)] pt-2.5">
      {curStep.type==="text"?(
        <div className="flex gap-1.5">
          <input value={customInput} onChange={e=>setCustomInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleTextSubmit()} placeholder={curStep.placeholder||"Type here..."} className="flex-1 rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-all duration-200 focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"/>
          <button onClick={handleTextSubmit} className={`rounded-[12px] px-4 py-2.5 text-[12px] font-semibold shadow-sm transition-all duration-150 ${customInput.trim()?"bg-accent text-white hover:-translate-y-px hover:shadow-md":"bg-well text-mute"}`}>Next</button>
          {curStep.optional&&<button onClick={handleSkip} className="rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-well/70 px-3 py-2.5 text-[12px] text-mute">Skip</button>}
        </div>
      ):curStep.multi?(
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">{curStep.options.map(o=>{const sel=multiSel.includes(o);return(<button key={o} onClick={()=>setMultiSel(sel?multiSel.filter(x=>x!==o):[...multiSel,o])} className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150 ${sel?chipOn:chipOff}`}>{o}</button>);})}</div>
          <button onClick={handleMultiConfirm} disabled={!multiSel.length} className={`w-full rounded-[12px] py-2 text-[12px] font-semibold shadow-sm transition-all duration-150 ${multiSel.length?"cursor-pointer bg-accent text-white hover:-translate-y-px hover:shadow-md":"cursor-not-allowed bg-well text-mute"}`}>Confirm ({multiSel.length} selected)</button>
        </div>
      ):(
        <div>
          <div className="flex flex-wrap gap-1.5">{curStep.options.map(o=>(<button key={o} onClick={()=>handleOption(o)} className="rounded-full border border-accent/[0.15] bg-accent/[0.04] px-4 py-1.5 text-[12px] font-medium text-accent shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-accent/[0.08] hover:shadow-md">{o}</button>))}</div>
          {curStep.allowCustom&&(<div className="mt-2 flex gap-1.5">
            <input value={customInput} onChange={e=>setCustomInput(e.target.value)} placeholder="Or type your own..." className="flex-1 rounded-[10px] border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-1.5 text-[12px] text-ink outline-none"/>
            <button onClick={handleTextSubmit} disabled={!customInput.trim()} className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold shadow-sm ${customInput.trim()?"bg-accent text-white":"bg-well text-mute"}`}>Go</button>
          </div>)}
        </div>
      )}
    </div>)}

    {/* Summary + Submit */}
    {isDone&&(<div className="border-t border-[rgba(15,23,42,0.06)] pt-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-green">Brief Summary</div>
      <div className="rounded-[14px] border border-green/[0.15] bg-white/70 px-3 py-2.5 text-[12px] leading-relaxed text-ink shadow-sm backdrop-blur-sm">
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
      <button onClick={()=>onComplete({svc:data.service||"Influencer Marketing",budget:data._budgetNum||10,description:data.description||"Campaign brief"})} className="mt-2.5 w-full rounded-[12px] bg-accent py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]">Submit Requirement</button>
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
  const modeCard="flex-1 cursor-pointer rounded-[18px] border border-[rgba(15,23,42,0.07)] bg-white/70 px-4 py-6 text-center shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-accent/25 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]";

  return(<div className="fixed inset-0 z-[300] flex items-center justify-center">
    <div onClick={onClose} className="fade-in absolute inset-0 bg-[rgba(3,6,16,0.5)] backdrop-blur-[8px]"/>
    <div className="anim-up relative flex max-h-[90vh] w-[min(560px,94vw)] flex-col overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.07)] bg-[#F7F8FA]/95 shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.06)] px-6 pb-3.5 pt-5">
        <div><h3 className="font-serif text-[20px] italic font-semibold text-ink">New Requirement</h3></div>
        <div className="flex gap-1.5">{mode&&<button onClick={()=>setMode(null)} className="rounded-full border border-[rgba(15,23,42,0.08)] bg-well/70 px-2.5 py-1 text-[11px] text-sub transition-colors hover:text-ink">← Back</button>}
          <button onClick={onClose} className={closeBtnCls}>✕</button></div></div>
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {!mode&&(<div className="flex gap-3 py-5">
          <div onClick={()=>setMode("chat")} className={modeCard}>
            <div className="mb-2.5 text-2xl">💬</div><div className="mb-1 text-[13.5px] font-semibold text-ink">Guided Brief</div><div className="text-[12px] leading-normal text-sub">Answer step-by-step questions. We'll build the brief for you.</div></div>
          <div onClick={()=>setMode("form")} className={modeCard}>
            <div className="mb-2.5 text-2xl">📋</div><div className="mb-1 text-[13.5px] font-semibold text-ink">Manual Form</div><div className="text-[12px] leading-normal text-sub">Fill each field yourself.</div></div>
        </div>)}
        {mode==="chat"&&<GuidedBriefWizard onComplete={d=>onSubmit({svc:d.svc||d.service||"Influencer Marketing",budget:d.budget||5,description:d.description||"Campaign brief"})}/>}
        {mode==="form"&&(<>
          <div className="mb-3"><label className={labelCls}>Service</label><div className="flex gap-1.5">{SERVICES_ALL.map(s=>(<button key={s} onClick={()=>setSvc(s)} className={`flex-1 rounded-[10px] border py-2 text-[12px] font-medium transition-all duration-150 ${svc===s?chipOn:chipOff}`}>{s}</button>))}</div></div>
          <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} placeholder="What do you want to achieve..." className={`${inputCls} resize-y leading-normal`}/></div>
          <div className="mb-3"><label className={labelCls}>Brand Category</label><DropdownSelect options={["Snacks","Beverages","Health","Fashion","Beauty","Tech","FMCG","D2C"]} value={brandCat} onChange={setBrandCat} placeholder="Select..." allowNew/></div>
          <div className="mb-3 flex gap-2"><div className="flex-1"><label className={labelCls}>POC 1</label><DropdownSelect options={TEAM.map(m=>`${m.name} (${m.role})`)} value={poc1} onChange={setPoc1} placeholder="Select..."/></div>
            <div className="flex-1"><label className={labelCls}>POC 2</label><DropdownSelect options={TEAM.map(m=>`${m.name} (${m.role})`)} value={poc2} onChange={setPoc2} placeholder="Select..."/></div></div>

          {/* Budget — slider + manual, capped at 1.5CR (150L) */}
          <div className="mb-3"><label className={labelCls}>Budget (Lakhs ₹) — max 1.5 Cr</label>
            <div className="flex items-center gap-2.5">
              <input type="range" min={1} max={150} step={0.5} value={parseFloat(budgetText)||1} onChange={e=>{setBudgetText(e.target.value);}} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none" style={{background:`linear-gradient(to right,${P.accent} ${((parseFloat(budgetText)||1)/150)*100}%,${P.barBg} ${((parseFloat(budgetText)||1)/150)*100}%)`}}/>
              <div className="flex items-center gap-1 rounded-lg border border-[rgba(15,23,42,0.08)] bg-white/70 px-1.5 py-1">
                <span className="text-[12.5px] text-mute">₹</span>
                <input type="number" min={1} max={150} step={0.5} value={budgetText} onChange={e=>handleBudgetInput(e.target.value)} className="w-[50px] bg-transparent p-1 text-center text-[12.5px] text-ink outline-none"/>
                <span className="text-[12px] text-mute">L</span>
              </div>
            </div>
          </div>

          {showPlatform&&<div className="mb-3"><label className={labelCls}>Platform</label><ChipSelect options={PLATFORMS} selected={platforms} onChange={setPlatforms}/></div>}
          {svc==="Influencer Marketing"&&(<>
            <div className="mb-3 flex items-center justify-between"><label className={`${labelCls} mb-0`}>Number of Creators</label><Stepper value={numCreators} onChange={setNumCreators}/></div>
            <div className="mb-3 rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-sm">
              <div className={`${labelCls} mb-2`}>Creator Requirements</div>
              <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Niche</label><ChipSelect options={NICHES} selected={niches} onChange={setNiches}/></div>
              <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Size</label><ChipSelect options={SIZES} selected={sizes} onChange={setSizes}/></div>
              <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Age</label><ChipSelect options={AGE_GROUPS} selected={ageGroups} onChange={setAgeGroups}/></div>
              <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Region</label><ChipSelect options={REGIONS_ST} selected={regions} onChange={setRegions}/></div>
              <div className="mb-2 flex gap-2"><div className="flex-1"><label className={`${labelCls} text-[10px]`}>Tier</label><ChipSelect options={TIERS} selected={tiers} onChange={setTiers}/></div>
                <div className="flex-1"><label className={`${labelCls} text-[10px]`}>Language</label><DropdownSelect options={LANGUAGES} value="" onChange={v=>{if(!languages.includes(v))setLanguages([...languages,v]);}} placeholder="Add..."/></div></div>
              {languages.length>0&&<div className="mb-1.5 flex flex-wrap gap-1">{languages.map(l=>(<span key={l} className="flex items-center gap-1 rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10.5px] text-accent shadow-sm">{l}<button onClick={()=>setLanguages(languages.filter(x=>x!==l))} className="p-0 text-[10px] text-mute hover:text-red">×</button></span>))}</div>}
            </div>
            <div className="mb-3"><label className={labelCls}>Product & Volume</label><div className="flex flex-col gap-1.5">{IM_PRODUCTS.map(p=>{const a=products.includes(p.id);return(<div key={p.id} className="flex items-center gap-1.5"><button onClick={()=>toggleProduct(p.id)} className={`flex-1 rounded-[10px] border px-3 py-1.5 text-left text-[11px] font-medium transition-all duration-150 ${a?chipOn:chipOff}`}>{p.label}</button>
              {a&&<input type="number" min={1} value={productVols[p.id]||1} onChange={e=>setProductVols({...productVols,[p.id]:Math.max(1,parseInt(e.target.value)||1)})} className="w-[42px] rounded-lg border border-[rgba(15,23,42,0.08)] bg-white/70 p-1 text-center text-[12px] text-ink outline-none"/>}</div>);})}</div></div>
            <div className="mb-3"><label className={labelCls}>Usage Rights</label><div className="flex gap-1.5">{[{id:"ad",label:"Ad Rights"},{id:"media",label:"Media (Perpetual)"}].map(u=>(<button key={u.id} onClick={()=>setUsage(u.id)} className={`flex-1 rounded-[10px] border py-2 text-[12px] font-medium transition-all duration-150 ${usage===u.id?chipOn:chipOff}`}>{u.label}</button>))}</div>
              {usage==="ad"&&<div className="mt-1.5"><Slider value={adDays} onChange={setAdDays} min={7} max={365} step={1} suffix="d"/></div>}</div>
            <div className="mb-3"><label className={labelCls}>Reference Creator</label><input value={refLink} onChange={e=>setRefLink(e.target.value)} placeholder="Profile link..." className={inputCls}/></div>
          </>)}
          {svc==="AEO"&&<div className="mb-3"><label className={labelCls}>Target Queries</label><textarea value={creatorDesc} onChange={e=>setCreatorDesc(e.target.value)} rows={3} placeholder="Queries to rank for..." className={`${inputCls} resize-y`}/></div>}
          {svc==="Offline Activation"&&<><div className="mb-3"><label className={labelCls}>Activation Type</label><textarea value={creatorDesc} onChange={e=>setCreatorDesc(e.target.value)} rows={2} placeholder="Pop-up, sampling..." className={`${inputCls} resize-y`}/></div><div className="mb-3"><label className={labelCls}>Locations</label><input value={refLink} onChange={e=>setRefLink(e.target.value)} placeholder="Mumbai, Bangalore..." className={inputCls}/></div></>}
          <button onClick={()=>{if(canSubmit)onSubmit({svc,budget:parseFloat(budgetText),description,details:{brandCat,poc1,poc2,platforms,numCreators,niches,sizes,ageGroups,regions,tiers,languages,products,productVols,usage,adDays,refLink,creatorDesc}});}} className={`w-full rounded-[12px] py-2.5 text-[12.5px] font-semibold shadow-sm transition-all duration-200 ${canSubmit?"cursor-pointer bg-accent text-white hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(37,99,235,0.35)]":"cursor-not-allowed bg-well text-mute"}`}>Submit</button>
        </>)}
      </div>
    </div>
  </div>);}

/* ═══ CARD ═══ */
function Card({campaign:c,onClick,delay=0}){const P=useP();const[hov,setHov]=useState(false);const done=c.phase==="completed";const pending=c.status==="pending";
  return(<div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} className={`anim-up cursor-pointer rounded-[16px] border-[1.5px] px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-250 ease-out ${done?"bg-well/40 opacity-60":hov?"bg-white/80":"bg-white/65"} ${hov?"-translate-y-1 scale-[1.01] shadow-[0_14px_32px_rgba(15,23,42,0.09)]":""}`}
    style={{animationDelay:`${delay}ms`,borderColor:pending?P.amber+"55":hov&&!done?P.accent+"35":"rgba(15,23,42,0.06)"}}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1"><h3 className="truncate text-[13.5px] font-medium leading-[1.3] text-ink">{c.name}</h3></div>
      {pending&&<span className="shrink-0 rounded-full bg-amber/[0.1] px-2 py-0.5 text-[10px] font-semibold uppercase text-amber shadow-sm">Pending</span>}
    </div>
    <div className="mt-3 flex items-end gap-4">
      {[["Reach",c.reach],["Eng.",c.engagement]].map(([l,v])=>(<div key={l}><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{l}</div><div className={`mt-px text-[13.5px] font-semibold ${done?"text-donetxt":"text-ink"}`}>{v}</div></div>))}
      <div className="ml-auto flex items-center gap-2"><span className={`text-[12px] ${done?"text-donetxt":"text-sub"}`}>{c.start}—{c.end}</span><Donut value={c.progress}/></div>
    </div>
    <div className={`flex gap-1 overflow-hidden transition-all duration-250 ${hov?"mt-2 max-h-[22px] opacity-100":"max-h-0 opacity-0"}`}>
      {[c.service,c.region].map(t=>(<span key={t} className="rounded-full bg-well px-2 py-0.5 text-[10.5px] text-sub">{t}</span>))}</div>
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
    <div onClick={onClose} className="fade-in absolute inset-0 bg-[rgba(3,6,16,0.45)] backdrop-blur-[8px]"/>
    <div className="slide-in relative flex w-[min(680px,94vw)] flex-col overflow-hidden border-l border-[rgba(15,23,42,0.07)] bg-[#F7F8FA]/95 shadow-[-24px_0_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
      <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] px-6 pt-5">
        <div className="mb-2.5 flex items-start justify-between">
          <div className="flex-1"><h2 className="font-serif text-[22px] italic font-semibold text-ink">{c.name}</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-accent">{c.service}</span>
            <p className="mt-1 text-[12px] leading-normal text-sub">{c.brief}</p></div>
          <button onClick={onClose} className={`${closeBtnCls} shrink-0`}>✕</button></div>
        {needsAction.length>0&&(<div className="mb-2 flex items-center gap-1.5 rounded-[12px] border border-amber/[0.12] bg-amber/[0.04] px-3 py-2 backdrop-blur-sm">
          <Dot color={P.amber}/><span className="flex-1 text-[12px] text-amber">{needsAction.length} need{needsAction.length===1?"s":""} input</span>
          <button onClick={()=>setTab("creators")} className="text-[11px] font-medium text-accent hover:underline">Review →</button></div>)}
        <div className="flex">{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-1 border-b-2 px-3 py-2 text-[11.5px] font-medium transition-colors duration-200 ${tab===t.id?"border-accent text-accent":"border-transparent text-mute hover:text-ink"}`}>
          {t.label}{t.count!=null&&<span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${tab===t.id?"bg-accent/[0.1] text-accent":"bg-well text-mute"}`}>{t.count}</span>}
        </button>))}</div></div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {tab==="overview"&&(<div>
          <PhaseTracker currentPhase={c.phase}/>
          <div className="mb-2 grid grid-cols-3 gap-2">
            <BudgetCard value={c.budget} creators={creators}/>
            <MetricCard label="Reach" value={c.reach} breakdowns={bd}/>
            <MetricCard label="Views" value={c.views} breakdowns={bd}/>
            <MetricCard label="Impressions" value={c.impressions} breakdowns={bd}/>
            <MetricCard label="Creators" value={`${numCr}`}/>
            <MetricCard label="Deliverables" value={`${numDel}`}/>
          </div>
          <MetricCard label="Engagement Rate" value={c.engRate} breakdowns={engBD} suffix="%"/>
          <div className="mb-3 mt-2 rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Timeline</div><div className="mt-0.5 text-[12.5px] font-medium text-ink">{c.start} — {c.end}</div></div>
              <span className="text-[12.5px] font-semibold text-accent">{c.progress}%</span></div>
            <div className="mt-2 h-[5px] rounded-full bg-well"><div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{width:`${c.progress}%`}}/></div></div>
          <div className="mb-3 flex flex-wrap gap-4 rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-sm">
            {[["Service",c.service],["Region",c.region]].map(([k,v])=>(<div key={k}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{k}</div><div className="mt-px text-[12px] font-medium text-ink">{v}</div></div>))}</div>
          {c.topAssets?.length>0&&(<div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Top Performing Assets</div>
            <div className="flex gap-2 overflow-x-auto pb-1">{c.topAssets.map((a,i)=>(<div key={i} className="flex min-w-[130px] flex-col items-center gap-1 rounded-[16px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
              <div className="flex size-[38px] items-center justify-center rounded-full bg-accent/[0.1] text-[13px] font-bold text-accent">{a.avatar}</div>
              <span className="text-[11px] font-medium text-ink">{a.creator}</span><span className="text-[10.5px] text-accent">{a.handle}</span><span className="text-[10px] text-sub">{a.label}</span>
              <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="rounded-full bg-accent/[0.07] px-2 py-0.5 text-[10px] text-accent no-underline hover:bg-accent/[0.12]">View →</a>
            </div>))}</div>
            <Observations creators={creators} topAssets={c.topAssets}/>
          </div>)}
        </div>)}

        {tab==="brief"&&<BriefPage lockedBrief={c.lockedBrief} pendingBrief={c.pendingBrief}/>}

        {tab==="creators"&&(<div>
          <div className="mb-2.5 flex items-center gap-1.5 rounded-full border border-accent/[0.06] bg-accent/[0.02] px-3 py-1.5">
            <span className="text-[10.5px] text-sub">Viewing as</span><span className="rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{userRole==="management"?"Mgmt":"Exec"}</span>
            <div className="ml-auto"><StatusLegend/></div></div>
          {creators.length>0?creators.map((cr,i)=><CreatorRow key={i} cr={cr} idx={i} userRole={userRole} onUpdateApproval={updateApproval}/>):(
            <div className="px-5 py-[34px] text-center"><div className="mb-1.5 text-2xl opacity-[0.12]">{["👤","👤","👤"].map((e,i)=>(<span key={i} className="bounce-1 mx-px inline-block" style={{animationDelay:`${i*0.15}s`}}>{e}</span>))}</div>
              <div className="text-[12.5px] text-sub">No creators yet</div></div>)}
        </div>)}

        {tab==="queries"&&c.queries?.map((q,i)=>(<div key={i} className="anim-up mb-1.5 flex items-center gap-2 rounded-[12px] border border-[rgba(15,23,42,0.06)] bg-white/65 px-3.5 py-2.5 shadow-sm backdrop-blur-sm" style={{animationDelay:`${i*30}ms`}}>
          <div className="flex-[2]"><div className="text-[12.5px] font-medium text-ink">{q.query}</div><div className="mt-px text-[11px] text-mute">{q.volume}</div></div>
          <div className="flex items-center gap-1">{<Dot color={q.status==="live"?P.green:P.amber}/>}<span className="text-[11px] capitalize text-sub">{q.status}</span></div>
          <span className={`text-[11px] ${q.position!=="—"?"font-semibold text-green":"font-normal text-mute"}`}>{q.position}</span>
          <span className="text-[11px] text-mute">{q.engine}</span></div>))}

        {tab==="chat"&&(<div>
          {messages.length===0&&<div className="px-5 py-[30px] text-center text-[12px] text-mute">No messages yet.</div>}
          {messages.map((m,i)=>{const isYou=m.from==="You";const rc=m.role==="management"?P.accent:m.role==="execution"?P.pink:P.mute;return(
            <div key={i} className={`anim-up mb-2 flex flex-col ${isYou?"items-end":"items-start"}`} style={{animationDelay:`${i*15}ms`}}>
              <div className="mb-1 flex items-center gap-1">
                <span className="text-[11px] font-medium text-ink">{m.from}</span>
                {!isYou&&m.role!=="system"&&<span className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase" style={{color:rc,background:`${rc}15`}}>{m.role}</span>}
                <span className="text-[10px] text-mute">{m.time}</span></div>
              <div className={`max-w-[78%] rounded-[14px] border px-3 py-2 text-[12.5px] leading-normal text-ink shadow-sm ${isYou?"border-accent/[0.1] bg-accent/[0.05]":"border-[rgba(15,23,42,0.06)] bg-white/70"}`}>{m.msg}</div>
            </div>);})}
          <div ref={chatEndRef}/></div>)}
      </div>

      {tab==="chat"&&(<div className="shrink-0 border-t border-[rgba(15,23,42,0.06)] bg-[#F7F8FA]/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 py-1 pl-4 pr-1 shadow-sm">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Type..."
            className="flex-1 border-none bg-transparent text-[12.5px] text-ink outline-none"/>
          <button onClick={sendMsg} className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition-all duration-150 ${chatInput.trim()?"bg-accent text-white shadow-sm hover:-translate-y-px":"bg-well text-mute"}`}>Send</button>
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
  const segBtn=(on)=>`px-3 py-1.5 text-[10.5px] font-medium whitespace-nowrap transition-colors duration-150 ${on?"bg-accent/[0.08] text-accent":"bg-transparent text-mute hover:text-ink"}`;

  return(<>
    <div className="relative min-h-screen bg-page font-sans text-ink">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-32 size-[500px] rounded-full opacity-[0.09] blur-[110px]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)" }}/>
        <div className="absolute -left-32 bottom-20 size-[420px] rounded-full opacity-[0.07] blur-[110px]" style={{ background: "radial-gradient(circle, #A8519E, transparent 70%)" }}/>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 sm:px-9">
        <header className="pb-4 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-serif text-[42px] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Campaigns</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-4 rounded-full border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-2 shadow-sm backdrop-blur-md">
                {campaigns.filter(c=>c.status==="pending").length>0&&<div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-amber">{campaigns.filter(c=>c.status==="pending").length}</span><span className="text-[10.5px] text-mute">Pending</span></div>}
                <div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-ink">{campaigns.filter(c=>c.status==="active").length}</span><span className="text-[10.5px] text-mute">Active</span></div>
                <div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-donetxt">{campaigns.filter(c=>c.status==="done").length}</span><span className="text-[10.5px] text-mute">Done</span></div></div>
              <button onClick={()=>setShowNewReq(true)} className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]">+ New</button>
            </div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(15,23,42,0.06)] pt-3.5">
            <div className="flex items-center gap-2">
              <div className="flex w-44 items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <span className="text-[12px] text-mute">⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-full border-none bg-transparent text-[12px] text-ink outline-none"/></div>
              {/* Service filter */}
              <div className="flex overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 shadow-sm backdrop-blur-sm">
                <button onClick={()=>setSvcFilter("all")} className={segBtn(svcFilter==="all")}>All</button>
                {allServices.map(s=>(<button key={s} onClick={()=>setSvcFilter(s)} className={segBtn(svcFilter===s)}>{s==="Influencer Marketing"?"IM":s==="Performance Ads"?"Ads":s}</button>))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex overflow-hidden rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 shadow-sm backdrop-blur-sm">
                {[["board","Board"],["grid","Grid"]].map(([k,l])=>(<button key={k} onClick={()=>setView(k)} className={`px-3.5 py-1.5 text-[11px] font-medium transition-colors duration-150 ${view===k?"bg-accent/[0.08] text-accent":"bg-transparent text-mute hover:text-ink"}`}>{l}</button>))}</div>
            </div></div>
        </header>

        {toast&&<div className="anim-up mb-3 flex items-center gap-1.5 rounded-full border border-green/[0.12] bg-green/[0.05] px-3.5 py-2 shadow-sm backdrop-blur-sm"><Dot color={P.green}/><span className="text-[12px] font-medium text-green">{toast}</span></div>}

        {campaigns.length===0&&(<div className="pb-8"><EmptyState icon="▤" title="No campaigns yet"
          hint="Send us your first requirement and we'll take it from brief to live."
          actionLabel="+ New Requirement" onAction={()=>setShowNewReq(true)}/></div>)}
        {campaigns.length>0&&view==="board"&&<div className="mb-2 text-[11px] text-mute md:hidden">Swipe sideways to see all stages →</div>}
        {campaigns.length>0&&view==="board"&&(<div className="flex min-h-[52vh] gap-3 overflow-x-auto pb-9">
          {PHASES.map((phase,pi)=>{const items=filtered.filter(c=>c.phase===phase.id);return(<div key={phase.id} className="anim-up flex min-w-[210px] flex-col" style={{animationDelay:`${pi*35}ms`,flex:`1 1 ${100/PHASES.length}%`}}>
            <div className="mb-2 flex items-center justify-between rounded-full bg-white/40 px-3 py-1.5 backdrop-blur-sm"><span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-sub">{phase.label}</span><span className="text-[10.5px] font-semibold text-mute">{items.length}</span></div>
            <div className="flex flex-1 flex-col gap-2">{items.map((c,ci)=><Card key={c.id} campaign={c} delay={pi*35+ci*25} onClick={()=>setSelected(c)}/>)}
              {items.length===0&&<div className="flex min-h-[45px] flex-1 items-center justify-center rounded-[16px] border border-dashed border-[rgba(15,23,42,0.1)] px-1.5 py-4 text-center text-[11px] text-mute">—</div>}</div>
          </div>);})}
        </div>)}
        {campaigns.length>0&&view==="grid"&&(<div className="grid gap-2 pb-9" style={{gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))"}}>{filtered.map((c,i)=><Card key={c.id} campaign={c} delay={i*25} onClick={()=>setSelected(c)}/>)}</div>)}
      </div>
      {selected&&<DetailPanel campaign={selected} onClose={()=>setSelected(null)} userRole={userRole}/>}
      {showNewReq&&<NewReqModal onClose={()=>setShowNewReq(false)} onSubmit={handleSubmit}/>}
    </div>
  </>);}