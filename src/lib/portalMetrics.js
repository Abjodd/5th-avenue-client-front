/**
 * src/lib/portalMetrics.js — every number the portal shows, derived in one place.
 *
 * Overview, the Regional Map and the Campaigns board all used to re-aggregate
 * `GET /api/portal/campaigns` themselves, which is how the same brand could be
 * told it had 18 creators on one page and 17 on the next. These functions are
 * the single source: pure, synchronous, no React, no fetching — so they are
 * unit-testable (see portalMetrics.test.js) and cheap to memoise per page.
 *
 * HARD RULE: nothing here invents a value. Every field traces back to a real
 * document field served by the backend's portal allowlist (server.js
 * CREATOR_PUBLIC / CAMPAIGN_PRIVATE). Where the DB has no answer we return
 * null and the UI renders "—" — never a placeholder number. The two derived
 * scores that aren't stored anywhere (`health`, engagement rate) carry their
 * formula in the comment above them and are labelled in the UI.
 */

// Extensions are explicit here (unlike the rest of the app, which relies on
// Vite's resolver) so plain Node can import this module — that's what lets the
// test suite run without a bundler or a test framework.
import { parseFollowers, sizeOf, fmtNum, fmtINR } from "./format.js";
import { PHASES, phaseOf, progressOf } from "./phases.js";
import { stateCode, STATES_META } from "./geo.js";

/* ── Creator status vocabulary ───────────────────────────────────────────────
   Lives here rather than in components/campaigns/mapping.js (which re-exports
   it) because the Overview's filters, the board's "waiting on you" badge and
   the campaign detail view must all agree on what a status means. `t` is the
   client-facing tier rendered by components/StatusPill. */
export const STATUS_MAP = {
  yet_to_pick:      { label: "Yet to Pick",   t: "neutral"  },
  shortlisted:      { label: "Shortlisted",   t: "progress" },
  reached_out:      { label: "Reached Out",   t: "progress" },
  in_negotiation:   { label: "Negotiating",   t: "action"   },
  locked:           { label: "Locked",        t: "done"     },
  dropped:          { label: "Dropped",       t: "dropped"  },
  brand_reject:     { label: "Rejected",      t: "dropped"  },
  finalized:        { label: "Finalised",     t: "progress" },
  briefed:          { label: "Briefed",       t: "progress" },
  concept_received: { label: "Concept In",    t: "action"   },
  concept_approved: { label: "Concept OK",    t: "done"     },
  rework:           { label: "Rework",        t: "progress" },
  pending_brand:    { label: "Pending You",   t: "action"   },
  video_received:   { label: "Video In",      t: "action"   },
  video_approved:   { label: "Video OK",      t: "done"     },
  posted:           { label: "Posted",        t: "done"     },
  tracking:         { label: "Live Tracking", t: "done"     },
};

/** Statuses that mean "this is sitting in the brand's court". */
export const ACTIONABLE_STATUSES = [
  "pending_brand", "in_negotiation", "rework", "concept_received", "video_received",
];

/** A creator's display status: the furthest workflow signal we actually have. */
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

/* ── ENGAGEMENT RATE ─────────────────────────────────────────────────────────
   ER% = reactions left ON the post ÷ views. Forwards are excluded on purpose:
   they're distribution, not engagement, and only Instagram reports them.
   Returns null — not 0 — when it can't be computed, because "we didn't measure
   it" and "nobody engaged" are different answers and only one belongs in front
   of a brand. Matches engagementRate() in the backend's engagement.js. */
export const erOf = (likes, comments, views) =>
  views > 0 && (likes != null || comments != null)
    ? (((likes || 0) + (comments || 0)) / views) * 100
    : null;

/* ── EXTERNAL CPV ────────────────────────────────────────────────────────────
   What the brand paid per measured view: committed budget ÷ views on live
   posts. "External" because it is the client-facing rate — the agency's own
   per-creator cost never leaves the internal app, so this is the only cost per
   view the portal can state truthfully. Null unless both sides are real, so a
   campaign that hasn't gone live shows "—" rather than an infinite rate. */
export const cpvOf = (spend, views) =>
  spend > 0 && views > 0 ? spend / views : null;

/** Numeric-or-null: never coerces a missing metric into a zero. */
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/* ── DELIVERABLES ────────────────────────────────────────────────────────────
   Mirrors lib/campaign.js in 5th-internal-front — the two apps must quote a
   brand the same number of posts, so these three rules are copied deliberately
   rather than re-derived:

     · `campaign.deliverablesPerCreator` is the PLAN, the default each creator
       is briefed with — not a cap.
     · `creator.numDeliverables` overrides the plan for that one creator, so a
       roster where one hero creator does two reels and the rest do one is
       expressible without inventing a second campaign.
     · A creator only owes deliverables once they're LOCKED. Before that
       they're a candidate, and counting a candidate's posts as committed
       inventory is how the client portal's total drifts from the internal one.

   The client portal previously hardcoded `deliverables: "—"` on every creator
   and then summed the digits out of that string, so the campaign's
   "Deliverables" tile read 0 for every campaign ever loaded. */

/** Is this creator locked in? `status` is the negotiation state and stays
    "locked" while concept/demo/live progress independently of it. */
export const isLocked = (cr) => cr?.status === "locked";

/** The campaign-wide plan: posts each creator is briefed for. */
export const perCreatorDeliverables = (campaign) => num(campaign?.deliverablesPerCreator) || 1;

/** What THIS creator owes — their own override, else the campaign plan. */
export const deliverableTarget = (campaign, cr) =>
  num(cr?.numDeliverables) || perCreatorDeliverables(campaign);

/** How many of them are actually live. `live.postUrls` is the real array;
    `postUrl` is the mirrored first link kept for back-compat. */
export const deliverablesPosted = (cr) =>
  cr?.live?.postUrls?.length ?? (cr?.live?.postUrl ? 1 : 0);

/**
 * Total posts the campaign expects. Locked creators contribute their real
 * target; slots not yet filled contribute the plan, so the figure is
 * meaningful from the moment the campaign is created and only sharpens as the
 * roster locks. Never below what the locked creators alone owe — a campaign
 * that over-locked its target still owes every post it committed to.
 */
export function totalDeliverables(campaign) {
  const creators = campaign?.creators || [];
  const locked = creators.filter(isLocked);
  const committed = locked.reduce((s, cr) => s + deliverableTarget(campaign, cr), 0);
  const unfilled = Math.max(0, (num(campaign?.numReq) || 0) - locked.length);
  return committed + unfilled * perCreatorDeliverables(campaign);
}

/** Posts actually live across the campaign, for the "n of N" reading. */
export const postedDeliverables = (campaign) =>
  (campaign?.creators || []).filter(isLocked).reduce((s, cr) => s + deliverablesPosted(cr), 0);
const sum = (rows, pick) => rows.reduce((s, r) => s + (pick(r) || 0), 0);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/* ═══════════════════════════════════════════════════════════════════════════
   CREATORS
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Flatten every campaign's roster into one filterable list of creator rows.
 *
 * Two fixes over the ad-hoc flattening this replaces:
 *  · `language` reads `languages[0]`. The backend's allowlist ships
 *    `languages` (an array) and NOT `language`, so the Overview's Language
 *    filter was reading an undefined field and silently offered no options.
 *  · `er` prefers the MEASURED rate from tracking over the creator's profile
 *    `avgER`, which is only a forecast — so the number moves when the nightly
 *    post-metrics refresh runs, instead of being frozen at signup.
 */
export function flattenCreators(campaigns = []) {
  return campaigns.flatMap((c) =>
    (c.creators || []).map((cr, i) => {
      const followers = parseFollowers(cr.followers);
      const t = cr.tracking || {};
      const views = num(t.views);
      const measuredER = erOf(num(t.likes), num(t.comments), views);
      const statusId = creatorStatus(cr);
      const code = stateCode(cr.state);
      return {
        key: `${c.id}:${cr.handle || cr.name || i}`,
        name: cr.name || "—",
        handle: cr.handle || "",
        platform: cr.platform || "—",
        niche: cr.niche || null,
        followers,
        size: sizeOf(followers),
        language: cr.languages?.[0] || null,
        stateCode: code,
        state: code ? STATES_META[code].name : null,
        region: code ? STATES_META[code].region : null,
        status: statusId,
        statusLabel: STATUS_MAP[statusId].label,
        statusTier: STATUS_MAP[statusId].t,
        waiting: ACTIONABLE_STATUSES.includes(statusId),
        // Profile ER is the fallback only until something is live — that is the
        // one window where a forecast is the best estimate available.
        er: measuredER ?? num(cr.avgER),
        erMeasured: measuredER != null,
        views,
        likes: num(t.likes),
        comments: num(t.comments),
        positivity: num(t.positivityScore),
        lastFetched: t.lastFetched || null,
        live: cr.live?.postUrl ? { url: cr.live.postUrl, postedDate: cr.live.postedDate || null } : null,
        conceptStatus: cr.concept?.status || null,
        demoStatus: cr.demo?.status || null,
        deliverables: num(cr.numDeliverables),
        campaignId: c.id,
        campaignName: c.name,
        campaignService: c.service || "Other",
      };
    }),
  );
}

/** The filter groups offered on Overview. Age and gender are deliberately
    absent: the DB doesn't store them, and an empty dropdown is worse than none. */
export const FILTER_GROUPS = [
  { id: "niche",    label: "Niche"    },
  { id: "size",     label: "Size"     },
  { id: "platform", label: "Platform" },
  { id: "language", label: "Language" },
  { id: "region",   label: "Region"   },
  { id: "status",   label: "Status"   },
];

/** Options for each filter = the values that actually occur in this client's
    roster, so a brand is never offered a filter that returns nothing. */
export function filterOptions(creators) {
  const out = {};
  for (const g of FILTER_GROUPS) {
    const seen = new Map(); // value → label
    for (const cr of creators) {
      const v = cr[g.id];
      if (v == null || v === "" || v === "—") continue;
      seen.set(v, g.id === "status" ? cr.statusLabel : g.id === "region" ? regionLabel(v) : String(v));
    }
    out[g.id] = [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }
  return out;
}

const REGION_LABELS = { north: "North", south: "South", east: "East", west: "West", central: "Central", northeast: "North-East" };
export const regionLabel = (r) => REGION_LABELS[r] || r;

/** Apply a { group: [values] } selection. Empty groups don't constrain. */
export function applyFilters(creators, filters) {
  const active = Object.entries(filters).filter(([, sel]) => sel?.length);
  if (!active.length) return creators;
  return creators.filter((cr) => active.every(([g, sel]) => sel.includes(cr[g])));
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADLINE NUMBERS
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * The KPI strip. `creators` is the FILTERED roster (so the audience figures
 * respond to the filter bar) while campaign counts and committed budget come
 * from the unfiltered campaign list — filtering creators must not make a
 * brand's budget appear to shrink.
 */
export function summarise(campaigns = [], creators = []) {
  const active = campaigns.filter((c) => phaseOf(c.stage) !== "completed");
  const ers = creators.map((cr) => cr.er).filter((v) => v != null && v > 0);
  return {
    campaigns: campaigns.length,
    active: active.length,
    completed: campaigns.length - active.length,
    creators: creators.length,
    live: creators.filter((cr) => cr.live).length,
    followers: sum(creators, (cr) => cr.followers),
    views: sum(creators, (cr) => cr.views),
    avgER: mean(ers),
    budget: sum(campaigns, (c) => num(c.budget)),
    // Campaigns with no budget agreed yet contribute nothing to the total
    // above — correctly, since there is nothing to add — but that makes the
    // total quietly incomplete. Counted so the KPI can say how many campaigns
    // are not in it, rather than presenting a partial figure as the whole.
    budgetPending: campaigns.filter((c) => !(num(c.budget) > 0)).length,
    waiting: creators.filter((cr) => cr.waiting).length,
    states: new Set(creators.map((cr) => cr.stateCode).filter(Boolean)).size,
  };
}

/**
 * Campaign progress, 0–100 — the mean of `progress` across campaigns that aren't
 * completed. It is NOT a stored score and not a proprietary index: `progress`
 * is the number Fifth Avenue sets on each campaign as it moves through the
 * pipeline, and this is its average. The UI states that under the ring.
 * Returns null when there is nothing in flight, so the ring can be hidden
 * rather than reading a meaningless 0%.
 */
export function healthScore(campaigns = []) {
  const live = campaigns.filter((c) => phaseOf(c.stage) !== "completed");
  if (!live.length) return null;
  const progress = live.map(progressOf);
  return { value: Math.round(mean(progress)), of: live.length };
}

/** Campaign count per client-facing phase, in pipeline order. */
export function pipeline(campaigns = []) {
  const counts = Object.fromEntries(PHASES.map((p) => [p.id, 0]));
  campaigns.forEach((c) => { counts[phaseOf(c.stage)] += 1; });
  return PHASES.map((p) => ({ ...p, count: counts[p.id] }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGNALS — "what needs a decision today"
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * The hero's action list. Every row is a real, countable thing with somewhere
 * to go; a row with nothing behind it is omitted rather than rendered as zero.
 * `page`/`params` feed straight into AppShell's setPage().
 */
export function signals(campaigns = [], creators = []) {
  const out = [];

  const approvals = creators.filter((cr) => cr.waiting && cr.demoStatus !== "received");
  if (approvals.length) {
    out.push({
      id: "approvals", icon: "approvals", action: "Review", page: "campaigns",
      params: { campaignId: approvals[0].campaignId },
      count: approvals.length,
      text: `creator approval${approvals.length === 1 ? "" : "s"} awaiting your call`,
    });
  }

  const uploads = creators.filter((cr) => cr.demoStatus === "received" || cr.conceptStatus === "received");
  if (uploads.length) {
    out.push({
      id: "uploads", icon: "uploads", action: "Content", page: "campaigns",
      params: { campaignId: uploads[0].campaignId },
      count: uploads.length,
      text: `new upload${uploads.length === 1 ? "" : "s"} from creators to review`,
    });
  }

  const briefing = campaigns
    .filter((c) => phaseOf(c.stage) === "brief")
    .sort((a, b) => (num(b.budget) || 0) - (num(a.budget) || 0))[0];
  if (briefing) {
    out.push({
      id: "brief", icon: "brief", action: "Brief", page: "campaigns",
      params: { campaignId: briefing.id },
      lead: fmtINR(num(briefing.budget)),
      text: `— ${briefing.name} is entering the pipeline`,
    });
  }

  // Coverage, led by the state carrying the most creators. Deliberately NOT
  // "the newest state" — the payload has no join date on a creator, so any
  // claim about what changed recently would be the array order dressed up as
  // news.
  const byState = groupBy(creators, "state");
  if (byState.length) {
    const top = [...byState].sort((a, b) => b.count - a.count)[0];
    out.push({
      id: "regional", icon: "regional", action: "Map", page: "regional",
      lead: `${byState.length} state${byState.length === 1 ? "" : "s"}`,
      text: `covered — ${top.label} leads with ${top.count} creator${top.count === 1 ? "" : "s"}`,
    });
  }

  // The best-performing follower tier, by measured engagement. Only offered
  // once at least two tiers have ER data — with one tier there is no comparison
  // to draw, and "your only tier is your best tier" is not an insight.
  const tiers = groupBy(creators, "size").filter((g) => g.er != null);
  if (tiers.length > 1) {
    const best = [...tiers].sort((a, b) => b.er - a.er)[0];
    out.push({
      id: "insight", icon: "insight", action: "Insight", anchor: "creators",
      lead: `${best.label} creators`,
      text: `lead on engagement — ${best.er.toFixed(1)}% avg ER`,
    });
  }

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUPED CREATOR PERFORMANCE
   ═════════════════════════════════════════════════════════════════════════ */

/** Group the roster by one of its own fields and aggregate the metrics we can
    actually measure. Groups keep their natural order for tiers, otherwise sort
    by size of group. */
export function groupBy(creators = [], key) {
  const groups = new Map();
  for (const cr of creators) {
    const g = cr[key];
    if (g == null || g === "" || g === "—") continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(cr);
  }
  const rows = [...groups].map(([label, rowsIn]) => {
    const ers = rowsIn.map((cr) => cr.er).filter((v) => v != null && v > 0);
    const views = rowsIn.map((cr) => cr.views).filter((v) => v != null);
    return {
      label: key === "region" ? regionLabel(label) : String(label),
      value: label,
      count: rowsIn.length,
      followers: sum(rowsIn, (cr) => cr.followers),
      er: mean(ers),
      views: views.length ? views.reduce((a, b) => a + b, 0) : null,
      live: rowsIn.filter((cr) => cr.live).length,
    };
  });
  return key === "size" ? sortTiers(rows) : rows.sort((a, b) => b.count - a.count);
}

const TIER_ORDER = ["Nano", "Micro", "Macro", "Mega"];
const sortTiers = (rows) => rows.sort((a, b) => TIER_ORDER.indexOf(a.value) - TIER_ORDER.indexOf(b.value));

/**
 * Metrics a grouped view can be switched between. `available` keeps a metric
 * out of the switcher until the data behind it exists — the reference design's
 * CPV tab is absent for exactly this reason: per-creator cost isn't exposed to
 * the portal, so a cost-per-view column could only ever be made up.
 */
export const GROUP_METRICS = [
  { id: "er",        label: "ER",        pick: (g) => g.er,        format: (v) => `${v.toFixed(1)}%`, hint: "avg engagement rate" },
  { id: "followers", label: "Reach",     pick: (g) => g.followers, format: fmtNum,                    hint: "combined audience" },
  { id: "views",     label: "Views",     pick: (g) => g.views,     format: fmtNum,                    hint: "measured views on live posts" },
  { id: "count",     label: "Creators",  pick: (g) => g.count,     format: (v) => String(Math.round(v)), hint: "creators in the group" },
];

export const availableMetrics = (rows) =>
  GROUP_METRICS.filter((m) => rows.some((g) => m.pick(g) != null && m.pick(g) > 0));

/** ±1.3σ outlier flag, matching the badge the reference design puts on a tier
    that behaves unlike the rest. null when the spread is too small to call. */
export function flagOutliers(rows, pick) {
  const values = rows.map(pick).filter((v) => v != null);
  if (values.length < 3) return rows.map(() => null);
  const avg = mean(values);
  const sd = Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
  if (!sd) return rows.map(() => null);
  return rows.map((r) => {
    const v = pick(r);
    if (v == null) return null;
    const z = (v - avg) / sd;
    return z > 1.3 ? "high" : z < -1.3 ? "low" : null;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMPAIGNS
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * "Where the plan is working" — campaigns grouped by the service delivering
 * them, which is the closest thing the DB has to the reference design's
 * cross-campaign goals. Progress is budget-weighted: a ₹12L campaign at 60%
 * should move the group more than a ₹1L one at 100%.
 */
export function serviceGroups(campaigns = [], creators = []) {
  const groups = new Map();
  for (const c of campaigns) {
    const svc = (c.service || "Other").trim();
    if (!groups.has(svc)) groups.set(svc, []);
    groups.get(svc).push(c);
  }
  return [...groups]
    .map(([service, rows]) => {
      const budget = sum(rows, (c) => num(c.budget));
      const weighted = rows.reduce((s, c) => s + progressOf(c) * (num(c.budget) || 1), 0);
      const weights = rows.reduce((s, c) => s + (num(c.budget) || 1), 0);
      const ids = new Set(rows.map((c) => c.id));
      const roster = creators.filter((cr) => ids.has(cr.campaignId));
      const starts = rows.map((c) => c.start).filter(Boolean).sort();
      const ends = rows.map((c) => c.end).filter(Boolean).sort();
      return {
        service,
        campaigns: rows.length,
        active: rows.filter((c) => phaseOf(c.stage) !== "completed").length,
        progress: weights ? Math.round(weighted / weights) : 0,
        budget,
        reach: sum(roster, (cr) => cr.followers),
        creators: roster.length,
        from: starts[0] || null,
        to: ends[ends.length - 1] || null,
        regions: [...new Set(rows.map((c) => c.region).filter((r) => r && r !== "—"))],
      };
    })
    .sort((a, b) => b.budget - a.budget);
}

/** Campaigns ranked by the audience they reach, for the podium. */
export function rankCampaigns(campaigns = [], creators = []) {
  return campaigns
    .map((c) => {
      const roster = creators.filter((cr) => cr.campaignId === c.id);
      const ers = roster.map((cr) => cr.er).filter((v) => v != null && v > 0);
      return {
        id: c.id,
        name: c.name,
        reach: sum(roster, (cr) => cr.followers),
        er: mean(ers),
        creators: roster.length,
      };
    })
    .filter((c) => c.reach > 0)
    .sort((a, b) => b.reach - a.reach);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTENT + ACTIVITY
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Per-platform content performance, over creators whose posts are LIVE and
 * measured. Anything without tracking is excluded rather than plotted at zero,
 * so the bubble chart never implies a platform underperformed when the truth
 * is that nobody has refreshed its metrics yet.
 */
export function platformPerformance(creators = []) {
  const measured = creators.filter((cr) => cr.live && cr.views > 0);
  return groupBy(measured, "platform").map((g) => ({
    ...g,
    avgViews: Math.round(g.views / g.count),
  }));
}

/** The live posts themselves, best-engaging first — the honest stand-in for a
    "topic performance" table, since the DB stores no topic or format on a post. */
export function livePosts(creators = []) {
  return creators
    .filter((cr) => cr.live)
    .map((cr) => ({
      key: cr.key, name: cr.name, handle: cr.handle, campaignName: cr.campaignName,
      platform: cr.platform, url: cr.live.url, postedDate: cr.live.postedDate,
      views: cr.views, er: cr.erMeasured ? cr.er : null, positivity: cr.positivity,
    }))
    .sort((a, b) => (b.er ?? -1) - (a.er ?? -1) || (b.views ?? 0) - (a.views ?? 0));
}

/**
 * Recent activity — built only from fields that carry a real date:
 * `live.postedDate` (a creator went live), `tracking.lastFetched` (metrics
 * refreshed) and the campaign's own `start`/`end`. Undated workflow moves
 * (a concept arriving, a brief being locked) are deliberately left out: the
 * portal payload has no timestamp for them, and a feed that guesses when
 * things happened is worse than a shorter one that doesn't.
 */
export function activityFeed(campaigns = [], creators = [], limit = 6) {
  const today = new Date();
  const items = [];

  for (const cr of creators) {
    if (cr.live?.postedDate) {
      items.push({
        id: `live:${cr.key}`, kind: "live", at: cr.live.postedDate,
        title: `${cr.name} went live`, meta: cr.campaignName,
        campaignId: cr.campaignId,
      });
    }
    if (cr.lastFetched && cr.views != null) {
      items.push({
        id: `metrics:${cr.key}`, kind: "metrics", at: cr.lastFetched,
        title: `${cr.name} — ${fmtNum(cr.views)} views recorded`, meta: cr.campaignName,
        campaignId: cr.campaignId,
      });
    }
  }

  for (const c of campaigns) {
    const phase = phaseOf(c.stage);
    if (c.start) items.push({ id: `start:${c.id}`, kind: "start", at: c.start, title: `${c.name} started`, meta: c.service || "—", campaignId: c.id });
    if (c.end && phase === "completed") items.push({ id: `end:${c.id}`, kind: "end", at: c.end, title: `${c.name} wrapped`, meta: c.service || "—", campaignId: c.id });
  }

  return items
    .map((it) => ({ ...it, ts: Date.parse(it.at) }))
    .filter((it) => Number.isFinite(it.ts) && it.ts <= +today)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

/** Campaigns with creators sitting in the brand's court, biggest queue first. */
export function needsYou(campaigns = [], creators = []) {
  const byCampaign = new Map();
  for (const cr of creators) {
    if (!cr.waiting) continue;
    if (!byCampaign.has(cr.campaignId)) byCampaign.set(cr.campaignId, []);
    byCampaign.get(cr.campaignId).push(cr);
  }
  return [...byCampaign]
    .map(([campaignId, rows]) => ({
      campaignId,
      campaignName: rows[0].campaignName,
      count: rows.length,
      lead: rows[0],
    }))
    .sort((a, b) => b.count - a.count);
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGIONAL
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Everything the Regional Map renders, in one pass over the roster: per-state
 * and per-region totals, the language split, and per-campaign geography so the
 * drill panel can list exactly who a campaign has where.
 */
export function regionalRollup(campaigns = [], creators = []) {
  const states = {};
  const langs = {};
  const byCampaign = new Map(
    campaigns.map((c) => [c.id, {
      id: c.id, name: c.name, service: c.service || "—", phase: phaseOf(c.stage),
      progress: progressOf(c), budget: num(c.budget),
      states: new Set(), regions: new Set(), creators: [],
    }]),
  );

  let unplaced = 0;
  for (const cr of creators) {
    if (!cr.stateCode) { unplaced += 1; continue; }
    const s = (states[cr.stateCode] ||= { campaigns: new Set(), creators: 0, followers: 0, views: 0 });
    s.campaigns.add(cr.campaignId);
    s.creators += 1;
    s.followers += cr.followers;
    s.views += cr.views || 0;

    const camp = byCampaign.get(cr.campaignId);
    if (camp) {
      camp.states.add(cr.stateCode);
      camp.regions.add(cr.region);
      camp.creators.push(cr);
    }

    // The creator's own answer when we have it; otherwise the primary language
    // of their state, which is a reasonable guess but only a guess.
    const lang = cr.language || STATES_META[cr.stateCode].lang;
    const l = (langs[lang] ||= { campaigns: new Set(), creators: 0, followers: 0 });
    l.campaigns.add(cr.campaignId);
    l.creators += 1;
    l.followers += cr.followers;
  }

  const stateData = Object.fromEntries(
    Object.keys(STATES_META).map((code) => {
      const s = states[code];
      return [code, s
        ? { campaigns: s.campaigns.size, creators: s.creators, followers: s.followers, views: s.views }
        : { campaigns: 0, creators: 0, followers: 0, views: 0 }];
    }),
  );

  const regionData = {};
  for (const [code, d] of Object.entries(stateData)) {
    const r = STATES_META[code].region;
    const acc = (regionData[r] ||= { campaigns: new Set(), creators: 0, followers: 0 });
    if (states[code]) states[code].campaigns.forEach((id) => acc.campaigns.add(id));
    acc.creators += d.creators;
    acc.followers += d.followers;
  }
  for (const r of Object.keys(regionData)) {
    regionData[r] = { campaigns: regionData[r].campaigns.size, creators: regionData[r].creators, followers: regionData[r].followers };
  }

  const langData = Object.fromEntries(
    Object.entries(langs).map(([l, v]) => [l, { campaigns: v.campaigns.size, creators: v.creators, followers: v.followers }]),
  );

  return {
    stateData,
    regionData,
    langData,
    campaigns: [...byCampaign.values()],
    unplaced,
    totals: {
      campaigns: new Set(creators.filter((cr) => cr.stateCode).map((cr) => cr.campaignId)).size,
      creators: creators.filter((cr) => cr.stateCode).length,
      followers: sum(creators.filter((cr) => cr.stateCode), (cr) => cr.followers),
      budget: sum(campaigns, (c) => num(c.budget)),
      states: Object.values(stateData).filter((d) => d.creators > 0).length,
      regions: Object.values(regionData).filter((d) => d.creators > 0).length,
      languages: Object.keys(langData).length,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COPY
   ═════════════════════════════════════════════════════════════════════════ */

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const longDate = (date = new Date()) =>
  date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

/**
 * The hero paragraph. Built by joining only the clauses we have data for, so a
 * brand with one quiet campaign gets a short honest sentence rather than a
 * template with holes in it.
 */
export function heroSummary({ kpis, health, signalRows, date = new Date() }) {
  const parts = [`It's ${longDate(date)}.`];
  if (health) parts.push(`Campaign progress is at ${health.value}%, averaged across ${health.of} active campaign${health.of === 1 ? "" : "s"}.`);
  if (signalRows.length) {
    parts.push(`${signalRows.length} signal${signalRows.length === 1 ? "" : "s"} need${signalRows.length === 1 ? "s" : ""} a decision today.`);
  } else {
    parts.push("Nothing is waiting on you right now.");
  }
  if (kpis.creators) parts.push(`${kpis.creators} creator${kpis.creators === 1 ? "" : "s"} are carrying ${fmtNum(kpis.followers)} combined audience.`);
  return parts.join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE-POST GROWTH
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Shared basis for both growth views.
 *
 * Each creator's `tracking.history[]` is a CUMULATIVE series (total views so
 * far), sampled whenever that creator's post happened to be refreshed.
 * Different creators are therefore sampled at different moments, and a creator
 * with no reading on a given day has not dropped to zero — they simply weren't
 * measured. Summing only the points that exist on each day would make the
 * campaign total lurch up and down purely with the refresh schedule, inventing
 * collapses that never happened.
 *
 * So each creator's last known value is carried forward across days they have
 * no reading. That makes every series monotonic, which a cumulative metric
 * must be. Both growthSeries() and growthByCreator() are built on this, so the
 * combined line and the per-creator lines can never disagree.
 */
/** Every calendar day from `from` to `to` inclusive, as YYYY-MM-DD.
    UTC throughout, since the day keys are the UTC date of each reading and
    stepping in local time would drop or repeat a day across a DST edge.
    Returns null on an implausible span, so one corrupt `at` can't expand a
    campaign's chart into thousands of points. */
function calendarDays(from, to) {
  const end = Date.parse(`${to}T00:00:00Z`);
  const start = Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > 370 * 86400000) return null;
  const out = [];
  for (let t = start; t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function carriedByDay(creators = []) {
  const tracked = creators
    .map((cr, i) => ({
      name: cr.name || `Creator ${i + 1}`,
      // Set only by growthAcross, which spans campaigns and therefore has to
      // say which one a post belongs to. Within one campaign it is redundant.
      campaign: cr.campaignName || null,
      points: cr.tracking?.history,
    }))
    .filter((c) => Array.isArray(c.points) && c.points.length);
  if (!tracked.length) return null;

  const dayOf = (iso) => String(iso).slice(0, 10);

  // Per creator: the last reading recorded on each day (a day may hold several
  // refreshes; the last one is that day's standing total).
  // A field absent from a reading means that refresh didn't report it, NOT
  // that the count dropped to zero — the same distinction the day-level carry
  // forward makes, one level down. Readings do come back partial: a post that
  // had reported forwards on five straight refreshes returned `forwards: null`
  // on the sixth, and scoring that as 0 took its whole share count off the
  // campaign, so cumulative engagements FELL between two days. A total that
  // can only climb must never do that. `??` and not `||`, so a genuine zero
  // still reads as zero.
  const FIELDS = ["views", "likes", "comments", "forwards"];
  const byDay = tracked.map(({ points }) => {
    const m = new Map();
    let running = null;
    for (const p of [...points].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
      running = Object.fromEntries(FIELDS.map((f) => [f, p?.[f] ?? running?.[f] ?? null]));
      m.set(dayOf(p.at), running);
    }
    return m;
  });

  const observed = [...new Set(byDay.flatMap((m) => [...m.keys()]))].sort();
  if (observed.length < 2) return null;

  // The x-axis is a calendar, not a list of refresh events. Plotting only the
  // days that happen to hold a reading drew a four-day stretch (Aug 13 → 17,
  // when the refresh didn't run) at the same width as the one-day step after
  // it, so the curve's slope described the refresh schedule rather than the
  // campaign. Filling the gaps costs nothing: an unmeasured day takes the same
  // carry-forward the sampled days already use.
  //
  // Only the INTERIOR is filled. Past the last reading the total is genuinely
  // unknown, and running a flat line out to today would assert that nothing
  // has happened since — the gap at the right-hand end is the honest signal
  // that the data has gone stale.
  const days = calendarDays(observed[0], observed[observed.length - 1]) || observed;

  // days × creators, already carried forward. null = this creator had not been
  // measured yet on that day, which is NOT the same as zero and is left out
  // rather than plotted.
  const carried = byDay.map(() => null);
  const grid = days.map((day) =>
    byDay.map((m, i) => {
      if (m.has(day)) carried[i] = m.get(day);
      return carried[i];
    }),
  );

  return { posts: tracked.map((t) => ({ name: t.name, campaign: t.campaign })), days, grid };
}

const metricsOf = (p) => {
  const likes = Number(p?.likes) || 0;
  const comments = Number(p?.comments) || 0;
  const forwards = Number(p?.forwards) || 0;
  return {
    views: Number(p?.views) || 0,
    likes, comments, forwards,
    engagements: likes + comments + forwards,
  };
};

/**
 * Campaign-level growth: one row per day, every creator summed.
 * Returns [] when there is less than two days of readings — a growth chart
 * needs at least two points, and the caller hides the tab rather than drawing
 * a single dot.
 */
export function growthSeries(creators = []) {
  const basis = carriedByDay(creators);
  if (!basis) return [];
  return basis.days.map((date, d) => {
    const totals = { views: 0, likes: 0, comments: 0, forwards: 0, engagements: 0 };
    for (const p of basis.grid[d]) {
      if (!p) continue;
      const m = metricsOf(p);
      for (const k of Object.keys(totals)) totals[k] += m[k];
    }
    return { date, ...totals };
  });
}

/**
 * The same growth, split per creator — so a campaign running two creators
 * shows whose post is actually carrying it rather than one blended line that
 * hides a strong post next to a flat one.
 *
 * Wide format, because that is what a multi-series chart consumes: one row per
 * day, one KEY per creator. Keys are positional (`c0`, `c1`, …) rather than
 * names — two creators can share a display name, and a duplicate data key
 * would silently collapse two lines into one.
 *
 * Returns { rows: [], series: [] } below two days of readings, matching
 * growthSeries so callers can gate on either.
 */
export function growthByCreator(creators = []) {
  const basis = carriedByDay(creators);
  if (!basis) return { rows: [], series: [] };

  const series = basis.posts.map(({ name, campaign }, i) => ({ key: `c${i}`, name, campaign }));
  const rows = basis.days.map((date, d) => {
    const row = { date };
    basis.grid[d].forEach((p, i) => {
      // Left undefined (not 0) before a creator's first reading, so the line
      // starts where they were first measured instead of climbing off a
      // baseline they never sat at.
      if (!p) return;
      const m = metricsOf(p);
      row[`${series[i].key}_views`] = m.views;
      row[`${series[i].key}_engagements`] = m.engagements;
    });
    return row;
  });
  return { rows, series };
}

/**
 * Account-level growth: every tracked post the brand has, across campaigns, as
 * one cumulative series for the Overview page.
 *
 * Built by flattening the rosters and handing them to growthSeries() rather
 * than by summing each campaign's own series — same reason growthSeries and
 * growthByCreator share carriedByDay(). Carrying a value forward has to happen
 * per CREATOR, before anything is added up: summing per-campaign series would
 * carry forward at the campaign level and double-count a campaign whose second
 * creator was first measured on a later day. One basis, one answer.
 *
 * `campaigns` comes straight from GET /api/portal/campaigns, which already
 * excludes deleted campaigns — so there is nothing to filter out here.
 *
 * Returns points: [] below two days of readings, plus the counts either way, so
 * the empty state can still say how much is being tracked.
 */
export function growthAcross(campaigns = []) {
  const hasHistory = (cr) => cr?.tracking?.history?.length;
  // Tagged with their campaign so the account-level breakdown can name both
  // the post and the work it belongs to.
  const creators = campaigns.flatMap((c) =>
    (c.creators || []).map((cr) => ({ ...cr, campaignName: c.name })),
  );
  return {
    points: growthSeries(creators),
    // The same carried-forward basis as `points`, split per post — so a
    // breakdown can never add up to something other than the curve above it.
    byPost: growthByCreator(creators),
    creators: creators.filter(hasHistory).length,
    campaigns: campaigns.filter((c) => (c.creators || []).some(hasHistory)).length,
  };
}
