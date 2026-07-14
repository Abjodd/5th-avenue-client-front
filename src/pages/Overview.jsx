import { useState, useEffect, useMemo } from "react";
import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { PortalAPI, phaseOf } from "../lib/api";
import { parseFollowers, sizeOf, fmtNum, fmtINR } from "../lib/format";
import { PHASES, phaseColors as phaseColorsFor } from "../lib/phases";
import { Dot } from "../components/Dot";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import PerformanceSection from "../components/PerformanceSection";

/* A creator is "waiting on the client" when something needs their review */
const needsInput = cr =>
  cr.status === "pending_brand" || cr.concept?.status === "received" ||
  cr.demo?.status === "received" || cr.demo?.status === "rework";

// Trimmed to the launch scope — AEO / Offline / Ads tabs return later.
const SERVICES = [
  { id:"all",        label:"Overall",    icon:"⊕" },
  { id:"influencer", label:"Influencer", icon:"◎" },
];

// Creator filters are built from the data itself (only options that actually
// occur in this client's creators are offered). Age/gender aren't stored in
// the DB, so unlike the reference design they are not offered here.
const FILTER_GROUPS = [
  { id:"niche",    label:"Niche" },
  { id:"size",     label:"Size" },
  { id:"language", label:"Language" },
  { id:"status",   label:"Status" },
];

function stats(values) {
  if (!values.length) return { avg:0, sum:0, stdDev:0 };
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  return { avg, sum, stdDev: Math.sqrt(variance) };
}
function isOutlier(value, avg, stdDev) {
  if (stdDev === 0) return null;
  const z = (value - avg) / stdDev;
  return z > 1.3 ? "high" : z < -1.3 ? "low" : null;
}

function KPICard({ label, value, sublabel, color }) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-5 py-[18px] shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `inset 0 0 0 1px ${color}30` }}
      />
      <div className="microlabel mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-mute">{label}</div>
      <div className="text-[30px] font-bold leading-none tracking-tight transition-transform duration-300 group-hover:scale-[1.02]" style={{ color }}>
        {value}
      </div>
      {sublabel && <div className="mt-2 text-[11.5px] text-mute">{sublabel}</div>}
    </div>
  );
}

/* Grouped creator breakdown (count, avg ER vs overall, follower share) */
function BreakdownCard({ group, grp, total, totalFollowers, erAvg, erOutlier, P }) {
  const erPctOfAvg = erAvg > 0 && grp.er > 0 ? ((grp.er / erAvg - 1) * 100).toFixed(0) : "0";
  const folPct = totalFollowers > 0 ? ((grp.followers / totalFollowers) * 100).toFixed(1) : 0;
  const countPct = total > 0 ? ((grp.count / total) * 100).toFixed(0) : 0;
  const badge = erOutlier === "high" ? { c:P.green, label:"HIGH OUTLIER", sym:"▲" }
    : erOutlier === "low" ? { c:P.red, label:"LOW OUTLIER", sym:"▼" } : null;
  return (
    <div className="rounded-[16px] border bg-white/60 px-4 py-3.5 shadow-[0_1px_10px_rgba(15,23,42,0.03)] backdrop-blur-md transition-all duration-250 ease-out hover:-translate-y-[3px] hover:shadow-[0_10px_26px_rgba(15,23,42,0.07)]"
      style={{ borderColor: erOutlier === "high" ? `${P.green}30` : erOutlier === "low" ? `${P.red}30` : "rgba(15,23,42,0.07)" }}>
      <div className="mb-[3px] flex items-start justify-between">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">{group}</div>
          <div className="mt-[3px] text-[19px] font-bold text-ink">
            {grp.count} <span className="text-[11px] font-medium text-mute">· {countPct}%</span>
          </div>
        </div>
        {badge && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] shadow-sm"
            style={{ color:badge.c, background:`${badge.c}12` }}>
            {badge.sym} {badge.label}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mute">Avg ER</span>
            <div className="flex items-center gap-[5px]">
              <span className="text-[12px] font-bold text-pink">{grp.er.toFixed(1)}%</span>
              {erPctOfAvg !== "0" && (
                <span className={`text-[10px] font-semibold ${erPctOfAvg > 0 ? "text-green" : "text-red"}`}>
                  {erPctOfAvg > 0 ? "+" : ""}{erPctOfAvg}%
                </span>
              )}
            </div>
          </div>
          <div className="relative h-[5px] rounded-full bg-well">
            <div className="h-full rounded-full bg-pink transition-[width] duration-700 ease-out" style={{ width:`${Math.min((grp.er/10)*100, 100)}%` }}/>
            {erAvg > 0 && <div className="absolute -inset-y-1 w-px bg-ink opacity-40" style={{ left:`${Math.min((erAvg/10)*100, 100)}%` }}/>}
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mute">Followers</span>
            <div className="flex items-center gap-[5px]">
              <span className="text-[12px] font-bold text-accent">{fmtNum(grp.followers)}</span>
              <span className="text-[10px] text-sub">{folPct}%</span>
            </div>
          </div>
          <div className="h-[5px] rounded-full bg-well">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width:`${folPct}%` }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function OverviewDashboard() {
  const { P, setPage } = useApp();
  const { user } = useAuth();
  const clientName = user?.clientName ?? "Your Brand";
  const [service, setService] = useState("all");
  const [filters, setFilters] = useState({ niche:[], size:[], language:[], status:[] });
  const [openFilter, setOpenFilter] = useState(null);
  const [campaigns, setCampaigns] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.clientName) return;
    PortalAPI.campaigns(user.clientName).then(setCampaigns).catch(e => setError(e.message));
  }, [user?.clientName]);

  const toggleFilter = (group, val) =>
    setFilters(f => ({ ...f, [group]: f[group].includes(val) ? f[group].filter(x => x !== val) : [...f[group], val] }));
  const clearFilters = () => setFilters({ niche:[], size:[], language:[], status:[] });
  const activeFilterCount = Object.values(filters).reduce((s, a) => s + a.length, 0);

  /* Campaigns for the selected service tab */
  const serviceCampaigns = useMemo(() => {
    if (!campaigns) return [];
    if (service === "all") return campaigns;
    return campaigns.filter(c => (c.service || "").toLowerCase().includes("influencer"));
  }, [campaigns, service]);

  /* Flatten creators across campaigns, normalising followers/size */
  const allCreators = useMemo(() =>
    serviceCampaigns.flatMap(c => (c.creators || []).map(cr => {
      const followers = parseFollowers(cr.followers);
      return { ...cr, followers, size: sizeOf(followers), er: Number(cr.avgER) || 0, campaignName: c.name };
    })), [serviceCampaigns]);

  /* Filter options offered = values that actually occur in the data */
  const filterOptions = useMemo(() => {
    const opts = {};
    for (const g of FILTER_GROUPS) {
      opts[g.id] = [...new Set(allCreators.map(cr => cr[g.id]).filter(Boolean))].sort();
    }
    return opts;
  }, [allCreators]);

  const creators = useMemo(() => allCreators.filter(cr =>
    Object.entries(filters).every(([g, sel]) => !sel.length || sel.includes(cr[g]))
  ), [allCreators, filters]);

  /* KPIs */
  const kpis = useMemo(() => {
    const active = serviceCampaigns.filter(c => phaseOf(c.stage) !== "completed").length;
    const followers = creators.reduce((s, cr) => s + cr.followers, 0);
    const ers = creators.map(cr => cr.er).filter(v => v > 0);
    const liveCreators = creators.filter(cr => cr.live?.postUrl).length;
    const budget = serviceCampaigns.reduce((s, c) => s + (Number(c.budget) || 0), 0);
    return { active, total: serviceCampaigns.length, creators: creators.length,
      followers, avgER: ers.length ? ers.reduce((a,b)=>a+b,0)/ers.length : 0, liveCreators, budget };
  }, [serviceCampaigns, creators]);

  /* Pipeline snapshot — campaign count per portal phase */
  const phaseCounts = useMemo(() => {
    const m = Object.fromEntries(PHASES.map(p => [p.id, 0]));
    serviceCampaigns.forEach(c => { m[phaseOf(c.stage)]++; });
    return m;
  }, [serviceCampaigns]);
  const phaseColors = phaseColorsFor(P);

  /* Creator breakdowns by group, with ER outlier flags */
  const breakdown = (key) => {
    const groups = {};
    creators.forEach(cr => {
      const g = cr[key] || "Unknown";
      if (!groups[g]) groups[g] = { count:0, followers:0, ers:[] };
      groups[g].count++;
      groups[g].followers += cr.followers;
      if (cr.er > 0) groups[g].ers.push(cr.er);
    });
    const rows = Object.entries(groups).map(([g, v]) => ({
      group: g, count: v.count, followers: v.followers,
      er: v.ers.length ? v.ers.reduce((a,b)=>a+b,0)/v.ers.length : 0,
    })).sort((a,b) => b.count - a.count);
    const erStats = stats(rows.map(r => r.er).filter(v => v > 0));
    return { rows, erStats };
  };
  const byNiche = useMemo(() => breakdown("niche"), [creators]);
  const bySize  = useMemo(() => breakdown("size"),  [creators]);
  const totalFollowers = creators.reduce((s, cr) => s + cr.followers, 0);

  /* Campaigns with creators waiting on client review — surfaced up top */
  const actionItems = useMemo(() => serviceCampaigns
    .map(c => ({ id: c.id, name: c.name, n: (c.creators || []).filter(needsInput).length }))
    .filter(x => x.n > 0), [serviceCampaigns]);

  if (error) return <ErrorState message={error}/>;
  if (!campaigns) return <PageSkeleton/>;

  return (
    <div className="relative">
      {/* Ambient background — soft radial gradients, barely-there mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full opacity-[0.10] blur-[110px]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)" }}/>
        <div className="absolute -right-32 top-40 size-[460px] rounded-full opacity-[0.08] blur-[120px]" style={{ background: "radial-gradient(circle, #7860D6, transparent 70%)" }}/>
        <div className="absolute bottom-0 left-1/3 size-[400px] rounded-full opacity-[0.07] blur-[100px]" style={{ background: "radial-gradient(circle, #1E9E5A, transparent 70%)" }}/>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-5 pb-14 sm:px-9">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3 pb-6 pt-9">
          <div>
            <h1 className="font-serif text-[42px] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Overview</h1>
            <div className="mt-1.5 text-[14px] text-sub">{clientName} <span className="mx-1.5 text-mute">·</span> {kpis.total} campaign{kpis.total === 1 ? "" : "s"}</div>
          </div>
          {/* Service tabs */}
          <div className="flex gap-1 rounded-full border border-[rgba(15,23,42,0.07)] bg-white/70 p-1.5 shadow-[0_1px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            {SERVICES.map(s => (
              <button key={s.id} onClick={() => setService(s.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all duration-200 ease-out ${
                  service === s.id ? "bg-accent text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]" : "text-sub hover:text-ink"
                }`}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </header>

        {/* Action needed — creators waiting on client review, across campaigns */}
        {actionItems.length > 0 && (
          <div className="au mb-6 flex flex-wrap items-center gap-2.5 rounded-[18px] border border-amber/20 bg-amber/[0.06] px-5 py-4 shadow-[0_2px_16px_rgba(180,120,10,0.05)] backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber">
              <span className="text-[13px]">⚠</span> {actionItems.reduce((s, x) => s + x.n, 0)} creator{actionItems.reduce((s, x) => s + x.n, 0) === 1 ? "" : "s"} waiting on your review
            </span>
            {actionItems.map(x => (
              <button key={x.id} onClick={() => setPage("campaigns", { campaignId: x.id })}
                className="rounded-full border border-amber/25 bg-white/70 px-3.5 py-1.5 text-[11.5px] font-medium text-ink shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-amber/50 hover:shadow-md">
                {x.name} <span className="mx-0.5 text-mute">·</span> <b className="text-amber">{x.n}</b>
              </button>
            ))}
          </div>
        )}

        {/* KPI row */}
        <div className="au mb-6 grid gap-3.5" style={{ gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))" }}>
          <KPICard label="Active Campaigns" value={kpis.active} sublabel={`of ${kpis.total} total`} color={P.accent}/>
          <KPICard label="Creators" value={kpis.creators} sublabel={`${kpis.liveCreators} live`} color={P.green}/>
          <KPICard label="Combined Followers" value={fmtNum(kpis.followers)} sublabel="across creators" color={P.pink}/>
          <KPICard label="Avg Engagement" value={`${kpis.avgER.toFixed(1)}%`} sublabel="creators with ER data" color={P.amber}/>
          <KPICard label="Campaign Budget" value={fmtINR(kpis.budget)} sublabel="committed" color={P.purple}/>
        </div>

        {/* Creator filters */}
        <div className="au mb-6 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-5 py-4 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Creator Filters</span>
            {FILTER_GROUPS.map(g => (
              <button key={g.id} onClick={() => setOpenFilter(openFilter === g.id ? null : g.id)}
                className={`rounded-full border px-3.5 py-[7px] text-[11.5px] font-semibold transition-all duration-200 ease-out ${
                  filters[g.id].length
                    ? "border-accent/20 bg-accent/[0.08] text-accent shadow-sm"
                    : "border-[rgba(15,23,42,0.08)] bg-well/70 text-sub hover:text-ink"
                }`}>
                {g.label}{filters[g.id].length ? ` · ${filters[g.id].length}` : ""} {openFilter === g.id ? "▴" : "▾"}
              </button>
            ))}
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="rounded-full px-3 py-[7px] text-[11.5px] font-semibold text-red transition-colors hover:bg-red/5">
                Clear all
              </button>
            )}
            <span className="ml-auto text-[11.5px] text-sub">{creators.length} of {allCreators.length} creators</span>
          </div>
          {openFilter && (
            <div className="fi mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(15,23,42,0.06)] pt-3">
              {(filterOptions[openFilter] || []).map(opt => {
                const on = filters[openFilter].includes(opt);
                return (
                  <button key={opt} onClick={() => toggleFilter(openFilter, opt)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] transition-all duration-200 ${
                      on ? "border-accent/25 bg-accent/[0.1] font-semibold text-accent shadow-sm" : "border-[rgba(15,23,42,0.08)] bg-well/70 text-sub hover:text-ink"
                    }`}>{opt}</button>
                );
              })}
              {!(filterOptions[openFilter] || []).length && <span className="text-[11.5px] text-mute">No data for this filter yet</span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Pipeline snapshot */}
          <div className="au rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-6 py-5 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <h3 className="mb-1 font-serif text-[19px] italic font-semibold text-ink">Campaign Pipeline</h3>
            <p className="mb-5 text-[12.5px] text-sub">Where each campaign stands</p>
            <div className="flex flex-col gap-3.5">
              {PHASES.map(p => {
                const n = phaseCounts[p.id];
                const pct = kpis.total ? (n / kpis.total) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div className="mb-[5px] flex justify-between">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                        <Dot color={phaseColors[p.id]}/> {p.short}
                      </span>
                      <span className="text-[13.5px] font-bold" style={{ color: n ? phaseColors[p.id] : P.doneTxt }}>{n}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-well">
                      <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width:`${pct}%`, background:phaseColors[p.id], boxShadow: n ? `0 0 10px ${phaseColors[p.id]}55` : "none" }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campaign list */}
          <div className="au rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-6 py-5 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <h3 className="mb-1 font-serif text-[19px] italic font-semibold text-ink">Campaigns</h3>
            <p className="mb-4 text-[12.5px] text-sub">Tap to open</p>
            <div className="flex flex-col gap-2">
              {[...serviceCampaigns]
                .sort((a,b) => (b.creators?.length || 0) - (a.creators?.length || 0))
                .map(c => {
                  const phase = phaseOf(c.stage);
                  return (
                    <button key={c.id} onClick={() => setPage("campaigns", { campaignId: c.id })}
                      className="group rounded-[14px] border border-[rgba(15,23,42,0.06)] bg-white/60 px-4 py-3 text-left shadow-sm transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-accent/20 hover:shadow-[0_8px_22px_rgba(15,23,42,0.07)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color:phaseColors[phase] }}>
                          <Dot color={phaseColors[phase]} sz={5}/> {PHASES.find(p => p.id === phase)?.short}
                        </span>
                      </div>
                      <div className="mt-1 text-[11.5px] text-sub">
                        {(c.creators || []).length} creator{(c.creators || []).length === 1 ? "" : "s"} · {fmtINR(Number(c.budget) || null)}
                      </div>
                    </button>
                  );
                })}
              {!serviceCampaigns.length && (
                <EmptyState icon="▤" title="No campaigns yet"
                  hint="Start one by sending us a requirement from the Campaigns page."
                  actionLabel="Go to Campaigns" onAction={() => setPage("campaigns")}/>
              )}
            </div>
          </div>
        </div>

        {/* Creator breakdowns */}
        {[["Creator Niche Performance", byNiche], ["Creator Size Performance", bySize]].map(([title, data]) => (
          <div className="au mt-4 rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-white/70 px-6 py-5 shadow-[0_2px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_10px_36px_rgba(15,23,42,0.06)]" key={title}>
            <h3 className="mb-1 font-serif text-[19px] italic font-semibold text-ink">{title}</h3>
            <p className="mb-4 text-[12.5px] text-sub">Avg ER vs overall · outliers beyond ±1.3σ flagged</p>
            <div className="grid gap-3" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(190px, 1fr))" }}>
              {data.rows.map(r => (
                <BreakdownCard key={r.group} group={r.group} grp={r} total={creators.length}
                  totalFollowers={totalFollowers} erAvg={data.erStats.avg}
                  erOutlier={isOutlier(r.er, data.erStats.avg, data.erStats.stdDev)} P={P}/>
              ))}
              {!data.rows.length && <div className="p-3 text-[12.5px] text-mute">No creators match the current filters</div>}
            </div>
          </div>
        ))}

        {/* Performance — dual-axis charts, funnel, spend split */}
        <div className="mt-4">
          <PerformanceSection clientName={clientName} />
        </div>
      </div>
    </div>
  );
}