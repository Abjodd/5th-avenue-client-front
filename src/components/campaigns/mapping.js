// src/components/campaigns/mapping.js — DB → VIEW mapping for the Campaigns page.
// Campaigns come from GET /api/portal/campaigns (see lib/api.js) in the backend's
// shape; these helpers convert them into what the page renders. Anything the DB
// doesn't store yet renders as "—" / hidden rather than being invented.

import { parseFollowers, sizeOf, fmtNum, fmtINR, initials } from "../../lib/format";
import { STATES_META, stateCode } from "../../lib/geo";
// Both from the phase registry itself. lib/api re-exports phaseOf for callers
// that already imported it there, but taking one of the pair from each module
// would leave two import paths for one registry.
import { phaseOf, progressOf, briefLockedOf } from "../../lib/phases";
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

   Mirrors profileUrl() in the internal app (Fifth-internal-front
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

/* "TBD" is not a value — it is the internal create wizard's placeholder for a
   field nobody filled in (`region: f.region || "TBD"`, `end: f.timelineEnd ||
   "TBD"` in Fifth-internal-front Campaigns/index.jsx). It leaked straight onto the
   brand's campaign cards as a chip sitting next to the service, reading like a
   region called TBD. An unanswered optional field should render as absent here,
   the same as every other missing value in this module. */
const realValue = (v) => {
  const s = String(v ?? "").trim();
  return s && s.toUpperCase() !== "TBD" ? s : null;
};

/* Numeric-or-null: never invents a value for missing tracking data */
const numOrNull = (v) => (v == null || v === "" ? null : Number(v) || null);

/* MEASURED data wins over the creator's profile `avgER`, which is only a
   forecast — see erOf()'s contract in lib/portalMetrics.js. Profile ER stays
   the fallback for the window before anything is live, which is the only time
   it's the best estimate available. */
const fmtER = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

/* An asset's state, as the brand should read it.

   This used to ask ONE question — "is there a file link?" — and answer it as a
   link or the words "Not uploaded". But the link is optional on the internal
   side: the team moves an asset through its statuses whether or not anyone
   pastes a URL, and most of the time nobody does. Both creators on a live
   campaign here carry `concept: {status: "locked", fileLink: null}` — received,
   reviewed, signed off, and posted — while the portal told the brand their
   brief was "Not uploaded", directly under a live post with 2.5M views on it.

   So the STATUS is the fact, and the link is an extra a row shows when it
   happens to have one. Labels are the brand's reading of ASSET_STATUSES in
   Fifth-internal-front Campaigns/index.jsx; `locked` is internal for "signed off,
   no further edits", which is not a word to hand a client as-is. `t` is the
   tier rendered by components/StatusPill, same vocabulary as STATUS_MAP. */
const ASSET_STATUS = {
  yet_to_receive: { label: "Not received",          t: "neutral"  },
  received:       { label: "In review",             t: "progress" },
  rework:         { label: "In rework",             t: "progress" },
  pending_brand:  { label: "Awaiting your review",  t: "action"   },
  approved:       { label: "Approved",              t: "done"     },
  locked:         { label: "Signed off",            t: "done"     },
};

const assetView = (a) => ({
  ...(ASSET_STATUS[a?.status] || ASSET_STATUS.yet_to_receive),
  url: a?.fileLink || null,
});

/* How the post goes up: a paid collaboration (co-authored, so it carries the
   brand's own handle) or on the creator's account alone. Set on the internal
   Creators tab, where it is a precondition of locking — the fee is committed at
   the lock, and a collab type agreed afterwards is a question the brand was
   never asked. Which is why it belongs here: by the time a creator is locked,
   this is a term of the deal the brand is paying for.

   Null while nobody has decided yet, and the row renders nothing rather than a
   dash — same rule as the rest of this module, an unanswered question is not a
   value. Labels mirror COLLAB_TYPES in Fifth-internal-front Campaigns/index.jsx. */
const COLLAB_LABELS = { collab: "Collab", non_collab: "Non-Collab" };

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
    collab: COLLAB_LABELS[cr.collab] || null,
    size: sizeOf(followers),
    region: STATES_META[stateCode(cr.state)]?.name || cr.state || "—",
    language: cr.languages?.length ? cr.languages.join(", ") : cr.language || "—",
    avatar: initials(cr.name),
    briefAsset: assetView(cr.concept),
    videoAsset: assetView(cr.demo),
    live: cr.live?.postUrl ? { postUrl: cr.live.postUrl, postedDate: cr.live.postedDate || null } : null,
    tracking: hasTracking ? tracking : null,
    approval: { exec: null, mgmt: null, execLocked: false, mgmtLocked: false },
  };
}

export function toViewCampaign(c) {
  const phase = phaseOf(c.stage);
  const creators = (c.creators || []).map(cr => toViewCreator(cr, c));
  const brief = c.brief && typeof c.brief === "object" ? c.brief : null;
  const briefLocked = briefLockedOf(c);
  const briefView = brief ? {
    objective: brief.objective || "", targetAudience: brief.audience || "",
    keyMessages: brief.messages || "", deliverables: brief.deliverables || "",
    // "To be confirmed", not "—". A campaign can be raised in the internal app
    // before the brand has agreed a number (Fifth-internal-front lib/campaign.js
    // hasBudget), and this is the brand's OWN brief — an em dash reads as a
    // figure we're withholding, when the truth is that it hasn't been set yet
    // and they are the ones who set it.
    budget: brief.budget || (Number(c.budget) > 0 ? fmtINR(Number(c.budget)) : "To be confirmed"),
    timeline: brief.timeline || "",
    // No per-field status here. It used to carry a `vars` map, but every entry
    // was the same value derived from `briefLocked` — so the detail view painted six
    // identical status glyphs that said exactly what its own banner said. The
    // brief is approved as one document; if per-field sign-off ever becomes
    // real, it has to come from the backend rather than be fanned out from one
    // boolean.
  } : null;

  /* Real aggregates over creators that actually have tracking data.

     A null field is a refresh that didn't report that number, NOT a count that
     fell to zero, so it falls back to the most recent reading that did carry
     it. Without that, one partial refresh silently deletes a post's whole
     contribution: a roster here came back with `forwards: null` on its latest
     fetch, which took 33.8K shares off the live total and off the engagements
     figure derived from it, while the campaign had not lost a single share.

     Same rule as carriedByDay() in portalMetrics.js, which the growth chart is
     built on — the two must not disagree about what a null means. */
  const TRACK_KEYS = ["views", "likes", "comments", "forwards"];
  const lastKnown = creators.map((cr) => {
    // Newest first: nothing guarantees stored order, and the fallback wants
    // the latest reading that carried the field, not the first.
    const history = Array.isArray(cr.tracking?.history)
      ? [...cr.tracking.history].sort((a, b) => String(b.at).localeCompare(String(a.at)))
      : [];
    return Object.fromEntries(TRACK_KEYS.map((key) => {
      const live = cr.tracking?.[key];
      const hit = live != null ? { [key]: live } : history.find((p) => p?.[key] != null);
      return [key, Number(hit?.[key]) || 0];
    }));
  });
  const sumTrack = (key) => lastKnown.reduce((s, t) => s + t[key], 0);
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
    region: realValue(c.region) || "—",
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
    start: realValue(c.start) || "—",
    end: realValue(c.end) || "—",
    budget: Number(c.budget) > 0 ? fmtINR(Number(c.budget)) : "To be confirmed",
    budgetNum: Number(c.budget) || 0,
    // Whether a number has been agreed at all, kept separate from budgetNum
    // being 0 — the cards and the KPI strip need to say "not yet" rather than
    // print a zero or quietly drop the campaign out of a total.
    budgetPending: !(Number(c.budget) > 0),
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
