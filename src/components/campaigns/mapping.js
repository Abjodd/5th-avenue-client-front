// src/components/campaigns/mapping.js — DB → VIEW mapping for the Campaigns page.
// Campaigns come from GET /api/portal/campaigns (see lib/api.js) in the backend's
// shape; these helpers convert them into what the page renders. Anything the DB
// doesn't store yet renders as "—" / hidden rather than being invented.

import { parseFollowers, sizeOf, fmtNum, fmtINR, initials } from "../../lib/format.js";
import { STATES_META, stateCode } from "../../lib/geo.js";
// Both from the phase registry itself. lib/api re-exports phaseOf for callers
// that already imported it there, but taking one of the pair from each module
// would leave two import paths for one registry.
import { campaignPhaseOf, progressOf, deliveryProgressOf, briefLockedOf } from "../../lib/phases.js";
import {
  STATUS_MAP, ACTIONABLE_STATUSES, DECIDABLE_STATUSES, creatorStatus, erOf, cpvOf,
  isLocked, deliverableTarget, deliverablesPosted, totalDeliverables, postedDeliverables,
  growthSeries, growthByCreator,
} from "../../lib/portalMetrics.js";

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

/* "TBD" is not a value — it is the internal create wizard's placeholder for a
   field nobody filled in (`region: f.region || "TBD"`, `end: f.timelineEnd ||
   "TBD"` in 5th-internal-front Campaigns/index.jsx). It leaked straight onto the
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
   5th-internal-front Campaigns/index.jsx; `locked` is internal for "signed off,
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

/* A note on an asset. Written from both sides — the portal appends the brand's,
   the internal app appends replies — so `fromClient` decides which side of the
   conversation it renders on. Anything without a body is dropped: an empty
   bubble is not a comment. */
export const toAssetComments = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .map((c, i) => ({
      id: c?.id || `c${i}`,
      body: String(c?.body ?? "").trim(),
      at: c?.at || null,
      author: String(c?.author || "").trim() || (c?.role === "client" ? "You" : "5th Avenue"),
      fromClient: c?.role === "client",
    }))
    .filter((c) => c.body);

/* A reviewable asset: its state, its file, and the thread on it. */
const reviewView = (a) => ({ ...assetView(a), comments: toAssetComments(a?.comments) });

/* How the post goes up: a paid collaboration (co-authored, so it carries the
   brand's own handle) or on the creator's account alone. Set on the internal
   Creators tab, where it is a precondition of locking — the fee is committed at
   the lock, and a collab type agreed afterwards is a question the brand was
   never asked. Which is why it belongs here: by the time a creator is locked,
   this is a term of the deal the brand is paying for.

   Null while nobody has decided yet, and the row renders nothing rather than a
   dash — same rule as the rest of this module, an unanswered question is not a
   value. Labels mirror COLLAB_TYPES in 5th-internal-front Campaigns/index.jsx. */
const COLLAB_LABELS = { collab: "Collab", non_collab: "Non-Collab" };

/* The brand's answer, read off the roster status rather than off the audit
   record beside it — a status the TEAM set by hand has to read here exactly
   like one the brand set from this page, which is the whole point of both
   sides writing the same field. `brandDecision` only says who made the call,
   for the row to name them back. */
const DECISION_OF = { shortlisted: "approve", brand_reject: "reject" };

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
    // What this creator cost on this campaign — the figure the Budget card
    // breaks the total down by on hover.
    //
    // It is NOT the agency's internal fee, which stays inside the internal app
    // and is not on the wire at all. The backend maps the internal
    // `clientCost` onto this key on the way out (5th-internal-back server.js,
    // withClientCost), so `cost` here means, and only means, what the brand was
    // charged for this creator.
    //
    // Null when the key is absent — a creator who hasn't been priced for the
    // client yet. The breakdown leaves them out rather than listing them at ₹0,
    // which would read as a creator working for nothing.
    cost: numOrNull(cr.cost),
    collab: COLLAB_LABELS[cr.collab] || null,
    size: sizeOf(followers),
    region: STATES_META[stateCode(cr.state)]?.name || cr.state || "—",
    language: cr.languages?.length ? cr.languages.join(", ") : cr.language || "—",
    avatar: initials(cr.name),
    /* Both are reviewable, so both carry a thread. Named `conceptAsset`, not
       `briefAsset`: this is `cr.concept` on the wire and "Concept" on the
       internal Deliverables tab, while "Brief" on this page already means the
       campaign brief in its own tab. One name for one thing. */
    conceptAsset: reviewView(cr.concept),
    demoAsset: reviewView(cr.demo),
    // Opaque handle on this roster row, minted internally and renamed on the
    // wire (server.js withRosterRef). The only thing that can address a
    // comment at the right creator; null on a legacy payload, and the review
    // panel goes read-only without it.
    ref: cr.ref || null,
    live: cr.live?.postUrl ? { postUrl: cr.live.postUrl, postedDate: cr.live.postedDate || null } : null,
    tracking: hasTracking ? tracking : null,
    /* The brand's call on taking this creator on: the answer, whether it is
       still theirs to change, and who gave it. Replaces a mock `approval`
       object of exec/mgmt ticks that lived in component state and was never
       sent anywhere — the brand could press it and nothing happened. */
    decision: DECISION_OF[cr.status] || null,
    decidable: DECIDABLE_STATUSES.includes(cr.status),
    // Named only while the stored answer still matches the status. A brand
    // that approved someone the team later turned down must not be told they
    // passed on them — once the two disagree, the record is history and the
    // row says what happened without putting a name to it.
    decidedBy: cr.brandDecision?.decision && cr.brandDecision.decision === DECISION_OF[cr.status]
      ? (cr.brandDecision.by || null) : null,
  };
}

/* A brief field the internal app stored as a LIST rather than a line.
   `deliverables` arrives as ["Reel — Collab", "Reel — Non-Collab"] on every
   campaign, and React renders an array of strings by concatenating them with
   nothing between — so the brand's own brief read "Reel — CollabReel —
   Non-Collab". Applied to every text field, not just that one: they share a
   shape on the internal side, so any of them can arrive as a list. */
const briefText = (v) =>
  Array.isArray(v)
    // Drop nullish BEFORE stringifying: String(null) is "null", which is
    // truthy and would have been printed to the brand as a list item.
    ? v.filter((x) => x != null).map((x) => String(x).trim()).filter(Boolean).join(" · ")
    : (v || "");

export function toViewCampaign(c) {
  const phase = campaignPhaseOf(c);
  const creators = (c.creators || []).map(cr => toViewCreator(cr, c));
  const brief = c.brief && typeof c.brief === "object" ? c.brief : null;
  const briefLocked = briefLockedOf(c);
  const briefView = brief ? {
    objective: briefText(brief.objective), targetAudience: briefText(brief.audience),
    keyMessages: briefText(brief.messages), deliverables: briefText(brief.deliverables),
    // "To be confirmed", not "—". A campaign can be raised in the internal app
    // before the brand has agreed a number (5th-internal-front lib/campaign.js
    // hasBudget), and this is the brand's OWN brief — an em dash reads as a
    // figure we're withholding, when the truth is that it hasn't been set yet
    // and they are the ones who set it.
    budget: brief.budget || (Number(c.budget) > 0 ? fmtINR(Number(c.budget)) : "To be confirmed"),
    timeline: briefText(brief.timeline),
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

  /* Campaign ER off the campaign's own totals — NOT the mean of the per-creator
     rates, which weights a creator with 2k views the same as one with 2m.

     No profile-`avgER` fallback any more. It used to stand in before the first
     post, which is exactly where it did the damage: a campaign still in brief
     printed "Avg ER 545.2%" off one creator's stored forecast. A campaign with
     nothing live now reads "—". See the LIVE block in lib/portalMetrics.js. */
  const avgER = fmtER(erOf(trackTotals.likes, trackTotals.comments, trackTotals.views));
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
    // The STAGE's own number, matching the ring and chip on the internal board
    // for the same campaign. `delivery` is the other track, carried separately
    // rather than folded in — see deliveryProgressOf in lib/phases.js for why a
    // campaign is allowed to read 16 here and 82 there.
    progress: progressOf(c),
    delivery: deliveryProgressOf(c),
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
    // The agency's fee, charged on top of the campaign budget and already
    // included in `budget` above — so it is a LINE of the total, never an
    // addition to it. The internal app resolves it on the campaign
    // (5th-internal-front lib/campaign.js agencyFeeOf); the rate it was agreed
    // at is deliberately not on the wire.
    agencyFee: Number(c.agencyFee) > 0 ? Number(c.agencyFee) : null,
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
    // Is anything actually posted? Gates every performance figure the board and
    // the detail view show for this campaign.
    live: creators.some(cr => cr.live),
    waiting: creators.filter(cr => ACTIONABLE_STATUSES.includes(cr.status)).length,
    trackTotals: hasTrackTotals ? trackTotals : null,
    growth,
    growthPerCreator,
    avgPositivity,
    lastFetched,
    // Same list-or-string guard as briefView: this is the card's one-line
    // summary of the objective, and an array here would concatenate exactly
    // the way `deliverables` did on the brief tab.
    brief: briefText(brief?.objective),
    lockedBrief: briefLocked ? briefView : null,
    pendingBrief: !briefLocked ? briefView : null,
    status: phase === "completed" ? "done" : "active",
    creators,
    topAssets: [],
  };
}
