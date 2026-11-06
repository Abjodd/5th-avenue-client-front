/**
 * src/pages/LiveCampaignOverview.jsx
 *
 * Account-wide view of campaigns currently in the Live workflow phase.
 * The phase is the same field used by the Campaigns board columns, so this
 * page and the Live campaigns button stay consistent with the board.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Users,
  Eye,
} from "lucide-react";
import { useApp } from "../context";
import { usePortalCampaigns } from "../lib/usePortalData";
import { toViewCampaign } from "../components/campaigns/mapping";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import { AmbientBackground } from "../components/motion/Motion";

const mapCampaigns = (data) => data.map(toViewCampaign);

function LiveCreatorRow({ creator }) {
  const liveUrl = creator.live?.postUrl;
  return (
    <div className="flex h-[56px] min-w-0 shrink-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/[0.08] text-[11px] font-bold text-accent">
        {creator.avatar || (creator.name || "C").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-ink">
          {creator.name || "Creator"}
        </div>
        <div className="truncate text-[10.5px] text-mute">
          {[creator.handle, creator.platform].filter(Boolean).join(" · ") ||
            "Live creator"}
        </div>
      </div>
      {liveUrl ? (
        <a
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[10.5px] font-semibold text-accent transition hover:bg-accent/[0.06]"
        >
          View post <ExternalLink size={11} />
        </a>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-green">
          <Radio size={10} /> Live
        </span>
      )}
    </div>
  );
}

function LiveCampaignCard({ campaign, onOpen }) {
  const liveCreators = (campaign.creators || []).filter(
    (creator) => creator.live,
  );
  const meta = [
    campaign.service,
    campaign.region !== "—" ? campaign.region : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="h-full overflow-hidden rounded-[18px] border border-line bg-glass shadow-[0_2px_14px_rgba(25,22,17,0.04)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_12px_28px_rgba(25,22,17,0.08)]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-green/[0.09] px-2.5 py-1 text-[10px] font-semibold text-green">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-40" />
                <span className="relative inline-flex size-1.5 rounded-full bg-green" />
              </span>
              LIVE NOW
            </div>
            <h2 className="truncate font-serif text-[21px] font-semibold leading-tight text-ink">
              {campaign.name}
            </h2>
            {meta && (
              <p className="mt-1 truncate text-[11.5px] text-mute">{meta}</p>
            )}
          </div>
          <div className="shrink-0 rounded-[13px] bg-well px-3 py-2 text-center">
            <div className="tnum text-[22px] font-bold leading-none text-ink">
              {campaign.liveCount ?? liveCreators.length}
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-mute">
              Live
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] bg-well/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-mute">
              <Users size={11} /> Creators live
            </div>
            <div className="tnum mt-1 text-[15px] font-semibold text-ink">
              {campaign.liveCount ?? liveCreators.length}
            </div>
          </div>
          <div className="rounded-[12px] bg-well/70 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-mute">
              <Eye size={11} /> Tracked views
            </div>
            <div className="tnum mt-1 text-[15px] font-semibold text-ink">
              {campaign.views || "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-2">
          <div className="microlabel mb-1">Live creators</div>
          <div className="h-[112px] overflow-y-auto overscroll-contain divide-y divide-line/70 pr-1 [scrollbar-gutter:stable]">
            {liveCreators.length > 0 ? (
              liveCreators.map((creator) => (
                <LiveCreatorRow key={creator.key} creator={creator} />
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-mute">
                No creator details available.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-[11.5px] font-semibold text-accent transition-colors hover:border-accent/30 hover:bg-accent/[0.05]"
        >
          Open campaign details <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

export default function LiveCampaignOverview() {
  const { P, setPage } = useApp();
  const navigate = useNavigate();
  const { data: campaigns, error, retry } = usePortalCampaigns(mapCampaigns);
  const [search, setSearch] = useState("");

  const liveCampaigns = useMemo(
    () => (campaigns || []).filter((campaign) => campaign.phase === "live"),
    [campaigns],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return liveCampaigns;
    return liveCampaigns.filter((campaign) =>
      [campaign.name, campaign.service, campaign.region]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [liveCampaigns, search]);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!campaigns) return <PageSkeleton />;

  const liveCreatorTotal = liveCampaigns.reduce(
    (total, campaign) => total + (campaign.liveCount || 0),
    0,
  );

  return (
    <div className="relative min-h-screen bg-page font-sans text-ink">
      <AmbientBackground variant="b" />
      <main className="relative z-10 mx-auto max-w-[1500px] px-4 pb-14 pt-8 sm:px-7 lg:px-9">
        <button
          type="button"
          onClick={() => navigate("/portal/campaigns")}
          className="mb-6 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-mute transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} /> Back to all campaigns
        </button>

        <header className="mb-7 flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
          <div>
            <div className="microlabel mb-2 flex items-center gap-2 tracking-[0.16em]">
              <Radio size={12} className="text-green" /> LIVE CAMPAIGNS
            </div>
            <h1 className="font-serif text-[clamp(34px,5vw,56px)] font-bold italic leading-[1.05] tracking-[-0.025em] text-ink">
              Live campaign overview
            </h1>
            <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-sub">
              Campaigns currently in the Live stage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[118px] rounded-[14px] border border-line bg-glass px-4 py-3">
              <div className="tnum text-[25px] font-bold leading-none text-ink">
                {liveCampaigns.length}
              </div>
              <div className="mt-1 text-[10px] text-mute">Live campaigns</div>
            </div>
            <div className="min-w-[118px] rounded-[14px] border border-line bg-glass px-4 py-3">
              <div className="tnum text-[25px] font-bold leading-none text-ink">
                {liveCreatorTotal}
              </div>
              <div className="mt-1 text-[10px] text-mute">Live creators</div>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-[24px] font-semibold text-ink">
              Currently live
            </h2>
            <p className="mt-1 text-[11.5px] text-mute">
              {filtered.length} of {liveCampaigns.length} live campaigns
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search live campaigns..."
            className="w-full rounded-full border border-line bg-glass px-4 py-2.5 text-[12px] text-ink outline-none transition focus:border-accent/40 sm:max-w-[300px]"
          />
        </div>

        {liveCampaigns.length === 0 ? (
          <EmptyState
            icon="◉"
            title="No live campaigns right now"
            hint="Campaigns will appear here when they move into the Live stage."
            actionLabel="View all campaigns"
            onAction={() => setPage("campaigns")}
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-line bg-glass/50 px-5 py-12 text-center">
            <p className="text-[13px] font-semibold text-ink">
              No matching campaigns
            </p>
            <p className="mt-1 text-[11.5px] text-mute">
              Try another campaign name, service or region.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((campaign) => (
              <LiveCampaignCard
                key={campaign.id}
                campaign={campaign}
                onOpen={() => setPage("campaigns", { campaignId: campaign.id })}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
