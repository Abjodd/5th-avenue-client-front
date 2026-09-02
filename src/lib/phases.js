// Campaign phase registry — single source for the pipeline stages, and for the
// mapping from the backend's internal 16-stage pipeline down to them.
// Every page renders these five phases; none may define its own copy.
//
// The stage→phase table used to live in lib/api.js, which meant importing the
// fetch client (and with it `import.meta.env`) just to ask what phase a
// campaign is in — enough to make lib/portalMetrics.js unusable outside a
// bundler. It's phase logic, so it lives with the phases; api.js re-exports it
// for the modules that already imported it from there.

// Identity and order only. The glyph for each phase lives in lib/phaseIcons.js
// — it is presentation, and keeping it out means this module (and everything
// pure that imports it, like portalMetrics.js and its node:test suite) never
// has to pull in a React icon library to answer "what phase is this?".
import { deliveryStats } from "./delivery.js";

export const PHASES = [
  { id: "brief",      label: "Brief & Strategy", short: "Brief" },
  { id: "shortlist",  label: "Shortlisting",     short: "Shortlisting" },
  { id: "production", label: "Production",       short: "Production" },
  { id: "live",       label: "Live",             short: "Live" },
  { id: "completed",  label: "Completed",        short: "Completed" },
];

export const PHASE_LABELS = Object.fromEntries(PHASES.map(p => [p.id, p.short]));

// Phase → colour, resolved against the theme palette P (context.js LIGHT)
export const phaseColors = (P) => ({
  brief: P.mute, shortlist: P.amber, production: P.accent, live: P.green, completed: P.doneTxt,
});

// The backend stores the internal pipeline stage on each campaign; the portal
// shows clients this simpler 5-phase view.
//
// This table listed ONLY the retired stage ids. The internal pipeline was
// forked into a stored finance track (draft → brief_locked → team_assigned →
// po_raised → advance_received → invoice_raised → payment_done) with delivery
// re-derived from the creators, and none of the new ids were added here. Since
// phaseOf() falls back to "brief" for anything it doesn't recognise, every
// campaign created after that fork was shown to the client as "Brief &
// Strategy" no matter how far along it actually was — and because "brief" is
// not "completed", a fully paid campaign also kept counting as active in the
// headline KPIs and the health ring.
//
// Both id sets are mapped here. The retired ids stay because campaigns are not
// migrated on read — a document keeps whatever stage it was last saved with.
export const STAGE_TO_PHASE = {
  // ── current forked pipeline ──
  draft: "brief",
  brief_locked: "brief",
  team_assigned: "shortlist",
  po_raised: "shortlist",
  advance_received: "production",
  invoice_raised: "live",
  payment_done: "completed",
  // ── retired ids, still on unmigrated documents ──
  brief_log: "brief",
  creator_shortlist: "shortlist",
  po: "shortlist",
  advance: "shortlist",
  execution: "production",
  brief_sent: "production",
  concept_submitted: "production",
  concept_approved: "production",
  production: "production",
  video_submitted: "production",
  internal_review: "production",
  client_approved: "production",
  live: "live",
  creator_paid: "live",
  reporting: "live",
  completed: "completed",
};

/**
 * Which of the five phases a brand should see this campaign in: whatever
 * `campaign.stage` says, mapped through STAGE_TO_PHASE. Nothing else.
 *
 * A delivery reading was briefly allowed to advance this — posts being up
 * pushed a campaign to `live` however its stage read — and that was wrong. The
 * stage is the record. BAU sits at `team_assigned` on the internal board,
 * chip reading "Team Assigned", and the portal was showing the same campaign
 * to the brand as LIVE, phase tracker ticked through to the broadcast node. Two
 * apps, one campaign, two different claims about where it had got to — and the
 * portal's was the one with no document behind it.
 *
 * The work still has its own number; see deliveryProgressOf below. What it does
 * not get is a vote on the stage, because a stage is a thing somebody moved
 * deliberately, not something to infer from side effects.
 */
export const phaseOf = (stage) => STAGE_TO_PHASE[stage] || "brief";

/** phaseOf for a caller holding the raw campaign — the common case. */
export const campaignPhaseOf = (campaign) => phaseOf(campaign?.stage);

// Percentage a campaign reads on entering each stored stage. Mirrors the `p`
// column of PIPELINE in the internal app's src/lib/campaign.js — the two must
// agree, or the client portal and the internal board report different progress
// for the same campaign.
const STAGE_PROGRESS = {
  draft: 0, brief_locked: 8, team_assigned: 16, po_raised: 35,
  advance_received: 55, invoice_raised: 80, payment_done: 100,
};

// Retired id → its equivalent on the forked track, so old documents still get
// a sensible percentage. Mirrors LEGACY_STAGE in the internal app.
const LEGACY_TO_STAGE = {
  brief_log: "draft", creator_shortlist: "draft", po: "team_assigned",
  advance: "po_raised", execution: "advance_received", reporting: "advance_received",
  brief_sent: "advance_received", concept_submitted: "advance_received",
  concept_approved: "advance_received", production: "advance_received",
  video_submitted: "advance_received", internal_review: "advance_received",
  client_approved: "advance_received", live: "advance_received",
  creator_paid: "advance_received", completed: "payment_done",
};

/**
 * How far along a campaign is, 0–100 — on the track the brand can actually see.
 *
 * This used to be the stored FINANCE stage's fixed percentage and nothing else:
 * draft 0, brief_locked 8, team_assigned 16, po_raised 35, advance_received 55,
 * invoice_raised 80, payment_done 100. Those are the right numbers for the
 * internal board, which draws a finance rail beside them. This portal draws no
 * such rail — a brand never sees a PO or an invoice here — so the number was
 * measuring a thing that had no other representation anywhere in the app. A
 * campaign with seven of eleven creators live read 16%, because its PO was
 * outstanding.
 *
 * The internal app already makes exactly this distinction, in progressOf()
 * (5th-internal-front pages/Campaigns/index.jsx): a role with no finance rail
 * is given the execution track's own percentage instead of the finance one,
 * because otherwise "the stage LABEL beside this number is derived one way and
 * the number the other". The brand is such a role — the one with the least
 * business reading a finance figure — and was the only one never given that
 * treatment.
 *
 * So: DELIVERY drives the number, and the stage is consulted only where
 * delivery cannot answer. deliveryStats() is a field-for-field copy of the
 * internal execStats(), so the two apps quote one campaign one percentage.
 *
 * The stage still wins in two places, both of them cases where the work has
 * nothing to say:
 *
 *  · A settled campaign reads 100 whatever its roster looks like. Some closed
 *    campaigns never locked a full roster, and delivery would strand them in
 *    the eighties for good.
 *  · A campaign with nothing locked yet falls back to the stage number, so a
 *    signed-off brief still reads as movement rather than as a flat zero
 *    indistinguishable from an untouched draft.
 *
 * `progress` used to be written onto the campaign document, and the portal
 * read it directly. It is now derived from the stage on the internal side and
 * is no longer written, so campaigns created since read `undefined` — which
 * the portal was turning into 0. That is how a campaign sitting at "Invoice
 * Raised" reported a health score of 0%: not a campaign in trouble, a field
 * that stopped being stored.
 *
 * The STAGE wins wherever it resolves. This used to be the other way round —
 * a stored value beat the stage, so "campaigns that predate the change keep
 * the number they were last saved with" — and that reasoning only holds while
 * the stored number is still being maintained. It is not: nothing writes
 * `progress` any more (it survives as a dead column on the Campaign schema),
 * so a document that was last saved at 90% and has since been carried all the
 * way to `payment_done` still told the brand 90% — for good, with no event
 * that could ever move it. Meanwhile the phase stepper above it read
 * "Completed" and the internal board read 100%, because both derive. One
 * campaign, three numbers, and the only wrong one was the frozen one.
 *
 * A dead field must never outrank a live one. The stored value is kept as the
 * fallback for the case it was actually meant for — a document whose stage is
 * missing or unrecognised, where there is nothing to derive from.
 */
export function progressOf(campaign) {
  const stage = campaign?.stage;
  const derived = STAGE_PROGRESS[stage] ?? STAGE_PROGRESS[LEGACY_TO_STAGE[stage]];
  if (derived != null) return derived;
  const stored = Number(campaign?.progress);
  return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : 0;
}

/**
 * How far the WORK has got — creators locked, concepts and demos in, posts up.
 *
 * Kept beside progressOf rather than folded into it. The two measure different
 * things and a campaign is entitled to disagree with itself: BAU is 16% on the
 * stage and 82% on the work, and both are true. Folding the work into the
 * headline made the portal claim a campaign was nearly done while the internal
 * board, reading the same document, said it had barely started.
 *
 * deliveryStats() is a field-for-field copy of execStats() in the internal app
 * (5th-internal-front lib/campaign.js), so this figure and the one on the
 * internal execution rail are the same number, not two estimates of one.
 */
export const deliveryProgressOf = (campaign) => deliveryStats(campaign).pct;

/**
 * The commercial half, kept addressable rather than deleted.
 *
 * Nothing in the portal renders it today — a brand has no use for "the PO is
 * raised but the advance hasn't landed". It stays exported because Billing's
 * status chip is derived from the same finance dates, and the next screen that
 * wants to say "invoiced" should read this rather than re-deriving a second
 * opinion from `stage`.
 */
export const commercialProgressOf = (campaign) => {
  const stage = campaign?.stage;
  return STAGE_PROGRESS[stage] ?? STAGE_PROGRESS[LEGACY_TO_STAGE[stage]] ?? 0;
};

/**
 * Has the brief been signed off by Fifth Avenue?
 *
 * Mirrors briefLocked() in the internal app (5th-internal-front
 * src/lib/campaign.js) — and it has to, because the portal's Brief tab tells a
 * brand whether the document they are reading is final.
 *
 * The portal used to test `briefStatus === "locked"`, which is a value from a
 * vocabulary the internal app stopped writing: locking a brief now stamps
 * `signed_off` (Campaigns/index.jsx, the `lock_brief` case), while older
 * documents carry `draft` / `pending` / `shortlisting` / `locked` from three
 * earlier flows. So the banner was pinned to "under review" on every campaign
 * that had actually been approved, with no way for it to ever clear.
 *
 * The stage is the second witness, for the same reason the internal app reads
 * it: campaigns predating the brief-lock step never got the flag at all, and a
 * stage past `draft` is proof the lock happened whatever the flag says. Kept a
 * read-time derivation rather than a migration — documents are not rewritten on
 * read here (see progressOf), and a second mechanism doing this job is a second
 * thing to keep in step.
 */
export const normStage = (stage) =>
  stage in STAGE_PROGRESS ? stage : (LEGACY_TO_STAGE[stage] || "draft");

export const briefLockedOf = (campaign) =>
  campaign?.briefStatus === "signed_off" || normStage(campaign?.stage) !== "draft";
