/**
 * src/lib/delivery.js — how far the WORK has got, independent of the money.
 *
 * A campaign runs on two tracks. The internal app forked them explicitly
 * (5th-internal-front lib/campaign.js): a stored FINANCE track that moves on
 * documents outside the app — the client's PO, their bank transfer — and a
 * DERIVED EXECUTION track that moves as creators lock, submit and post. One
 * linear stage made "the money is late but the work is fine" impossible to say.
 *
 * The portal only ever inherited the finance half. `campaign.stage` was the
 * single input to both the phase a brand saw and the percentage on its ring, so
 * a campaign with seven creators live and 2.5M views sat at `team_assigned` and
 * was shown to the brand as "Shortlisting · 16%" — a number about an unraised
 * PO, printed over work that was most of the way done. The brand cannot see
 * POs, advances or invoices anywhere in this app; there was no screen on which
 * that 16% meant anything.
 *
 * So this module derives the other half. Nothing here reads `stage`.
 *
 * The primitives below moved out of portalMetrics.js (which re-exports them, so
 * every existing import path still resolves) purely to break a cycle:
 * portalMetrics imports phases.js, and phases.js now needs a delivery reading.
 * A module that imports nothing local can be imported by both.
 */

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

/* ── LIVE ────────────────────────────────────────────────────────────────────
   Every performance number on the portal is gated on this.

   Spend is committed when a campaign is booked; performance only exists once
   something is posted. Counting both meant a campaign still in brief entered
   the Overview as real budget against no audience — the reach line stopped
   dead, CPV divided spend by views nobody had earned, and the brand read a
   collapse into a campaign that had not run. A campaign with nothing live now
   contributes nothing to any aggregate; it still appears on the board with its
   committed budget, which is true and theirs to see.

   Mirrors isCreatorLive() in 5th-internal-back/server.js. */
export const isCreatorLive = (cr) => deliverablesPosted(cr) > 0;

/** Is a single post up? Takes a RAW campaign, so callers can ask before mapping. */
export const campaignIsLive = (campaign) =>
  (campaign?.creators || []).some(isCreatorLive);

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

/* ── THE DERIVED TRACK ───────────────────────────────────────────────────────
   Mirrors execStats() in 5th-internal-front lib/campaign.js, field for field
   and weight for weight. It is copied rather than approximated because the two
   apps quote the SAME campaign to the same people: an account manager reading
   82% on the internal board and a brand reading 74% on the portal is the
   three-numbers-for-one-campaign problem the fork was drawn to end.

   Four milestones per creator — locked, concept in, demo in, posts up — so a
   campaign advances continuously through the long middle rather than sitting at
   one number from the day the roster locks to the day the last reel goes up.

   `numReq` is the denominator where there is one, because a roster of 3 against
   a plan of 11 is 3/11 of the way there, not finished. Where there is no plan
   the locked roster IS the denominator: progress over what has been committed
   is the only thing there is to measure. */

/** An asset that has been received at all. Mirrors assetIn() internally. */
const assetIn = (a) => !!a?.status && a.status !== "yet_to_receive";

/** Posts up for this creator, never counted past what they actually owe. */
const delivered = (campaign, cr) =>
  Math.min(deliverablesPosted(cr), deliverableTarget(campaign, cr));

export function deliveryStats(campaign) {
  const locked = (campaign?.creators || []).filter(isLocked);
  // `?? 0` not `|| 0` so a real plan of 0 is respected rather than falling
  // through to the roster size.
  const target = Math.max(num(campaign?.numReq) ?? 0, locked.length);
  const done = locked.reduce((s, cr) => s + delivered(campaign, cr), 0);
  const owed = locked.reduce((s, cr) => s + deliverableTarget(campaign, cr), 0);
  const stats = {
    locked: locked.length,
    concept: locked.filter((cr) => assetIn(cr.concept)).length,
    video: locked.filter((cr) => assetIn(cr.demo)).length,
    // Creators with every post up — what "live" means as a headcount.
    live: locked.filter((cr) => delivered(campaign, cr) >= deliverableTarget(campaign, cr)).length,
    target,
    delivered: done,
    expected: owed,
  };
  // Fractional credit for partially-posted creators, in creator-equivalents so
  // it stays commensurate with the other three milestones.
  const liveFrac = owed > 0 ? (done / owed) * locked.length : 0;
  const total = target * 4;
  stats.pct = total > 0
    ? Math.min(100, Math.round(((stats.locked + stats.concept + stats.video + liveFrac) / total) * 100))
    : 0;
  return stats;
}

/** Has anything at all happened on the delivery track? Distinguishes "0% and
    not started" from "0% and running", which the percentage alone cannot. */
export const deliveryStarted = (campaign) => deliveryStats(campaign).locked > 0;
