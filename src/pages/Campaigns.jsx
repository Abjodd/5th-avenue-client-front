// src/pages/Campaigns.jsx — campaigns board/grid + detail drawer.
// Data flow: GET /api/portal/campaigns → toViewCampaign (components/campaigns/
// mapping.js) → board columns per portal phase. All numbers are real backend
// data; missing values render "—" rather than being invented.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI } from "../lib/api";
import { fmtINR } from "../lib/format";
import { PHASES, phaseColors as phaseColorsFor } from "../lib/phases";
import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import { AmbientBackground, Magnetic } from "../components/motion/Motion";
import AnimatedNumber from "../components/AnimatedNumber";
import { toViewCampaign } from "../components/campaigns/mapping";
import CampaignCard from "../components/campaigns/CampaignCard";
import DetailPanel from "../components/campaigns/DetailPanel";
import NewReqModal from "../components/campaigns/NewReqModal";

export default function CampaignsPage() {
  const { P, navParams } = useApp();
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [showNewReq, setShowNewReq] = useState(false);
  const [toast, setToast] = useState("");
  const [svcFilter, setSvcFilter] = useState("all");
  const userRole = "management"; // client-side approvals default to the management view

  const { user } = useAuth();

  useEffect(() => {
    if (!user?.clientName) return;
    PortalAPI.campaigns(user.clientName).then(data => setCampaigns(data.map(toViewCampaign))).catch(e => setError(e.message));
  }, [user?.clientName]);

  // Auto-open campaign when navigated from another page
  useEffect(() => {
    if (navParams?.campaignId && campaigns) {
      const match = campaigns.find(c => c.id === navParams.campaignId || c.name === navParams.campaignId);
      if (match) setSelected(match);
    }
  }, [navParams?.campaignId, campaigns]);

  // New requirements are local-only until a portal submission endpoint exists
  // on the backend — they show as "Pending" but won't survive a refresh.
  const handleSubmit = (form) => {
    setCampaigns(p => [{
      id: `req_${Date.now()}`, name: form.description?.slice(0, 35) || `${form.svc} Campaign`, service: form.svc, region: "—",
      phase: "brief", progress: 0, reach: "—", engagement: "—", impressions: "—", engRate: "—", views: "—",
      start: "—", end: "—", budget: `₹${form.budget}L`, budgetNum: form.budget * 100000,
      numReq: null, lockedCount: 0, liveCount: 0, waiting: 0, trackTotals: null, avgPositivity: null, lastFetched: null,
      brief: form.description || "", lockedBrief: null, status: "pending", creators: [], topAssets: [],
      pendingBrief: { objective: form.description || "", targetAudience: "", keyMessages: "", deliverables: "", budget: `₹${form.budget}L`, timeline: "", vars: { objective: "pending", targetAudience: "waiting", keyMessages: "waiting", deliverables: "waiting", budget: "pending", timeline: "waiting" } },
    }, ...(p || [])]);
    setShowNewReq(false); setToast("Requirement submitted!"); setTimeout(() => setToast(""), 3000);
  };

  if (error) return <ErrorState message={error}/>;
  if (!campaigns) return <PageSkeleton/>;

  const filtered = campaigns.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (svcFilter !== "all" && c.service !== svcFilter) return false;
    return true;
  });
  const allServices = [...new Set(campaigns.map(c => c.service))];
  const phaseColors = phaseColorsFor(P);
  const nPending = campaigns.filter(c => c.status === "pending").length;
  const nActive = campaigns.filter(c => c.status === "active").length;
  const nDone = campaigns.filter(c => c.status === "done").length;

  /* Segmented-control button with a sliding active pill */
  const seg = (on, onClick, label, layoutId) => (
    <button key={label} onClick={onClick} className={`relative px-3.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 ${on ? "text-accent" : "text-mute hover:text-ink"}`}>
      {on && <motion.span layoutId={layoutId} className="absolute inset-0 bg-accent/[0.08]" transition={{ type: "spring", stiffness: 420, damping: 34 }}/>}
      <span className="relative">{label}</span>
    </button>
  );

  return (
    <div className="relative min-h-screen bg-page font-sans text-ink">
      <AmbientBackground variant="b"/>

      <div className="mx-auto max-w-[1600px] px-5 sm:px-9">
        <header className="pb-4 pt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="microlabel mb-1.5 tracking-[0.2em]">Campaigns · {campaigns.length} total</div>
              <h1 className="font-serif text-[42px] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Campaigns</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-4 rounded-full border border-line bg-white/60 px-4 py-2 shadow-sm backdrop-blur-md">
                {nPending > 0 && <div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-amber"><AnimatedNumber value={nPending}/></span><span className="text-[10.5px] text-mute">Pending</span></div>}
                <div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-ink"><AnimatedNumber value={nActive}/></span><span className="text-[10.5px] text-mute">Active</span></div>
                <div className="flex items-baseline gap-1"><span className="text-[15px] font-semibold text-donetxt"><AnimatedNumber value={nDone}/></span><span className="text-[10.5px] text-mute">Done</span></div>
              </div>
              <Magnetic strength={0.2}>
                <button onClick={() => setShowNewReq(true)} className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_18px_rgba(44,62,126,0.3)] transition-shadow duration-200 hover:shadow-[0_10px_26px_rgba(44,62,126,0.4)]">+ New</button>
              </Magnetic>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
            <div className="flex items-center gap-2">
              <div className="flex w-44 items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-sm transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-md">
                <span className="text-[12px] text-mute">⌕</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full border-none bg-transparent text-[12px] text-ink outline-none"/>
              </div>
              {/* Service filter */}
              <div className="flex overflow-hidden rounded-full border border-line bg-white/70 shadow-sm backdrop-blur-sm">
                {seg(svcFilter === "all", () => setSvcFilter("all"), "All", "svc-pill")}
                {allServices.map(s => seg(svcFilter === s, () => setSvcFilter(s), s === "Influencer Marketing" ? "IM" : s === "Performance Ads" ? "Ads" : s, "svc-pill"))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex overflow-hidden rounded-full border border-line bg-white/70 shadow-sm backdrop-blur-sm">
                {seg(view === "board", () => setView("board"), "Board", "view-pill")}
                {seg(view === "grid", () => setView("grid"), "Grid", "view-pill")}
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-3 flex items-center gap-1.5 rounded-full border border-green/[0.12] bg-green/[0.05] px-3.5 py-2 shadow-sm backdrop-blur-sm">
              <Dot color={P.green}/><span className="text-[12px] font-medium text-green">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {campaigns.length === 0 && (
          <div className="pb-8">
            <EmptyState icon="▤" title="No campaigns yet"
              hint="Send us your first requirement and we'll take it from brief to live."
              actionLabel="+ New Requirement" onAction={() => setShowNewReq(true)}/>
          </div>
        )}

        {campaigns.length > 0 && view === "board" && <div className="mb-2 text-[11px] text-mute md:hidden">Swipe sideways to see all stages →</div>}
        {campaigns.length > 0 && view === "board" && (
          <div className="flex min-h-[52vh] gap-3 overflow-x-auto pb-9">
            {PHASES.map((phase, pi) => {
              const items = filtered.filter(c => c.phase === phase.id);
              const colBudget = items.reduce((s, c) => s + (c.budgetNum || 0), 0);
              const color = phaseColors[phase.id];
              return (
                <motion.div key={phase.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pi * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex min-w-[220px] flex-col rounded-[18px] p-1.5"
                  style={{ flex: `1 1 ${100 / PHASES.length}%`, background: `${color}06` }}>
                  {/* Phase-tinted column header: icon · label · count · budget sum */}
                  <div className="mb-2 rounded-[14px] border bg-white/55 px-3 py-2 backdrop-blur-sm" style={{ borderColor: `${color}25` }}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color }}>
                        <span className="text-[12px]">{phase.icon}</span>{phase.label}
                      </span>
                      <span className="flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: items.length ? color : P.doneTxt }}>{items.length}</span>
                    </div>
                    {colBudget > 0 && <div className="mt-0.5 text-[10px] font-medium text-sub">{fmtINR(colBudget)} committed</div>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {items.map(c => <CampaignCard key={c.id} campaign={c} onClick={() => setSelected(c)}/>)}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <div className="flex min-h-[45px] flex-1 items-center justify-center rounded-[16px] border border-dashed border-line-mid px-1.5 py-4 text-center text-[11px] text-mute">—</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {campaigns.length > 0 && view === "grid" && (
          <motion.div layout className="grid gap-2.5 pb-9" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))" }}>
            <AnimatePresence mode="popLayout">
              {filtered.map(c => <CampaignCard key={c.id} campaign={c} onClick={() => setSelected(c)}/>)}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selected && <DetailPanel key="panel" campaign={selected} onClose={() => setSelected(null)} userRole={userRole}/>}
      </AnimatePresence>
      <AnimatePresence>
        {showNewReq && <NewReqModal key="newreq" onClose={() => setShowNewReq(false)} onSubmit={handleSubmit}/>}
      </AnimatePresence>
    </div>
  );
}
