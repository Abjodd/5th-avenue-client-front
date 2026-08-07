// src/components/campaigns/mapping.js — DB → VIEW mapping for the Campaigns page.
// Campaigns come from GET /api/portal/campaigns (see lib/api.js) in the backend's
// shape; these helpers convert them into what the page renders. Anything the DB
// doesn't store yet renders as "—" / hidden rather than being invented.

import { phaseOf } from "../../lib/api";
import { parseFollowers, sizeOf, fmtNum, fmtINR, initials } from "../../lib/format";
import { STATES_META, stateCode } from "../../lib/geo";
import { PHASES } from "../../lib/phases";

// Every status maps to a client-facing tier (components/StatusPill TIERS):
// action = waiting on you · progress = agency at work · done · dropped.
export const STATUS_MAP = {yet_to_pick:{label:"Yet to Pick",t:"neutral"},shortlisted:{label:"Shortlisted",t:"progress"},reached_out:{label:"Reached Out",t:"progress"},in_negotiation:{label:"Negotiating",t:"action"},locked:{label:"Locked",t:"done"},dropped:{label:"Dropped",t:"dropped"},brand_reject:{label:"Rejected",t:"dropped"},finalized:{label:"Finalised",t:"progress"},briefed:{label:"Briefed",t:"progress"},concept_received:{label:"Concept In",t:"action"},concept_approved:{label:"Concept OK",t:"done"},rework:{label:"Rework",t:"progress"},pending_brand:{label:"Pending You",t:"action"},video_received:{label:"Video In",t:"action"},video_approved:{label:"Video OK",t:"done"},posted:{label:"Posted",t:"done"},tracking:{label:"Live Tracking",t:"done"}};

/* Creator statuses that mean "waiting on the client" — shared by the board
   badge and the DetailPanel review strip so the numbers always agree. */
export const ACTIONABLE_STATUSES = ["pending_brand","in_negotiation","rework","concept_received","video_received"];

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

// A creator's display status: prefer the furthest workflow signal we have.
export function creatorStatus(cr) {
  if (cr.live?.postUrl) return "posted";
  if (cr.demo?.status === "approved") return "video_approved";
  if (cr.demo?.status === "rework") return "rework";
  if (cr.demo?.status === "received") return "video_received";
  if (cr.concept?.status === "approved") return "concept_approved";
  if (cr.concept?.status === "received") return "concept_received";
  if (cr.status === "reached_out" || cr.status === "negotiating") return "in_negotiation";
  return STATUS_MAP[cr.status] ? cr.status : "yet_to_pick";
}

/* Numeric-or-null: never invents a value for missing tracking data */
const numOrNull = (v) => (v == null || v === "" ? null : Number(v) || null);

/* ── ENGAGEMENT RATE ────────────────────────────────────────────────────────
   ER% = reactions the audience left ON the post ÷ views. Forwards are excluded
   deliberately — they're distribution, not engagement, and only Instagram
   reports them, so including them made IG creators look better than YouTube
   ones for identical performance. Same formula the internal app's Deliverables
   tab shows, so the two apps never quote the brand different numbers.

   MEASURED data wins. `avgER` is the creator's PROFILE rate — what their
   account averages, captured when their handle was looked up — so it's a
   forecast, and for a roster typed in by hand it was never captured at all.
   That's why campaigns like Pronto showed "—" here permanently and never
   refreshed: nothing recomputed it, because it wasn't derived from anything.
   Now it is: every nightly post-metrics refresh moves this number.

   Profile ER stays as the fallback for the window before anything is live,
   which is the only time it's the best estimate available.

   Returns null (not 0) when it can't be computed — "we didn't measure the
   reactions" and "nobody engaged" are different answers, and only one of them
   belongs in front of a brand. Matches engagementRate() in the backend's
   engagement.js. */
export const erOf = (likes, comments, views) =>
  views > 0 && (likes != null || comments != null)
    ? (((likes || 0) + (comments || 0)) / views) * 100
    : null;
const fmtER = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);

export function toViewCreator(cr) {
  const followers = parseFollowers(cr.followers);
  const tracking = cr.tracking && typeof cr.tracking === "object" ? {
    views: numOrNull(cr.tracking.views),
    likes: numOrNull(cr.tracking.likes),
    comments: numOrNull(cr.tracking.comments),
    forwards: numOrNull(cr.tracking.forwards),
    commentAnalysis: cr.tracking.commentAnalysis || null,
    positivityScore: numOrNull(cr.tracking.positivityScore),
    lastFetched: cr.tracking.lastFetched || null,
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
    deliverables: "—", // not tracked per-creator in the DB yet
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
  const creators = (c.creators || []).map(toViewCreator);
  const brief = c.brief && typeof c.brief === "object" ? c.brief : null;
  const briefLocked = c.briefStatus === "locked";
  const briefView = brief ? {
    objective: brief.objective || "", targetAudience: brief.audience || "",
    keyMessages: brief.messages || "", deliverables: brief.deliverables || "",
    budget: brief.budget || fmtINR(Number(c.budget) || null), timeline: brief.timeline || "",
    vars: Object.fromEntries(["objective","targetAudience","keyMessages","deliverables","budget","timeline"]
      .map(k => [k, briefLocked ? "approved" : "pending"])),
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

  return {
    id: c.id,
    name: c.name,
    service: c.service || "Influencer Marketing",
    region: c.region || "—",
    phase,
    progress: Number(c.progress) || Math.round((PHASES.findIndex(p => p.id === phase) / (PHASES.length - 1)) * 100),
    engagement: avgER,
    engRate: avgER,
    views: views ? fmtNum(views) : "—",
    start: c.start || "—",
    end: c.end || "—",
    budget: fmtINR(Number(c.budget) || null),
    budgetNum: Number(c.budget) || 0,
    numReq: Number(c.numReq) || null,
    lockedCount: (c.creators || []).filter(cr => cr.status === "locked").length,
    liveCount: creators.filter(cr => cr.live).length,
    waiting: creators.filter(cr => ACTIONABLE_STATUSES.includes(cr.status)).length,
    trackTotals: hasTrackTotals ? trackTotals : null,
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
