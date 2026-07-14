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
    <div className="rounded-[11px] border border-line bg-surface px-4 py-3.5">
      <div className="microlabel mb-1.5">{label}</div>
      <div className="text-[26px] font-bold leading-none" style={{ color }}>{value}</div>
      {sublabel && <div className="mt-1.5 text-[11px] text-mute">{sublabel}</div>}
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
    <div className="rounded-[9px] border bg-page px-3.5 py-3"
      style={{ borderColor: erOutlier === "high" ? `${P.green}30` : erOutlier === "low" ? `${P.red}30` : P.border }}>
      <div className="mb-[3px] flex items-start justify-between">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">{group}</div>
          <div className="mt-[3px] text-[18px] font-bold text-ink">
            {grp.count} <span className="text-[11px] font-medium text-mute">· {countPct}%</span>
          </div>
        </div>
        {badge && (
          <span className="rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
            style={{ color:badge.c, background:`${badge.c}12` }}>
            {badge.sym} {badge.label}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        <div>
          <div className="mb-0.5 flex justify-between">
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
          <div className="relative h-1 rounded-sm bg-well">
            <div className="h-full rounded-sm bg-pink" style={{ width:`${Math.min((grp.er/10)*100, 100)}%` }}/>
            {erAvg > 0 && <div className="absolute -inset-y-0.5 w-px bg-ink opacity-40" style={{ left:`${Math.min((erAvg/10)*100, 100)}%` }}/>}
          </div>
        </div>
        <div>
          <div className="mb-0.5 flex justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mute">Followers</span>
            <div className="flex items-center gap-[5px]">
              <span className="text-[12px] font-bold text-accent">{fmtNum(grp.followers)}</span>
              <span className="text-[10px] text-sub">{folPct}%</span>
            </div>
          </div>
          <div className="h-1 rounded-sm bg-well">
            <div className="h-full rounded-sm bg-accent" style={{ width:`${folPct}%` }}/>
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
    <div className="mx-auto w-full max-w-[1360px] px-4 pb-10 sm:px-7">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-2.5 pb-3.5 pt-6">
        <div>
          <h1 className="font-serif text-[22px] italic font-semibold tracking-[-0.02em] text-ink">Overview</h1>
          <div className="mt-[3px] text-[12px] text-sub">{clientName} · {kpis.total} campaign{kpis.total === 1 ? "" : "s"}</div>
        </div>
        {/* Service tabs */}
        <div className="flex gap-1 rounded-[9px] border border-line bg-surface p-1">
          {SERVICES.map(s => (
            <button key={s.id} onClick={() => setService(s.id)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-[7px] text-[12px] font-semibold ${
                service === s.id ? "bg-accent/[0.07] text-accent" : "text-sub"
              }`}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </header>

      {/* Action needed — creators waiting on client review, across campaigns */}
      {actionItems.length > 0 && (
        <div className="au mb-3.5 flex flex-wrap items-center gap-2 rounded-[11px] border border-amber/25 bg-amber/5 px-4 py-3">
          <span className="text-[12px] font-semibold text-amber">
            ⚠ {actionItems.reduce((s, x) => s + x.n, 0)} creator{actionItems.reduce((s, x) => s + x.n, 0) === 1 ? "" : "s"} waiting on your review
          </span>
          {actionItems.map(x => (
            <button key={x.id} onClick={() => setPage("campaigns", { campaignId: x.id })}
              className="rounded-full border border-amber/25 bg-surface px-3 py-1 text-[11px] font-medium text-ink hover:border-amber/50">
              {x.name} · <b className="text-amber">{x.n}</b>
            </button>
          ))}
        </div>
      )}

      {/* KPI row */}
      <div className="au mb-3.5 grid gap-2.5" style={{ gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KPICard label="Active Campaigns" value={kpis.active} sublabel={`of ${kpis.total} total`} color={P.accent}/>
        <KPICard label="Creators" value={kpis.creators} sublabel={`${kpis.liveCreators} live`} color={P.green}/>
        <KPICard label="Combined Followers" value={fmtNum(kpis.followers)} sublabel="across creators" color={P.pink}/>
        <KPICard label="Avg Engagement" value={`${kpis.avgER.toFixed(1)}%`} sublabel="creators with ER data" color={P.amber}/>
        <KPICard label="Campaign Budget" value={fmtINR(kpis.budget)} sublabel="committed" color={P.purple}/>
      </div>

      {/* Creator filters */}
      <div className="au card mb-3.5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Creator Filters</span>
          {FILTER_GROUPS.map(g => (
            <button key={g.id} onClick={() => setOpenFilter(openFilter === g.id ? null : g.id)}
              className={`rounded-md border px-[11px] py-[5px] text-[11px] font-semibold ${
                filters[g.id].length
                  ? "border-accent/20 bg-accent/[0.07] text-accent"
                  : "border-line bg-well text-sub"
              }`}>
              {g.label}{filters[g.id].length ? ` · ${filters[g.id].length}` : ""} {openFilter === g.id ? "▴" : "▾"}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="px-[11px] py-[5px] text-[11px] font-semibold text-red">
              Clear all
            </button>
          )}
          <span className="ml-auto text-[11px] text-sub">{creators.length} of {allCreators.length} creators</span>
        </div>
        {openFilter && (
          <div className="fi mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
            {(filterOptions[openFilter] || []).map(opt => {
              const on = filters[openFilter].includes(opt);
              return (
                <button key={opt} onClick={() => toggleFilter(openFilter, opt)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] ${
                    on ? "border-accent/25 bg-accent/[0.09] font-semibold text-accent" : "border-line bg-well text-sub"
                  }`}>{opt}</button>
              );
            })}
            {!(filterOptions[openFilter] || []).length && <span className="text-[11px] text-mute">No data for this filter yet</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        {/* Pipeline snapshot */}
        <div className="au card px-[18px] py-4">
          <h3 className="mb-0.5 font-serif text-[17px] italic font-semibold text-ink">Campaign Pipeline</h3>
          <p className="mb-3.5 text-[12px] text-sub">Where each campaign stands</p>
          <div className="flex flex-col gap-2.5">
            {PHASES.map(p => {
              const n = phaseCounts[p.id];
              const pct = kpis.total ? (n / kpis.total) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="mb-[3px] flex justify-between">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                      <Dot color={phaseColors[p.id]}/> {p.short}
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: n ? phaseColors[p.id] : P.doneTxt }}>{n}</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded bg-well">
                    <div className="h-full rounded transition-[width] duration-600 ease-out"
                      style={{ width:`${pct}%`, background:phaseColors[p.id] }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Campaign list */}
        <div className="au card px-[18px] py-4">
          <h3 className="mb-0.5 font-serif text-[17px] italic font-semibold text-ink">Campaigns</h3>
          <p className="mb-3 text-[12px] text-sub">Tap to open</p>
          <div className="flex flex-col gap-[7px]">
            {[...serviceCampaigns]
              .sort((a,b) => (b.creators?.length || 0) - (a.creators?.length || 0))
              .map(c => {
                const phase = phaseOf(c.stage);
                return (
                  <button key={c.id} onClick={() => setPage("campaigns", { campaignId: c.id })}
                    className="rounded-lg border border-line bg-page px-3 py-2.5 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color:phaseColors[phase] }}>
                        <Dot color={phaseColors[phase]} sz={5}/> {PHASES.find(p => p.id === phase)?.short}
                      </span>
                    </div>
                    <div className="mt-[3px] text-[11px] text-sub">
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
        <div className="au card mt-3.5 px-[18px] py-4" key={title}>
          <h3 className="mb-0.5 font-serif text-[17px] italic font-semibold text-ink">{title}</h3>
          <p className="mb-3 text-[12px] text-sub">Avg ER vs overall · outliers beyond ±1.3σ flagged</p>
          <div className="grid gap-2.5" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))" }}>
            {data.rows.map(r => (
              <BreakdownCard key={r.group} group={r.group} grp={r} total={creators.length}
                totalFollowers={totalFollowers} erAvg={data.erStats.avg}
                erOutlier={isOutlier(r.er, data.erStats.avg, data.erStats.stdDev)} P={P}/>
            ))}
            {!data.rows.length && <div className="p-3 text-[12px] text-mute">No creators match the current filters</div>}
          </div>
        </div>
      ))}

      {/* Performance — dual-axis charts, funnel, spend split */}
      <PerformanceSection clientName={clientName} />
    </div>
  );
}
