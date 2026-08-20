// src/components/campaigns/mapping.js — DB → VIEW mapping for the Campaigns page.
// Campaigns come from GET /api/portal/campaigns (see lib/api.js) in the backend's
// shape; these helpers convert them into what the page renders. Anything the DB
// doesn't store yet renders as "—" / hidden rather than being invented.

import { parseFollowers, sizeOf, fmtNum, fmtINR, initials } from "../../lib/format";
import { STATES_META, stateCode } from "../../lib/geo";
// Both from the phase registry itself. lib/api re-exports phaseOf for callers
// that already imported it there, but taking one of the pair from each module
// would leave two import paths for one registry.
import { phaseOf, progressOf } from "../../lib/phases";
import {
  STATUS_MAP, ACTIONABLE_STATUSES, creatorStatus, erOf, cpvOf,
  isLocked, deliverableTarget, deliverablesPosted, totalDeliverables, postedDeliverables,
  growthSeries, growthByCreator,
} from "../../lib/portalMetrics";

// The status vocabulary, the "waiting on you" list, the furthest-signal status
// resolver and the ER formula now live in lib/portalMetrics.js — Overview and
// the Regional Map need them too, and three copies of "what counts as waiting
// on the brand" is how the board and the dashboard start disagreeing.
// Re-exported here so this module stays the one import the campaigns UI needs.
export { STATUS_MAP, ACTIONABLE_STATUSES, creatorStatus, erOf };

// Chart series drawn from the theme palette (accent/teal/pink/amber/purple/
// green/gold + tints) so charts read as part of the same system.
export const BCOLORS = ["#2C3E7E","#178E80","#A2489A","#A8720C","#6C55CE","#17915A","#96792A","#5B6FA3","#4FA97E","#C27FBA"];

/* Shared class strings for chips / selectable pills — premium glass style */
export const chipOn  = "border-accent/20 bg-accent/[0.09] text-accent shadow-sm";
export const chipOff = "border-line bg-well/70 text-sub hover:text-ink";
export const inputCls = "w-full rounded-[10px] border border-line bg-white/70 px-3 py-2 text-[13px] text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(44,62,126,0.08)]";
export const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute";
export const closeBtnCls = "flex size-7 items-center justify-center rounded-full border border-line bg-well/70 text-[13px] text-sub transition-all duration-200 hover:bg-red/[0.08] hover:text-red";

/* Public profile link for a creator's handle, or null when one can't be built.
   Returning null is what lets the caller render plain text: `url` used to be
   just `cr.igUrl`, which is only set when someone used the internal Add Creator
   "Fetch" button — so every hand-added creator arrived with url:null and their
   handle still rendered inside an <a>, as accent-coloured text that looks like
   a link and does nothing.

   Mirrors profileUrl() in the internal app (5th-internal-front
   src/lib/campaign.js). Duplicated rather than imported because the two apps
   are separate deployments with no shared package — keep the two in step. */
const PROFILE_URL = {
  "Instagram":   h => `https://www.instagram.com/${h}/`,
  "YouTube":     h => `https://www.youtube.com/@${h}`,
  "Twitter / X": h => `https://x.com/${h}`,
  "Snapchat":    h => `https://www.snapchat.com/add/${h}`,
};
const HANDLE_RE = /^[A-Za-z0-9._-]{1,50}$/;

export function profileUrl(cr) {
  const abs = u => { const t = String(u).trim(); return /^https?:\/\//i.test(t) ? t : `https://${t}`; };
  if (cr?.igUrl) return abs(cr.igUrl);
  const raw = String(cr?.handle || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;   // already a full link
  const h = raw.replace(/^@+/, "");
  if (!HANDLE_RE.test(h)) return null;         // spaces, emoji, junk
  return PROFILE_URL[cr?.platform]?.(h) || null;
}

/* Numeric-or-null: never invents a value for missing tracking data */
const numOrNull = (v) => (v == null || v === "" ? null : Number(v) || null);

/* MEASURED data wins over the creator's profile `avgER`, which is only a
   forecast — see erOf()'s contract in lib/portalMetrics.js. Profile ER stays
   the fallback for the window before anything is live, which is the only time
   it's the best estimate available. */
const fmtER = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

/**
 * `campaign` is required to read deliverables: what a creator owes is their own
 * `numDeliverables` override *or* the campaign's plan, so the creator can't be
 * mapped in isolation. See the DELIVERABLES block in lib/portalMetrics.js.
 */
export function toViewCreator(cr, campaign) {
  const followers = parseFollowers(cr.followers);
  const locked = isLocked(cr);
  const target = deliverableTarget(campaign, cr);
  const posted = deliverablesPosted(cr);
  const tracking = cr.tracking && typeof cr.tracking === "object" ? {
    views: numOrNull(cr.tracking.views),
    likes: numOrNull(cr.tracking.likes),
    comments: numOrNull(cr.tracking.comments),
    forwards: numOrNull(cr.tracking.forwards),
    commentAnalysis: cr.tracking.commentAnalysis || null,
    positivityScore: numOrNull(cr.tracking.positivityScore),
    lastFetched: cr.tracking.lastFetched || null,
    // The append-only series behind the Growth tab (backend trackingHistory.js).
    // Passed straight through rather than reshaped: growthSeries() in
    // portalMetrics.js owns the aggregation, and two places normalising the
    // same points is how they drift.
    history: Array.isArray(cr.tracking.history) ? cr.tracking.history : null,
  } : null;
  const hasTracking = tracking && Object.values(tracking).some(v => v != null);
  return {
    name: cr.name || "—",
    handle: cr.handle ? (cr.handle.startsWith("@") ? cr.handle : `@${cr.handle}`) : "",
    url: profileUrl(cr),
    followers: fmtNum(followers),
    platform: cr.platform || "—",
    status: creatorStatus(cr),
    rawStatus: cr.status || null,
    // Deliverables only mean something once a creator is locked — until then
    // they're a candidate, not a commitment. Reads "1/2" (posted of target).
    locked,
    deliverableTarget: locked ? target : null,
    deliverablesPosted: locked ? posted : null,
    deliverables: locked ? `${posted}/${target}` : "—",
    engRate: fmtER(
      (tracking && erOf(tracking.likes, tracking.comments, tracking.views)) ?? numOrNull(cr.avgER)
    ),
    avgLikes: numOrNull(cr.avgLikes),
    niche: cr.niche || "—",
    size: sizeOf(followers),
    region: STATES_META[stateCode(cr.state)]?.name || cr.state || "—",
    language: cr.languages?.length ? cr.languages.join(", ") : cr.language || "—",
    avatar: initials(cr.name),
    briefDoc: cr.concept?.fileLink ? { name: "Concept file", url: cr.concept.fileLink } : null,
    videoDoc: cr.demo?.fileLink ? { name: "Demo video", url: cr.demo.fileLink } : null,
    live: cr.live?.postUrl ? { postUrl: cr.live.postUrl, postedDate: cr.live.postedDate || null } : null,
    tracking: hasTracking ? tracking : null,
    approval: { exec: null, mgmt: null, execLocked: false, mgmtLocked: false },
  };
}

export function toViewCampaign(c) {
  const phase = phaseOf(c.stage);
  const creators = (c.creators || []).map(cr => toViewCreator(cr, c));
  const brief = c.brief && typeof c.brief === "object" ? c.brief : null;
  const briefLocked = c.briefStatus === "locked";
  const briefView = brief ? {
    objective: brief.objective || "", targetAudience: brief.audience || "",
    keyMessages: brief.messages || "", deliverables: brief.deliverables || "",
    budget: brief.budget || fmtINR(Number(c.budget) || null), timeline: brief.timeline || "",
    // No per-field status here. It used to carry a `vars` map, but every entry
    // was the same value derived from `briefLocked` — so the detail view painted six
    // identical status glyphs that said exactly what its own banner said. The
    // brief is approved as one document; if per-field sign-off ever becomes
    // real, it has to come from the backend rather than be fanned out from one
    // boolean.
  } : null;

  /* Real aggregates over creators that actually have tracking data */
  const sumTrack = (key) => creators.reduce((s, cr) => s + (cr.tracking?.[key] || 0), 0);
  const trackTotals = { views: sumTrack("views"), likes: sumTrack("likes"), comments: sumTrack("comments"), forwards: sumTrack("forwards") };
  const hasTrackTotals = Object.values(trackTotals).some(v => v > 0);
  const views = trackTotals.views;

  /* Campaign ER off the campaign's own totals once anything is live — NOT the
     mean of the per-creator rates, which weights a creator with 2k views the
     same as one with 2m. Before the first post, the roster's profile rates are
     the only estimate there is, and there the plain mean is the honest one. */
  const profileERs = (c.creators || []).map(cr => Number(cr.avgER)).filter(v => v > 0);
  const avgER = fmtER(
    erOf(trackTotals.likes, trackTotals.comments, trackTotals.views)
    ?? (profileERs.length ? profileERs.reduce((a, b) => a + b, 0) / profileERs.length : null)
  );
  const positivities = creators.map(cr => cr.tracking?.positivityScore).filter(v => v != null);
  const avgPositivity = positivities.length ? positivities.reduce((a, b) => a + b, 0) / positivities.length : null;
  const lastFetched = creators.map(cr => cr.tracking?.lastFetched).filter(Boolean).sort().pop() || null;
  // Empty until at least two days of readings exist; the detail view hides the tab
  // rather than showing a chart with one point in it. The per-creator split
  // shares the same basis, so the two views can never disagree.
  const growth = growthSeries(creators);
  const growthPerCreator = growthByCreator(creators);

  return {
    id: c.id,
    name: c.name,
    service: c.service || "Influencer Marketing",
    region: c.region || "—",
    phase,
    // progressOf() reads the stored value where one exists and otherwise
    // derives it from the stage, matching the internal app's pipeline table.
    // The old phase-index fallback here rounded five phases into 0/25/50/75/100
    // and disagreed with the health ring on the same campaign.
    progress: progressOf(c),
    engagement: avgER,
    engRate: avgER,
    views: views ? fmtNum(views) : "—",
    // External CPV — committed budget per measured view. Null until the
    // campaign has both, so the card reads "—" rather than an invented rate.
    cpv: cpvOf(Number(c.budget) || 0, views),
    start: c.start || "—",
    end: c.end || "—",
    budget: fmtINR(Number(c.budget) || null),
    budgetNum: Number(c.budget) || 0,
    numReq: Number(c.numReq) || null,
    lockedCount: (c.creators || []).filter(isLocked).length,
    // Committed posts (locked creators' real targets + unfilled slots at the
    // campaign plan) and how many are actually live. Computed off the RAW
    // campaign so it matches totalDelivOf() in the internal app exactly — the
    // two must never quote a brand different numbers.
    deliverablesTotal: totalDeliverables(c),
    deliverablesPosted: postedDeliverables(c),
    deliverablesPerCreator: Number(c.deliverablesPerCreator) || 1,
    liveCount: creators.filter(cr => cr.live).length,
    waiting: creators.filter(cr => ACTIONABLE_STATUSES.includes(cr.status)).length,
    trackTotals: hasTrackTotals ? trackTotals : null,
    growth,
    growthPerCreator,
    avgPositivity,
    lastFetched,
    brief: brief?.objective || "",
    lockedBrief: briefLocked ? briefView : null,
    pendingBrief: !briefLocked ? briefView : null,
    status: phase === "completed" ? "done" : "active",
    creators,
    topAssets: [],
  };
}
