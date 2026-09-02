/**
 * Unit tests for lib/portalMetrics.js — `npm test` (node:test, no runner dep).
 *
 * The fixture below is deliberately shaped like a REAL portal payload, not a
 * convenient one: followers arrive as "820K" / 95000 / undefined, one creator
 * has no state, one campaign has no creators at all, and only one post is live
 * with tracking. Those are the cases that produced the wrong numbers before
 * this module existed, so they're the ones worth pinning.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  flattenCreators, filterOptions, applyFilters, summarise, healthScore,
  pipeline, signals, groupBy, availableMetrics, flagOutliers, serviceGroups,
  rankCampaigns, platformPerformance, livePosts, activityFeed, needsYou,
  regionalRollup, erOf, creatorStatus, greeting, heroSummary,
  isLocked, perCreatorDeliverables, deliverableTarget, deliverablesPosted,
  totalDeliverables, postedDeliverables, budgetLines, countsInMetrics,
} from "./portalMetrics.js";

/* ── Fixture ─────────────────────────────────────────────────────────────── */

const CAMPAIGNS = [
  {
    id: "c1", name: "Diwali Festive Push", client: "FreshBite Foods",
    service: "Influencer Marketing", region: "South India",
    stage: "execution", progress: 62, budget: 1250000, start: "2026-03-01", end: "2026-04-30",
    creators: [
      { // live + tracked → measured ER wins over the profile avgER
        name: "Anjali Kitchen", handle: "@anjalikitchen", platform: "Instagram",
        niche: "Cooking", followers: "820K", avgER: 4.2, state: "Karnataka",
        languages: ["Kannada"], status: "locked",
        concept: { status: "approved" }, demo: { status: "locked" },
        live: { postUrl: "https://instagram.com/p/abc1", postedDate: "2026-04-12" },
        tracking: { views: 480000, likes: 21000, comments: 980, positivityScore: 88, lastFetched: "2026-05-02" },
      },
      { // concept in → waiting on the brand
        name: "South Foodie", handle: "@southfoodie", platform: "YouTube",
        niche: "Food", followers: "1.2M", avgER: 5.1, state: "Tamil Nadu",
        languages: ["Tamil"], status: "negotiating",
        concept: { status: "received" }, demo: { status: "yet_to_receive" },
        live: { postUrl: null }, tracking: {},
      },
      { // no state on file → must not be placed on the map
        name: "Nomad Eats", handle: "@nomadeats", platform: "Instagram",
        niche: "Food", followers: 95000, avgER: 7.2, status: "shortlisted",
        concept: {}, demo: {}, live: {}, tracking: {},
      },
    ],
  },
  {
    id: "c2", name: "Summer Launch Teaser", client: "FreshBite Foods",
    service: "Influencer Marketing", region: "North India",
    stage: "draft", progress: 8, budget: 800000, start: "2026-04-20", end: "2026-06-15",
    creators: [],
  },
  {
    id: "c3", name: "Snack Box — Paid Ads", client: "FreshBite Foods",
    service: "Performance Ads", region: "Pan-India",
    stage: "completed", progress: 100, budget: 400000, start: "2026-01-10", end: "2026-02-28",
    creators: [
      { // demo uploaded → an upload to review
        name: "Delhi Diaries", handle: "@delhidiaries", platform: "Instagram",
        niche: "Lifestyle", followers: "78K", avgER: 6.8, state: "Delhi",
        languages: ["Hindi"], status: "briefed",
        concept: { status: "approved" }, demo: { status: "received" },
        live: {}, tracking: {},
      },
    ],
  },
];

const rows = flattenCreators(CAMPAIGNS);

/* ── erOf / creatorStatus ────────────────────────────────────────────────── */

test("erOf returns null rather than 0 when nothing was measured", () => {
  assert.equal(erOf(null, null, 0), null);
  assert.equal(erOf(null, null, 1000), null);
  assert.equal(erOf(100, 0, 0), null);
  assert.equal(erOf(90, 10, 1000), 10);
});

test("creatorStatus reports the furthest signal, not the stored status", () => {
  assert.equal(creatorStatus({ status: "briefed", live: { postUrl: "x" } }), "posted");
  assert.equal(creatorStatus({ status: "briefed", demo: { status: "received" } }), "video_received");
  assert.equal(creatorStatus({ status: "negotiating" }), "in_negotiation");
  assert.equal(creatorStatus({ status: "not_a_real_status" }), "yet_to_pick");
});

/* ── flattenCreators ─────────────────────────────────────────────────────── */

test("flattenCreators normalises followers from every stored form", () => {
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.followers), [820_000, 1_200_000, 95_000, 78_000]);
  assert.deepEqual(rows.map((r) => r.size), ["Macro", "Mega", "Micro", "Micro"]);
});

test("flattenCreators reads language from languages[] — the field the API sends", () => {
  // Regression: the Overview filtered on `cr.language`, which the backend's
  // CREATOR_PUBLIC allowlist does not include, so the dropdown was always empty.
  assert.deepEqual(rows.map((r) => r.language), ["Kannada", "Tamil", null, "Hindi"]);
});

test("flattenCreators prefers measured ER over the profile forecast", () => {
  const anjali = rows[0];
  assert.equal(anjali.erMeasured, true);
  assert.equal(Number(anjali.er.toFixed(4)), Number((((21000 + 980) / 480000) * 100).toFixed(4)));
  // No tracking → falls back to the profile rate, and says so.
  assert.equal(rows[1].erMeasured, false);
  assert.equal(rows[1].er, 5.1);
});

test("flattenCreators resolves state names to map codes and tolerates none", () => {
  assert.deepEqual(rows.map((r) => r.stateCode), ["ka", "tn", null, "dl"]);
  assert.deepEqual(rows.map((r) => r.region), ["south", "south", null, "north"]);
});

test("flattenCreators marks only the creators sitting in the brand's court", () => {
  assert.deepEqual(rows.map((r) => r.waiting), [false, true, false, true]);
});

/* ── filters ─────────────────────────────────────────────────────────────── */

test("filterOptions offers only values that occur, with readable labels", () => {
  const opts = filterOptions(rows);
  assert.deepEqual(opts.language.map((o) => o.value), ["Hindi", "Kannada", "Tamil"]);
  assert.deepEqual(opts.region.map((o) => o.label), ["North", "South"]);
  // Statuses show their client-facing label, not the raw DB enum.
  assert.ok(opts.status.every((o) => !o.label.includes("_")));
});

test("applyFilters intersects across groups and ignores empty ones", () => {
  assert.equal(applyFilters(rows, { niche: [], size: [] }).length, 4);
  assert.equal(applyFilters(rows, { niche: ["Food"] }).length, 2);
  assert.equal(applyFilters(rows, { niche: ["Food"], size: ["Mega"] }).length, 1);
  assert.equal(applyFilters(rows, { niche: ["Food"], size: ["Nano"] }).length, 0);
});

/* ── headline numbers ────────────────────────────────────────────────────── */

test("summarise counts campaigns from the account and audience from the filter", () => {
  const all = summarise(CAMPAIGNS, rows);
  assert.equal(all.campaigns, 3);
  assert.equal(all.active, 2);          // c3 is completed
  assert.equal(all.completed, 1);
  assert.equal(all.creators, 4);
  assert.equal(all.live, 1);
  assert.equal(all.followers, 2_193_000);
  assert.equal(all.budget, 2_450_000);
  assert.equal(all.waiting, 2);
  assert.equal(all.states, 3);

  // Filtering the roster must not shrink the budget or the campaign count.
  const filtered = summarise(CAMPAIGNS, applyFilters(rows, { size: ["Mega"] }));
  assert.equal(filtered.budget, 2_450_000);
  assert.equal(filtered.campaigns, 3);
  assert.equal(filtered.creators, 1);
});

test("summarise leaves avgER null when no creator has a rate", () => {
  assert.equal(summarise(CAMPAIGNS, []).avgER, null);
});

test("healthScore averages progress over live campaigns only", () => {
  // Derived from each STAGE, not the stale `progress` the fixtures also carry
  // and not from the roster: execution → 55, draft → 0. (55 + 0) / 2 = 27.5 → 28.
  assert.deepEqual(healthScore(CAMPAIGNS), { value: 28, of: 2 });
  assert.equal(healthScore([]), null);
  assert.equal(healthScore([{ stage: "completed", progress: 100 }]), null);
});

test("pipeline returns all five phases in order, zeros included", () => {
  const p = pipeline(CAMPAIGNS);
  assert.deepEqual(p.map((x) => x.id), ["brief", "shortlist", "production", "live", "completed"]);
  // c1 is `production`: its stage (`execution` → legacy → `advance_received`)
  // says so, and a live post on its roster does not move it. The stage is the
  // record — see phaseOf in lib/phases.js.
  assert.deepEqual(p.map((x) => x.count), [1, 0, 1, 0, 1]);
});

/* ── signals ─────────────────────────────────────────────────────────────── */

test("signals surface each real queue and route somewhere", () => {
  const s = signals(CAMPAIGNS, rows);
  const byId = Object.fromEntries(s.map((x) => [x.id, x]));

  assert.equal(byId.approvals.count, 1);          // South Foodie (concept in)
  assert.equal(byId.approvals.page, "campaigns");
  assert.equal(byId.approvals.params.campaignId, "c1");

  assert.equal(byId.uploads.count, 2);            // concept received + demo received
  assert.equal(byId.brief.page, "campaigns");     // c2 is the only brief-phase campaign
  assert.equal(byId.brief.params.campaignId, "c2");
  assert.equal(byId.regional.page, "regional");
  assert.ok(s.every((x) => x.page || x.anchor));
});

test("signals stay silent when there is nothing to act on", () => {
  const quiet = signals([CAMPAIGNS[2]], []);
  assert.deepEqual(quiet, []);
});

/* ── grouping ────────────────────────────────────────────────────────────── */

test("groupBy skips creators missing the field and orders tiers naturally", () => {
  const byNiche = groupBy(rows, "niche");
  assert.deepEqual(byNiche.map((g) => g.label), ["Food", "Cooking", "Lifestyle"]);
  assert.equal(byNiche[0].count, 2);

  assert.deepEqual(groupBy(rows, "size").map((g) => g.label), ["Micro", "Macro", "Mega"]);
  // The creator with no language is left out rather than bucketed as "Unknown".
  assert.equal(groupBy(rows, "language").reduce((s, g) => s + g.count, 0), 3);
});

test("availableMetrics hides a metric the data can't answer", () => {
  const noTracking = groupBy(rows.filter((r) => !r.live), "size");
  assert.ok(!availableMetrics(noTracking).some((m) => m.id === "views"));
  assert.ok(availableMetrics(groupBy(rows, "size")).some((m) => m.id === "views"));
});

test("flagOutliers needs a real spread before it calls anything an outlier", () => {
  assert.deepEqual(flagOutliers([{ v: 1 }, { v: 9 }], (r) => r.v), [null, null]); // too few
  assert.deepEqual(flagOutliers([{ v: 5 }, { v: 5 }, { v: 5 }], (r) => r.v), [null, null, null]);
  const flags = flagOutliers([{ v: 1 }, { v: 1 }, { v: 1 }, { v: 1 }, { v: 20 }], (r) => r.v);
  assert.equal(flags[4], "high");
});

/* ── campaigns ───────────────────────────────────────────────────────────── */

test("serviceGroups weights progress by budget", () => {
  const g = serviceGroups(CAMPAIGNS, rows);
  const im = g.find((x) => x.service === "Influencer Marketing");
  // Stage-derived, budget-weighted: execution → 55, draft → 0.
  // (55×1_250_000 + 0×800_000) / 2_050_000 = 33.5 → 34
  assert.equal(im.progress, 34);
  assert.equal(im.campaigns, 2);
  assert.equal(im.active, 2);
  assert.equal(im.budget, 2_050_000);
  assert.equal(im.reach, 2_115_000);
  assert.deepEqual(im.regions, ["South India", "North India"]);
  assert.equal(im.from, "2026-03-01");
  assert.equal(im.to, "2026-06-15");
});

test("rankCampaigns drops campaigns with no reach to rank", () => {
  const r = rankCampaigns(CAMPAIGNS, rows);
  assert.deepEqual(r.map((c) => c.id), ["c1", "c3"]); // c2 has no creators
  assert.equal(r[0].reach, 2_115_000);
});

/* ── content + activity ──────────────────────────────────────────────────── */

test("platformPerformance only includes live, measured posts", () => {
  const p = platformPerformance(rows);
  assert.equal(p.length, 1);
  assert.equal(p[0].label, "Instagram");
  assert.equal(p[0].avgViews, 480000);
});

test("livePosts ranks by measured ER and reports null where unmeasured", () => {
  const posts = livePosts(rows);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].name, "Anjali Kitchen");
  assert.ok(posts[0].er > 4);
});

/* The panel's ER / Views toggle. The two orderings answer different questions —
   how hard a post worked its audience, against how many people it reached — and
   the same four posts come out in a different order under each. */
test("livePosts orders by the metric asked for, either way round", () => {
  const shaped = (name, views, er) => ({
    key: name, name, live: { url: "u" }, views, er, erMeasured: er != null,
  });
  const feed = [
    shaped("wide reach", 4_100_000, 0.5),
    shaped("tight niche", 53_000, 2.4),
    shaped("both", 6_900_000, 8.4),
  ];
  assert.deepEqual(livePosts(feed, "er").map((p) => p.name), ["both", "tight niche", "wide reach"]);
  assert.deepEqual(livePosts(feed, "views").map((p) => p.name), ["both", "wide reach", "tight niche"]);
  // Default and unknown ids both fall back to ER rather than payload order.
  assert.deepEqual(livePosts(feed).map((p) => p.name), livePosts(feed, "er").map((p) => p.name));
  assert.deepEqual(livePosts(feed, "nonsense").map((p) => p.name), livePosts(feed, "er").map((p) => p.name));
});

test("an unmeasured post sinks below a genuine zero, in both orderings", () => {
  const feed = [
    { key: "unmeasured", name: "unmeasured", live: { url: "u" }, views: null, er: null, erMeasured: false },
    { key: "zero", name: "zero", live: { url: "u" }, views: 0, er: 0, erMeasured: true },
  ];
  for (const sort of ["er", "views"]) {
    assert.deepEqual(livePosts(feed, sort).map((p) => p.name), ["zero", "unmeasured"], sort);
  }
});

test("activityFeed is newest-first and never includes a future date", () => {
  const feed = activityFeed(CAMPAIGNS, rows, 10);
  const ts = feed.map((f) => f.ts);
  assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
  assert.ok(feed.every((f) => f.ts <= Date.now()));
  assert.ok(feed.every((f) => f.campaignId));
});

test("activityFeed respects its limit", () => {
  assert.ok(activityFeed(CAMPAIGNS, rows, 2).length <= 2);
});

test("needsYou groups the queue per campaign, biggest first", () => {
  const q = needsYou(CAMPAIGNS, rows);
  assert.deepEqual(q.map((x) => x.campaignId), ["c1", "c3"]);
  assert.equal(q[0].count, 1);
  assert.equal(q[0].campaignName, "Diwali Festive Push");
});

/* ── regional ────────────────────────────────────────────────────────────── */

test("regionalRollup places creators by state and counts the unplaced", () => {
  const r = regionalRollup(CAMPAIGNS, rows);
  assert.equal(r.unplaced, 1);
  assert.equal(r.stateData.ka.creators, 1);
  assert.equal(r.stateData.ka.followers, 820_000);
  assert.equal(r.stateData.mh.creators, 0);          // every state gets an entry
  assert.equal(r.regionData.south.creators, 2);
  assert.equal(r.regionData.north.creators, 1);
  assert.equal(r.langData.Kannada.creators, 1);
});

test("regionalRollup totals exclude unplaced creators but not budget", () => {
  const { totals } = regionalRollup(CAMPAIGNS, rows);
  assert.equal(totals.creators, 3);                  // the stateless one is out
  assert.equal(totals.followers, 2_098_000);
  assert.equal(totals.budget, 2_450_000);            // all campaigns count
  assert.equal(totals.states, 3);
  assert.equal(totals.regions, 2);
  assert.equal(totals.campaigns, 2);                 // c2 has nobody placed
});

test("regionalRollup keeps each campaign's creators scoped to where they are", () => {
  const r = regionalRollup(CAMPAIGNS, rows);
  const c1 = r.campaigns.find((c) => c.id === "c1");
  assert.deepEqual([...c1.states].sort(), ["ka", "tn"]);
  assert.equal(c1.creators.length, 2);                // the stateless one is excluded
});

test("regionalRollup handles a client with no data at all", () => {
  const r = regionalRollup([], []);
  assert.equal(r.totals.creators, 0);
  assert.equal(r.totals.states, 0);
  assert.deepEqual(r.campaigns, []);
});

/* ── deliverables ────────────────────────────────────────────────────────────
   These must agree with lib/campaign.js in 5th-internal-front — the two apps
   quoting a brand different post counts is the bug this mirrors away. */

const DELIV_CAMPAIGN = {
  id: "d1", numReq: 4, deliverablesPerCreator: 2,
  creators: [
    { name: "A", status: "locked", live: { postUrls: ["u1", "u2"], postUrl: "u1" } },          // owes 2, posted 2
    { name: "B", status: "locked", numDeliverables: 3, live: { postUrls: ["u3"], postUrl: "u3" } }, // override: owes 3, posted 1
    { name: "C", status: "shortlisted", live: {} },                                             // not locked → owes nothing yet
  ],
};

test("deliverableTarget prefers the creator override, else the campaign plan", () => {
  const [a, b] = DELIV_CAMPAIGN.creators;
  assert.equal(perCreatorDeliverables(DELIV_CAMPAIGN), 2);
  assert.equal(deliverableTarget(DELIV_CAMPAIGN, a), 2);   // no override → plan
  assert.equal(deliverableTarget(DELIV_CAMPAIGN, b), 3);   // override wins
  assert.equal(deliverableTarget({}, {}), 1);              // no plan at all → 1
});

test("deliverablesPosted counts the postUrls array, falling back to postUrl", () => {
  assert.equal(deliverablesPosted({ live: { postUrls: ["a", "b", "c"] } }), 3);
  assert.equal(deliverablesPosted({ live: { postUrl: "a" } }), 1);   // legacy single-link shape
  assert.equal(deliverablesPosted({ live: {} }), 0);
  assert.equal(deliverablesPosted({}), 0);
});

test("isLocked reads the negotiation status, which survives concept/demo progress", () => {
  assert.equal(isLocked({ status: "locked", demo: { status: "received" } }), true);
  assert.equal(isLocked({ status: "shortlisted" }), false);
});

test("totalDeliverables = locked creators' real targets + unfilled slots at plan", () => {
  // locked: 2 + 3 = 5 committed. numReq 4 − 2 locked = 2 unfilled × plan 2 = 4.
  assert.equal(totalDeliverables(DELIV_CAMPAIGN), 9);
  assert.equal(postedDeliverables(DELIV_CAMPAIGN), 3); // 2 + 1; the unlocked creator contributes nothing
});

test("totalDeliverables never drops below what the locked creators already owe", () => {
  // Over-locked: 3 locked against numReq 2. The campaign still owes all three.
  const over = {
    numReq: 2, deliverablesPerCreator: 1,
    creators: [{ status: "locked" }, { status: "locked" }, { status: "locked" }],
  };
  assert.equal(totalDeliverables(over), 3);
});

test("totalDeliverables is meaningful before anyone is locked", () => {
  assert.equal(totalDeliverables({ numReq: 5, deliverablesPerCreator: 2, creators: [] }), 10);
  assert.equal(totalDeliverables({ creators: [] }), 0); // no plan, no roster → nothing claimed
});

/* ── copy ────────────────────────────────────────────────────────────────── */

test("greeting follows the clock", () => {
  assert.equal(greeting(new Date(2026, 7, 9, 8)), "Good morning");
  assert.equal(greeting(new Date(2026, 7, 9, 14)), "Good afternoon");
  assert.equal(greeting(new Date(2026, 7, 9, 20)), "Good evening");
});

test("heroSummary only claims what the data supports", () => {
  const kpis = summarise(CAMPAIGNS, rows);
  const text = heroSummary({ kpis, health: healthScore(CAMPAIGNS), signalRows: signals(CAMPAIGNS, rows) });
  assert.match(text, /Campaign progress is at 28%/);   // see healthScore above
  assert.match(text, /signals need a decision today/);

  const quiet = heroSummary({ kpis: summarise([], []), health: null, signalRows: [] });
  assert.match(quiet, /Nothing is waiting on you right now\./);
  assert.doesNotMatch(quiet, /Campaign progress/);
});

/* ── budgetLines ────────────────────────────────────────────────────────────
   The Budget card's hover and the Billing page both render this split, and a
   brand checks it against an invoice. The invariant worth guarding is not any
   single figure but that the column always RECONCILES: creator lines + fee +
   diff === the budget it hangs off, whichever way the numbers fall. */
test("budgetLines itemises creators then the fee, and always reconciles", () => {
  // Pronto's real "Brainrot" shape: two priced creators + a fee that closes the
  // gap to the budget exactly.
  const split = budgetLines({
    budget: 49500,
    agencyFee: 4500,
    creators: [
      { name: "Shoaib", handle: "the.handsome.scam", cost: 38000 },
      { name: "Eraquie", handle: "matiyabruz", cost: 7000 },
    ],
  });
  assert.equal(split.creatorTotal, 45000);
  assert.equal(split.listed, 49500);
  assert.equal(split.diff, 0);
  // The fee is the last row and is flagged, so callers can draw it apart from
  // the people above it without re-deriving which row it is.
  assert.equal(split.rows.length, 3);
  assert.equal(split.rows.at(-1).fee, true);
  assert.equal(split.rows.at(-1).label, "Agency fee");
  // Shares are of the BUDGET, not of the rows on show.
  assert.equal(Math.round(split.rows[0].share), 77);
  // Highest first, so the biggest line is never buried.
  assert.ok(split.rows[0].amount > split.rows[1].amount);
});

test("budgetLines leaves unpriced creators out but still counts them", () => {
  const split = budgetLines({
    budget: 100000,
    agencyFee: 0,
    creators: [{ name: "A", cost: 30000 }, { name: "B" }, { name: "C", cost: 0 }],
  });
  // Two creators have no agreed cost — listing them at ₹0 would read as
  // "working for nothing" rather than "not priced yet".
  assert.equal(split.rows.length, 1);
  assert.equal(split.itemised, 1);
  assert.equal(split.rosterCount, 3);
  // The shortfall is reported rather than absorbed, so the caller can draw it.
  assert.equal(split.diff, 70000);
  assert.equal(split.listed + split.diff, split.base);
});

test("budgetLines reports an overspend as a negative diff", () => {
  const split = budgetLines({
    budget: 50000,
    agencyFee: 10000,
    creators: [{ name: "A", cost: 60000 }],
  });
  assert.equal(split.listed, 70000);
  assert.equal(split.diff, -20000);
  assert.equal(split.listed + split.diff, split.base);
});

test("budgetLines falls back to the listed total when no budget is agreed", () => {
  // A campaign with no budget can still have priced creators; shares then have
  // to divide by something real rather than by zero.
  const split = budgetLines({ budget: 0, agencyFee: 0, creators: [{ name: "A", cost: 20000 }] });
  assert.equal(split.base, 20000);
  assert.equal(split.rows[0].share, 100);
});

test("budgetLines survives an empty or absent roster", () => {
  const split = budgetLines({ budget: 10000 });
  assert.deepEqual(split.rows, []);
  assert.equal(split.listed, 0);
  assert.equal(split.diff, 10000);
  assert.equal(budgetLines().base, 0);
});

/* ── countsInMetrics ────────────────────────────────────────────────────────
   Drafts show on the brand's board but must not move a figure they are asked
   to trust: an unagreed budget and a shortlist nobody has walked them through. */
test("countsInMetrics counts only campaigns that have gone live", () => {
  assert.equal(countsInMetrics({ stage: "invoice_raised" }), true);   // live
  assert.equal(countsInMetrics({ stage: "payment_done" }), true);     // completed
  assert.equal(countsInMetrics({ stage: "draft" }), false);
  assert.equal(countsInMetrics({ stage: "brief_locked" }), false);
  // The regression this guards: keyed on "not draft", assigning a team to a
  // campaign silently re-admitted its unagreed budget to the brand's headline.
  assert.equal(countsInMetrics({ stage: "team_assigned" }), false);
  assert.equal(countsInMetrics({ stage: "advance_received" }), false); // production
  // Unknown stages normalise to draft — excluded rather than silently counted.
  assert.equal(countsInMetrics({}), false);
  assert.equal(countsInMetrics({ stage: "nonsense" }), false);
  // Pronto's real shape: three campaigns on the board, two in the numbers.
  const pronto = [{ stage: "payment_done" }, { stage: "invoice_raised" }, { stage: "team_assigned" }];
  assert.equal(pronto.filter(countsInMetrics).length, 2);
});

/* Posts being up does NOT admit a campaign here, and that is the point.
   Delivery advances a campaign's phase on the BOARD — a campaign with seven
   posts live stops reading as "Shortlisting" — but the board is answering
   "where is the work". This gate answers "may this money move a figure the
   brand is asked to trust", and only the commercial track can say yes.

   BAU is why the two must not be merged: eleven creators locked, seven live,
   and not one of them priced. Admitted here it rendered a bill of ₹0 against a
   ₹3.3L budget with "No creator costs agreed on this campaign yet" where the
   lines should be. An unpriced roster is not a gap to route around — it is what
   "the commercials have not started" looks like in the data. */
test("delivery does not admit a campaign whose commercials have not started", () => {
  const live = { stage: "team_assigned", creators: [{ status: "locked", live: { postUrls: ["u"] } }] };
  assert.equal(countsInMetrics(live), false);
  // And the board still moves for the same campaign — the two answers differ
  // on purpose. (campaignPhaseOf is pinned in phases.test.js.)
  const settled = { stage: "payment_done", creators: [{ status: "locked", live: { postUrls: ["u"] } }] };
  assert.equal(countsInMetrics(settled), true);
});
