// src/components/campaigns/DetailPanel.jsx — slide-in campaign drawer.
// Overview / Brief / Creators / Queries tabs. New in the redesign (all real
// backend data that was previously discarded): a Live Performance section
// (tracking views/likes/comments/shares), a comment-sentiment strip
// (positivityScore + commentAnalysis), and live-post links per creator.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../../context";
import { PHASES } from "../../lib/phases";
import { fmtNum, prettyDate } from "../../lib/format";
import { Dot } from "../Dot";
import { StatusPill, StatusLegend } from "../StatusPill";
import AnimatedNumber from "../AnimatedNumber";
import { drawerRight, overlayFade } from "../../lib/motion";
import { STATUS_MAP, ACTIONABLE_STATUSES, BCOLORS, chipOn, closeBtnCls } from "./mapping";

const useP = () => useApp().P;

/* ═══ PHASE TRACKER ═══ */
function PhaseTracker({ currentPhase }) {
  const P = useP();
  const idx = PHASES.findIndex(p => p.id === currentPhase);
  return (
    <div className="mb-4 rounded-[18px] border border-line bg-white/70 px-6 py-5 shadow-card backdrop-blur-xl">
      <div className="flex items-center">
        {PHASES.map((p, i) => {
          const isCur = i === idx, isDone = i < idx;
          return (
            <div key={p.id} className="flex flex-1 items-center">
              <div className="relative flex flex-1 flex-col items-center gap-[6px]">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.06, type: "spring", stiffness: 340, damping: 24 }}
                  className={`flex size-10 items-center justify-center rounded-[12px] border-2 text-[17px] ${isDone?"border-green bg-green/[0.08]":isCur?"border-accent bg-accent/[0.08]":"border-ink/5 bg-well"}`}
                  style={{ boxShadow: isCur ? `0 0 16px ${P.accent}35` : isDone ? `0 2px 8px ${P.green}20` : "none" }}>
                  {isDone ? "✓" : p.icon}
                </motion.div>
                <span className={`text-center text-[10.5px] uppercase tracking-[0.04em] ${isCur?"font-bold text-ink":isDone?"font-medium text-green":"font-normal text-mute"}`}>{p.label}</span>
                {isCur && <div className="pulse absolute -top-1 right-[20%] size-2 rounded-full bg-accent"/>}
              </div>
              {i < PHASES.length-1 && (<div className={`mb-5 h-0.5 max-w-10 flex-[0_0_100%] rounded-full transition-colors duration-300 ${isDone?"bg-green":"bg-ink/[0.05]"}`}/>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ BUDGET CARD ═══ */
// Plain figure only — the DB doesn't store an operational budget split, so
// none is invented here. A real split can return once the backend has one.
function BudgetCard({ value }) {
  return (
    <div className="rounded-[14px] border border-line bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Budget</div>
      <div className="mt-1 text-[18px] font-bold text-ink">{value}</div>
    </div>
  );
}

/* ═══ HBARS ═══ */
function HBars({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 0.1);
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-right text-[10px] text-sub">{d.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-well">
            <motion.div className="h-full min-w-0.5 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${(d.value/max)*100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
              style={{ background: BCOLORS[i % BCOLORS.length] }}/>
          </div>
          <span className="w-8 shrink-0 text-[10px] font-semibold text-ink">{typeof d.value === "number" && d.value % 1 ? d.value.toFixed(1) : d.value}{d.suffix || ""}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══ METRIC CARD — optional expandable breakdown; suffix ("%") for rates ═══ */
function MetricCard({ label, value, breakdowns, suffix = "" }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(breakdowns ? Object.keys(breakdowns)[0] : null);
  const has = breakdowns && Object.keys(breakdowns).length > 0 && value !== "—" && value !== "0";
  return (
    <div className={`rounded-[14px] border border-line bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md ${has?"cursor-pointer":""}`} onClick={() => has && setOpen(!open)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
        {has && <span className="text-[9px] text-accent">{open ? "▴" : "▾"}</span>}
      </div>
      <div className={`mt-1 text-[18px] font-bold ${value==="—"||value==="0"?"text-donetxt":"text-ink"}`}>{value}</div>
      <AnimatePresence initial={false}>
        {open && breakdowns && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-2.5 border-t border-line pt-2.5">
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.keys(breakdowns).map(f => (
                  <button key={f} onClick={e => { e.stopPropagation(); setFilter(f); }}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-all duration-150 ${filter===f?chipOn:"border-line bg-transparent text-mute"}`}>{f}</button>
                ))}
              </div>
              <HBars data={suffix ? (breakdowns[filter]||[]).map(d => ({ ...d, suffix })) : breakdowns[filter]||[]}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══ LIVE PERFORMANCE — real tracking totals (views/likes/comments/shares) ═══ */
function LivePerformance({ totals, lastFetched }) {
  const P = useP();
  if (!totals) return null;
  const tiles = [
    ["Views", totals.views, P.accent], ["Likes", totals.likes, P.pink],
    ["Comments", totals.comments, P.teal], ["Shares", totals.forwards, P.purple],
  ].filter(([, v]) => v > 0);
  if (!tiles.length) return null;
  return (
    <div className="mb-3 mt-2 rounded-[16px] border border-green/[0.15] bg-green/[0.02] px-4 py-3.5 shadow-sm backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Dot color={P.green}/><span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-green">Live Performance</span>
        </div>
        {lastFetched && <span className="text-[10px] text-mute">updated {prettyDate(lastFetched)}</span>}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, 1fr)` }}>
        {tiles.map(([l, v, c]) => (
          <div key={l} className="rounded-[12px] border border-line bg-white/70 px-3 py-2.5 text-center shadow-sm">
            <div className="text-[17px] font-bold leading-tight" style={{ color: c }}>
              <AnimatedNumber value={v} format={fmtNum} duration={900}/>
            </div>
            <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-mute">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ SENTIMENT — positivityScore gradient bar + per-creator commentAnalysis ═══ */
function SentimentStrip({ avgPositivity, creators }) {
  const P = useP();
  const quotes = (creators || []).filter(cr => cr.tracking?.commentAnalysis);
  if (avgPositivity == null && !quotes.length) return null;
  return (
    <div className="mb-3 rounded-[16px] border border-line bg-white/65 px-4 py-3.5 shadow-sm backdrop-blur-md">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-mute">Audience Sentiment</div>
      {avgPositivity != null && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] text-sub">Comment positivity</span>
            <span className="text-[15px] font-bold" style={{ color: avgPositivity >= 66 ? P.green : avgPositivity >= 40 ? P.amber : P.red }}>
              <AnimatedNumber value={avgPositivity} format={v => `${Math.round(v)}/100`} duration={900}/>
            </span>
          </div>
          <div className="relative h-[7px] rounded-full" style={{ background: `linear-gradient(to right, ${P.red}55, ${P.amber}55, ${P.green}55)` }}>
            <motion.div
              className="absolute -top-[3px] h-[13px] w-[3px] rounded-full bg-ink shadow-[0_1px_4px_rgba(25,22,17,0.4)]"
              initial={{ left: 0 }} animate={{ left: `${Math.min(100, Math.max(0, avgPositivity))}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}/>
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-mute"><span>Negative</span><span>Neutral</span><span>Positive</span></div>
        </div>
      )}
      {quotes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {quotes.map((cr, i) => (
            <div key={i} className="rounded-[12px] border border-line bg-white/70 px-3 py-2 shadow-sm">
              <div className="text-[11.5px] italic leading-normal text-ink">"{cr.tracking.commentAnalysis}"</div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-mute">
                <span className="font-semibold text-accent">{cr.name}</span>
                {cr.tracking.positivityScore != null && <span>· positivity {cr.tracking.positivityScore}/100</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ OBSERVATIONS + STRATEGY INSIGHTS ═══ */
function Observations({ creators, topAssets }) {
  const obs = [];
  if (topAssets?.length) { const best = topAssets[0]; obs.push(`Top performer: ${best.creator} with ${best.label.split("—")[1]?.trim() || "strong results"}.`); }
  if (creators?.length > 1) { const rates = creators.filter(c => c.engRate && c.engRate !== "—").map(c => ({ n: c.name, r: parseFloat(c.engRate) })); if (rates.length) { const top = rates.sort((a, b) => b.r - a.r)[0]; obs.push(`Highest engagement: ${top.n} at ${top.r}%.`); const avg = (rates.reduce((s, r) => s + r.r, 0) / rates.length).toFixed(1); obs.push(`Average creator engagement: ${avg}% across ${rates.length} creators.`); } }
  if (creators?.length) { const niches = {}; creators.forEach(c => { niches[c.niche] = (niches[c.niche] || 0) + 1; }); const topN = Object.entries(niches).sort((a, b) => b[1] - a[1])[0]; if (topN) obs.push(`Most represented niche: ${topN[0]} (${topN[1]} creator${topN[1] > 1 ? "s" : ""}).`); }
  if (creators?.length) { const platforms = {}; creators.forEach(c => { platforms[c.platform] = (platforms[c.platform] || 0) + 1; }); const topP = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]; if (topP) obs.push(`Primary platform: ${topP[0]} (${topP[1]} of ${creators.length} creators).`); }
  if (!obs.length) return null;

  // Generate strategy insights by connecting observations
  const strategies = [];
  if (creators?.length > 1) {
    const rates = creators.filter(c => c.engRate && c.engRate !== "—").map(c => ({ n: c.name, r: parseFloat(c.engRate), niche: c.niche, size: c.size, platform: c.platform }));
    if (rates.length > 1) {
      const top = rates.sort((a, b) => b.r - a.r)[0];
      const bottom = rates[rates.length - 1];
      if (top.r > bottom.r * 1.3) { strategies.push(`${top.niche} creators are outperforming others — consider increasing allocation to this niche in future campaigns.`); }
      const igCount = rates.filter(r => r.platform === "Instagram").length;
      const ytCount = rates.filter(r => r.platform === "YouTube").length;
      if (igCount > 0 && ytCount > 0) {
        const igAvg = rates.filter(r => r.platform === "Instagram").reduce((s, r) => s + r.r, 0) / igCount;
        const ytAvg = rates.filter(r => r.platform === "YouTube").reduce((s, r) => s + r.r, 0) / ytCount;
        if (ytAvg > igAvg * 1.1) strategies.push(`YouTube creators show ${((ytAvg / igAvg - 1) * 100).toFixed(0)}% higher engagement than Instagram — consider shifting budget toward long-form content.`);
        else if (igAvg > ytAvg * 1.1) strategies.push(`Instagram Reels driving ${((igAvg / ytAvg - 1) * 100).toFixed(0)}% higher engagement — double down on short-form content.`);
      }
    }
    const sizes = {}; rates.forEach(r => { if (!sizes[r.size]) sizes[r.size] = { total: 0, count: 0 }; sizes[r.size].total += r.r; sizes[r.size].count++; });
    const sizeAvgs = Object.entries(sizes).map(([k, v]) => ({ size: k, avg: v.total / v.count })).sort((a, b) => b.avg - a.avg);
    if (sizeAvgs.length > 1 && sizeAvgs[0].avg > sizeAvgs[sizeAvgs.length - 1].avg * 1.2) {
      strategies.push(`${sizeAvgs[0].size} creators deliver the best engagement-to-cost ratio — prioritise this tier for ROI-focused campaigns.`);
    }
  }
  if (topAssets?.length > 1) { strategies.push(`Repurpose top-performing assets as paid ad creatives to maximise reach with proven content.`); }
  if (creators?.length >= 3) {
    const regions = {}; creators.forEach(c => { regions[c.region] = (regions[c.region] || 0) + 1; });
    const regionCount = Object.keys(regions).length;
    if (regionCount <= 2) strategies.push(`Current creators are concentrated in ${regionCount} region${regionCount > 1 ? "s" : ""}. Expanding to new regions could unlock untapped audiences.`);
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Observations</div>
      <div className={`rounded-[14px] border border-line bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md ${strategies.length?"mb-3":""}`}>
        {obs.map((o, i) => (
          <div key={i} className={`flex items-start gap-1.5 ${i < obs.length-1 ? "mb-1.5" : ""}`}>
            <span className="mt-[3px] shrink-0 text-[10px] text-accent">●</span>
            <span className="text-[12px] leading-normal text-ink">{o}</span>
          </div>
        ))}
      </div>
      {strategies.length > 0 && (<>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Strategy Insights</div>
        <div className="rounded-[14px] border border-accent/[0.1] bg-accent/[0.03] px-4 py-3 shadow-sm backdrop-blur-md">
          {strategies.map((s, i) => (
            <div key={i} className={`flex items-start gap-1.5 ${i < strategies.length-1 ? "mb-1.5" : ""}`}>
              <span className="mt-0.5 shrink-0 text-[11px] text-amber">→</span>
              <span className="text-[12px] leading-relaxed text-ink">{s}</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

/* ═══ CREATOR ROW — independent approvals + live tracking data ═══ */
function CreatorRow({ cr, idx, userRole, onUpdateApproval }) {
  const P = useP();
  const st = STATUS_MAP[cr.status] || STATUS_MAP.yet_to_pick;
  const actionable = ["pending_brand", "in_negotiation"].includes(cr.status);
  const [expanded, setExpanded] = useState(false);
  const a = cr.approval || { exec: null, mgmt: null, execLocked: false, mgmtLocked: false };
  const bothLocked = a.execLocked && a.mgmtLocked;
  const autoResult = bothLocked ? (a.exec === "tick" && a.mgmt === "tick" ? "approved" : "rejected") : null;
  const t = cr.tracking;

  const renderApprovalUI = (role, label) => {
    const isOwn = (role === "exec" && userRole === "execution") || (role === "mgmt" && userRole === "management");
    const val = a[role]; const locked = a[`${role}Locked`];
    return (
      <div className="flex items-center gap-1">
        <span className="w-9 text-[10px] font-semibold text-mute">{label}</span>
        {locked ? (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${val==="tick"?"text-green":"text-red"} ${isOwn?"":"opacity-50"}`}>
            {val === "tick" ? "✓ Yes" : "✗ No"}<span className="ml-0.5 text-[9px] text-mute">locked</span>
          </span>
        ) : (isOwn ? (
          <div className="flex gap-1">
            <button onClick={() => onUpdateApproval(idx, role, "tick")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-green transition-all duration-150 ${val==="tick"?"border-green bg-green/[0.08] shadow-sm":"border-line bg-transparent hover:border-green/40"}`}>✓</button>
            <button onClick={() => onUpdateApproval(idx, role, "cross")} className={`flex size-[24px] items-center justify-center rounded-[7px] border-[1.5px] text-[12px] text-red transition-all duration-150 ${val==="cross"?"border-red bg-red/[0.08] shadow-sm":"border-line bg-transparent hover:border-red/40"}`}>✗</button>
            {val && <button onClick={() => onUpdateApproval(idx, role + "Lock", true)} className="rounded-full border border-accent/15 bg-accent/[0.06] px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm">Lock</button>}
          </div>
        ) : (
          <span className={`text-[11px] opacity-50 ${val==="tick"?"text-green":val==="cross"?"text-red":"text-mute"}`}>{val === "tick" ? "✓" : "✗"}{val ? " (" + label + ")" : "pending"}</span>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.035, 0.4), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mb-2 rounded-[16px] border bg-white/65 px-4 py-3.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: actionable ? P.amber + "25" : autoResult === "approved" ? P.green + "25" : autoResult === "rejected" ? P.red + "20" : "rgba(25,22,17,0.06)" }}>
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] text-[12.5px] font-semibold text-accent shadow-sm">{cr.avatar || cr.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-ink">{cr.name}</span>
            <a href={cr.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] text-accent no-underline hover:underline">{cr.handle}</a>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-[12px] text-sub">
            <span>{cr.followers}</span><span>{cr.platform}</span><span>{cr.deliverables}</span>
            <span className="font-medium text-accent">ER: {cr.engRate}</span>
            {cr.avgLikes != null && <span>♥ {fmtNum(cr.avgLikes)} avg</span>}
          </div>
        </div>
        {autoResult && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] shadow-sm ${autoResult==="approved"?"bg-green/[0.08] text-green":"bg-red/[0.06] text-red"}`}>{autoResult}</span>}
        <StatusPill tier={st.t}>{st.label}</StatusPill>
      </div>
      <button onClick={() => setExpanded(!expanded)} className="mt-1.5 p-0 text-[11px] font-medium text-accent transition-opacity hover:opacity-70">{expanded ? "Show less ▴" : "See more ▾"}</button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mt-1.5 flex flex-col gap-1 border-t border-line pt-2">
              <div className="flex flex-wrap gap-2.5 text-[11px] text-sub"><span>Niche: <b className="text-ink">{cr.niche}</b></span><span>Size: <b className="text-ink">{cr.size}</b></span><span>State: <b className="text-ink">{cr.region}</b></span><span>Language: <b className="text-ink">{cr.language}</b></span></div>
              <div className="mt-0.5 flex flex-wrap gap-3.5 text-[12px]">
                <span className="text-mute">Brief: {cr.briefDoc ? <a href={cr.briefDoc.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-accent no-underline hover:underline">📄 {cr.briefDoc.name}</a> : <em>Not uploaded</em>}</span>
                <span className="text-mute">Video: {cr.videoDoc ? <a href={cr.videoDoc.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-accent no-underline hover:underline">🎬 {cr.videoDoc.name}</a> : <em>Not uploaded</em>}</span>
              </div>
              {/* Live block — only when this creator's post is actually up */}
              {cr.live && (
                <div className="mt-1.5 rounded-[12px] border border-green/[0.15] bg-green/[0.03] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2.5 text-[11.5px]">
                    <a href={cr.live.postUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="rounded-full bg-green/[0.1] px-2.5 py-0.5 font-semibold text-green no-underline hover:bg-green/[0.16]">View post ↗</a>
                    {cr.live.postedDate && <span className="text-mute">posted {prettyDate(cr.live.postedDate)}</span>}
                    {cr.tracking?.positivityScore != null && (
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-sm"
                        style={{ color: cr.tracking.positivityScore >= 66 ? P.green : cr.tracking.positivityScore >= 40 ? P.amber : P.red,
                          background: (cr.tracking.positivityScore >= 66 ? P.green : cr.tracking.positivityScore >= 40 ? P.amber : P.red) + "14" }}>
                        {cr.tracking.positivityScore}/100 positive
                      </span>
                    )}
                  </div>
                  {t && (t.views || t.likes || t.comments || t.forwards) ? (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-sub">
                      {t.views != null && <span>👁 <b className="text-ink">{fmtNum(t.views)}</b> views</span>}
                      {t.likes != null && <span>♥ <b className="text-ink">{fmtNum(t.likes)}</b> likes</span>}
                      {t.comments != null && <span>💬 <b className="text-ink">{fmtNum(t.comments)}</b> comments</span>}
                      {t.forwards != null && <span>↗ <b className="text-ink">{fmtNum(t.forwards)}</b> shares</span>}
                    </div>
                  ) : null}
                  {t?.commentAnalysis && <div className="mt-1.5 text-[11px] italic leading-normal text-ink">"{t.commentAnalysis}"</div>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {actionable && !autoResult && (
        <div className="mt-2 flex items-center gap-4 border-t border-line pt-2">
          {renderApprovalUI("exec", "Exec")}{renderApprovalUI("mgmt", "Mgmt")}
        </div>
      )}
    </motion.div>
  );
}

/* ═══ BRIEF PAGE — with variable-level status ═══ */
function BriefPage({ lockedBrief, pendingBrief }) {
  const P = useP();
  const brief = lockedBrief || pendingBrief;
  if (!brief) return (<div className="px-5 py-9 text-center text-mute"><div className="mb-[5px] text-[26px] opacity-15">📋</div><div className="text-[13px]">No brief created yet</div></div>);
  const isLocked = !!lockedBrief; const vars = brief.vars || {};
  const statusIcon = (s) => s === "approved" ? { icon: "✓", color: P.green } : s === "rejected" ? { icon: "✗", color: P.red } : s === "pending" ? { icon: "⏳", color: P.amber } : { icon: "…", color: P.mute };
  return (
    <div>
      <div className={`mb-3 flex items-center gap-1.5 rounded-[12px] border px-3 py-2 backdrop-blur-sm ${isLocked?"border-green/[0.12] bg-green/[0.03]":"border-amber/[0.12] bg-amber/[0.03]"}`}>
        <Dot color={isLocked ? P.green : P.amber}/><span className={`text-[12px] font-medium ${isLocked?"text-green":"text-amber"}`}>{isLocked ? `Locked ${brief.approvedOn}` : "Waiting — under review by 5th Avenue"}</span>
        <span className="ml-auto text-[10.5px] italic text-mute">{isLocked ? "Read-only" : "Pending approval"}</span>
      </div>
      {[["Objective","objective"],["Target Audience","targetAudience"],["Key Messages","keyMessages"],["Deliverables","deliverables"],["Budget","budget"],["Timeline","timeline"]].map(([label, key]) => {
        const val = brief[key]; const si = statusIcon(vars[key]);
        return (
          <div key={key} className="mb-1.5 flex items-start gap-2 rounded-[12px] border border-line bg-white/60 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
            <div className="flex-1">
              <div className="mb-[3px] flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{label}<span className="text-[11px]" style={{ color: si.color }}>{si.icon}</span></div>
              <div className={`text-[13px] leading-normal ${val?"text-ink":"italic text-mute"}`}>{val || "Awaiting input"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ DETAIL PANEL ═══ */
export default function DetailPanel({ campaign: c, onClose, userRole }) {
  const P = useP();
  const [tab, setTab] = useState("overview");
  const [creators, setCreators] = useState(c.creators || []);

  const updateApproval = (idx, role, val) => {
    setCreators(prev => prev.map((cr, i) => {
      if (i !== idx) return cr;
      const a = { ...cr.approval };
      if (role.endsWith("Lock")) { a[role.replace("Lock", "") + "Locked"] = true; } else { a[role] = val; }
      return { ...cr, approval: a };
    }));
  };

  const isAEO = c.service === "AEO"; const numCr = creators.length;
  const numDel = creators.reduce((s, cr) => { const m = cr.deliverables.match(/\d+/g); return s + (m ? m.reduce((a, n) => a + parseInt(n), 0) : 0); }, 0);
  const needsAction = creators.filter(cr => ACTIONABLE_STATUSES.includes(cr.status));

  const mkBD = (f) => { if (!creators.length) return []; const g = {}; creators.forEach(cr => { g[cr[f] || "Other"] = (g[cr[f] || "Other"] || 0) + 1; }); return Object.entries(g).map(([k, v]) => ({ label: k, value: v })); };
  const bd = creators.length ? { niche: mkBD("niche"), size: mkBD("size"), region: mkBD("region") } : null;
  const engByCreator = creators.filter(c2 => c2.engRate !== "—").map(c2 => ({ label: c2.name.split(" ")[0], value: parseFloat(c2.engRate) }));
  const engByNiche = (() => { const g = {}, c2 = {}; creators.forEach(cr => { if (cr.engRate !== "—") { const n = cr.niche; g[n] = (g[n] || 0) + parseFloat(cr.engRate); c2[n] = (c2[n] || 0) + 1; } }); return Object.entries(g).map(([k, v]) => ({ label: k, value: Math.round((v / c2[k]) * 10) / 10 })); })();
  const engBD = creators.length ? { creator: engByCreator, niche: engByNiche } : null;

  const tabs = [{ id: "overview", label: "Overview" }, { id: "brief", label: "Brief" }, ...(!isAEO ? [{ id: "creators", label: "Creators", count: numCr || null }] : []), ...(c.queries ? [{ id: "queries", label: "Queries" }] : [])];

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <motion.div variants={overlayFade} initial="hidden" animate="show" exit="exit"
        onClick={onClose} className="absolute inset-0 bg-[rgba(3,6,16,0.45)] backdrop-blur-[8px]"/>
      <motion.div variants={drawerRight} initial="hidden" animate="show" exit="exit"
        className="glass-panel relative flex w-[min(680px,94vw)] flex-col overflow-hidden border-l shadow-[-24px_0_60px_rgba(25,22,17,0.12)]">
        <div className="shrink-0 border-b border-line px-6 pt-5">
          <div className="mb-2.5 flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-serif text-[22px] italic font-semibold text-ink">{c.name}</h2>
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-accent">{c.service}</span>
              <p className="mt-1 text-[12px] leading-normal text-sub">{c.brief}</p>
            </div>
            <button onClick={onClose} className={`${closeBtnCls} shrink-0`}>✕</button>
          </div>
          {needsAction.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-[12px] border border-amber/[0.12] bg-amber/[0.04] px-3 py-2 backdrop-blur-sm">
              <Dot color={P.amber}/><span className="flex-1 text-[12px] text-amber">{needsAction.length} need{needsAction.length === 1 ? "s" : ""} input</span>
              <button onClick={() => setTab("creators")} className="text-[11px] font-medium text-accent hover:underline">Review →</button>
            </div>
          )}
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-1 px-3 py-2 text-[11.5px] font-medium transition-colors duration-200 ${tab===t.id?"text-accent":"text-mute hover:text-ink"}`}>
                {t.label}
                {t.count != null && <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${tab===t.id?"bg-accent/[0.1] text-accent":"bg-well text-mute"}`}>{t.count}</span>}
                {tab === t.id && <motion.span layoutId="detail-tab" className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }}/>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: "easeOut" }}>
              {tab === "overview" && (
                <div>
                  <PhaseTracker currentPhase={c.phase}/>
                  <LivePerformance totals={c.trackTotals} lastFetched={c.lastFetched}/>
                  <SentimentStrip avgPositivity={c.avgPositivity} creators={creators}/>
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    <BudgetCard value={c.budget} creators={creators}/>
                    <MetricCard label="Reach" value={c.reach} breakdowns={bd}/>
                    <MetricCard label="Views" value={c.views} breakdowns={bd}/>
                    <MetricCard label="Impressions" value={c.impressions} breakdowns={bd}/>
                    <MetricCard label="Creators" value={`${numCr}`}/>
                    <MetricCard label="Deliverables" value={`${numDel}`}/>
                  </div>
                  <MetricCard label="Engagement Rate" value={c.engRate} breakdowns={engBD} suffix="%"/>
                  <div className="mb-3 mt-2 rounded-[16px] border border-line bg-white/65 px-4 py-3 shadow-sm backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Timeline</div><div className="mt-0.5 text-[12.5px] font-medium text-ink">{c.start} — {c.end}</div></div>
                      <span className="text-[12.5px] font-semibold text-accent">{c.progress}%</span>
                    </div>
                    <div className="mt-2 h-[5px] rounded-full bg-well">
                      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${c.progress}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}/>
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-4 rounded-[14px] border border-line bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-sm">
                    {[["Service", c.service], ["Region", c.region]].map(([k, v]) => (<div key={k}><div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-mute">{k}</div><div className="mt-px text-[12px] font-medium text-ink">{v}</div></div>))}
                  </div>
                  {c.topAssets?.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">Top Performing Assets</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {c.topAssets.map((a2, i) => (
                          <div key={i} className="flex min-w-[130px] flex-col items-center gap-1 rounded-[16px] border border-line bg-white/65 px-3.5 py-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                            <div className="flex size-[38px] items-center justify-center rounded-full bg-accent/[0.1] text-[13px] font-bold text-accent">{a2.avatar}</div>
                            <span className="text-[11px] font-medium text-ink">{a2.creator}</span><span className="text-[10.5px] text-accent">{a2.handle}</span><span className="text-[10px] text-sub">{a2.label}</span>
                            <a href={a2.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="rounded-full bg-accent/[0.07] px-2 py-0.5 text-[10px] text-accent no-underline hover:bg-accent/[0.12]">View →</a>
                          </div>
                        ))}
                      </div>
                      <Observations creators={creators} topAssets={c.topAssets}/>
                    </div>
                  )}
                  {!c.topAssets?.length && creators.length > 0 && <Observations creators={creators} topAssets={c.topAssets}/>}
                </div>
              )}

              {tab === "brief" && <BriefPage lockedBrief={c.lockedBrief} pendingBrief={c.pendingBrief}/>}

              {tab === "creators" && (
                <div>
                  <div className="mb-2.5 flex items-center gap-1.5 rounded-full border border-accent/[0.06] bg-accent/[0.02] px-3 py-1.5">
                    <span className="text-[10.5px] text-sub">Viewing as</span><span className="rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{userRole === "management" ? "Mgmt" : "Exec"}</span>
                    <div className="ml-auto"><StatusLegend/></div>
                  </div>
                  {creators.length > 0 ? creators.map((cr, i) => <CreatorRow key={i} cr={cr} idx={i} userRole={userRole} onUpdateApproval={updateApproval}/>) : (
                    <div className="px-5 py-[34px] text-center">
                      <div className="mb-1.5 text-2xl opacity-[0.12]">{["👤","👤","👤"].map((e, i) => (<span key={i} className="bounce-1 mx-px inline-block" style={{ animationDelay: `${i*0.15}s` }}>{e}</span>))}</div>
                      <div className="text-[12.5px] text-sub">No creators yet</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "queries" && c.queries?.map((q, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-2 rounded-[12px] border border-line bg-white/65 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
                  <div className="flex-[2]"><div className="text-[12.5px] font-medium text-ink">{q.query}</div><div className="mt-px text-[11px] text-mute">{q.volume}</div></div>
                  <div className="flex items-center gap-1">{<Dot color={q.status === "live" ? P.green : P.amber}/>}<span className="text-[11px] capitalize text-sub">{q.status}</span></div>
                  <span className={`text-[11px] ${q.position !== "—" ? "font-semibold text-green" : "font-normal text-mute"}`}>{q.position}</span>
                  <span className="text-[11px] text-mute">{q.engine}</span>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
