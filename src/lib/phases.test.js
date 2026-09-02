/**
 * Unit tests for lib/phases.js — `npm test` (node:test).
 *
 * These pin the stage→phase table and the progress derivation against the
 * internal app's pipeline (5th-internal-front src/lib/campaign.js). Both bugs
 * covered here were silent: they produced a plausible-looking number rather
 * than an error, so nothing surfaced until a client asked why a finished
 * campaign still said "Brief & Strategy".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  phaseOf, campaignPhaseOf, progressOf, commercialProgressOf, deliveryProgressOf,
  briefLockedOf, STAGE_TO_PHASE,
} from "./phases.js";

// ── stage → phase ──────────────────────────────────────────────────────────

test("every stage of the current forked pipeline is mapped", () => {
  // The regression: these ids were absent, so phaseOf fell through to "brief"
  // and every post-fork campaign looked like it had not started.
  for (const id of ["draft", "brief_locked", "team_assigned", "po_raised",
                    "advance_received", "invoice_raised", "payment_done"]) {
    assert.ok(id in STAGE_TO_PHASE, `${id} must be mapped`);
  }
});

test("a paid campaign is completed, not brief", () => {
  // Doubly important: "not completed" is what counts a campaign as active in
  // the headline KPIs and the health ring, so this bug also inflated both.
  assert.equal(phaseOf("payment_done"), "completed");
});

test("an invoiced campaign reads as live, not brief", () => {
  assert.equal(phaseOf("invoice_raised"), "live");
});

test("mid-pipeline stages land in the middle, not at the start", () => {
  assert.equal(phaseOf("team_assigned"), "shortlist");
  assert.equal(phaseOf("advance_received"), "production");
});

test("retired ids still map — documents are not migrated on read", () => {
  assert.equal(phaseOf("reporting"), "live");
  assert.equal(phaseOf("creator_paid"), "live");
  assert.equal(phaseOf("execution"), "production");
  assert.equal(phaseOf("completed"), "completed");
});

test("an unknown stage degrades to brief rather than throwing", () => {
  assert.equal(phaseOf("something_new"), "brief");
  assert.equal(phaseOf(undefined), "brief");
});

// ── progress ───────────────────────────────────────────────────────────────

test("progress is derived from the stage when nothing is stored", () => {
  // `progress` stopped being written when the internal side began deriving it.
  // Reading the absent field as 0 is what reported "health 0%" for a campaign
  // sitting at Invoice Raised.
  assert.equal(progressOf({ stage: "invoice_raised" }), 80);
  assert.equal(progressOf({ stage: "team_assigned" }), 16);
  assert.equal(progressOf({ stage: "payment_done" }), 100);
});

test("the stage outranks a stale stored progress", () => {
  // The regression this pins, from a real campaign: `progress: 90` was written
  // long ago, the campaign has since been carried to payment_done, and nothing
  // writes `progress` any more. Under the old precedence the portal showed the
  // brand 90% for good — beneath a phase stepper reading "Completed" and next
  // to an internal board reading 100%.
  assert.equal(progressOf({ stage: "payment_done", progress: 90 }), 100);
  // It cuts both ways: a stored number ahead of the stage is just as stale.
  assert.equal(progressOf({ stage: "draft", progress: 42 }), 0);
  // Retired stage ids resolve through LEGACY_TO_STAGE and win the same way.
  assert.equal(progressOf({ stage: "reporting", progress: 90 }), 55);
});

test("a stored value is the fallback when the stage cannot be resolved", () => {
  // The case the stored field was actually for — no stage to derive from.
  assert.equal(progressOf({ progress: 55 }), 55);
  assert.equal(progressOf({ stage: "who_knows", progress: 55 }), 55);
});

test("a stored zero is honoured, not treated as missing", () => {
  // The `?? 0` idiom this replaced could not tell 0 from undefined; a real
  // stored 0 must survive the fallback path.
  assert.equal(progressOf({ progress: 0 }), 0);
});

test("stored progress is clamped to 0..100", () => {
  assert.equal(progressOf({ progress: 140 }), 100);
  assert.equal(progressOf({ progress: -5 }), 0);
});

test("retired stages derive a sensible progress too", () => {
  assert.equal(progressOf({ stage: "execution" }), 55);
  assert.equal(progressOf({ stage: "completed" }), 100);
});

test("an unknown or absent stage with nothing stored is 0, not NaN", () => {
  // NaN would propagate through mean() and render the health ring as "NaN%".
  assert.equal(progressOf({ stage: "who_knows" }), 0);
  assert.equal(progressOf({}), 0);
  assert.equal(progressOf(undefined), 0);
});

// ── brief sign-off ─────────────────────────────────────────────────────────
// The regression these pin: the portal tested `briefStatus === "locked"`, a
// value the internal app has not written since locking became its own step. The
// Brief tab's banner was therefore stuck on "Waiting — under review by Fifth
// Avenue" for every campaign in the business, including ones already invoiced
// and paid, with no state that could ever clear it.

test("a signed-off brief reads as locked", () => {
  assert.equal(briefLockedOf({ briefStatus: "signed_off", stage: "draft" }), true);
});

test("a draft brief on a draft campaign is still under review", () => {
  assert.equal(briefLockedOf({ briefStatus: "draft", stage: "draft" }), false);
  assert.equal(briefLockedOf({}), false);
});

test("a stage past draft is proof the lock happened, whatever the flag says", () => {
  // Campaigns predating the brief-lock step never got the flag — they carry
  // "shortlisting" or nothing while their stage is well past draft. Same
  // read-time derivation as the internal app; documents are not migrated.
  for (const stage of ["brief_locked", "team_assigned", "po_raised",
                       "advance_received", "invoice_raised", "payment_done"]) {
    assert.equal(briefLockedOf({ briefStatus: "shortlisting", stage }), true, stage);
  }
});

test("retired stage ids resolve before the draft test", () => {
  // brief_log meant "team staffed, brief still being written" — it normalises
  // back to draft, so the lock is genuinely still owed.
  assert.equal(briefLockedOf({ stage: "brief_log" }), false);
  assert.equal(briefLockedOf({ stage: "execution" }), true);
  assert.equal(briefLockedOf({ stage: "completed" }), true);
});

test("an unknown stage does not fake a sign-off", () => {
  assert.equal(briefLockedOf({ stage: "who_knows" }), false);
});

/* ── the two tracks ─────────────────────────────────────────────────────────
   A campaign runs on a stored FINANCE track (the PO, the advance, the invoice)
   and a derived DELIVERY track (creators locking, submitting, posting). The
   portal shows a brand only the second — there is no screen here on which a
   purchase order appears — but both the board column and the ring were derived
   from the first. Pronto's BAU campaign was the case that surfaced it: stage
   `team_assigned`, eleven creators locked, seven live, 2.5M views, and a card
   that read "Shortlisting · 16%". These pin the split. */

// Eleven locked, concepts and demos all in, seven of eleven posted.
const bau = {
  stage: "team_assigned",
  numReq: 11,
  creators: Array.from({ length: 11 }, (_, i) => ({
    status: "locked",
    concept: { status: "locked" },
    demo: { status: "locked" },
    live: { postUrls: i < 7 ? ["https://instagram.com/reel/x"] : [] },
  })),
};

test("the portal never claims a campaign is further along than its stage", () => {
  // The internal board reads BAU's chip off the same field: "Team Assigned".
  // The portal must say the same thing, whatever its roster has been up to.
  assert.equal(campaignPhaseOf(bau), "shortlist");
  assert.equal(phaseOf("team_assigned"), "shortlist");
  // Posts being up does not move it, and nor does a fully delivered roster.
  const allPosted = {
    stage: "team_assigned",
    creators: [{ status: "locked", concept: { status: "locked" }, demo: { status: "locked" }, live: { postUrls: ["u"] } }],
  };
  assert.equal(campaignPhaseOf(allPosted), "shortlist");
});

test("the two tracks keep their own numbers and are free to disagree", () => {
  // 16 on the stage, 82 on the work — both true of the same campaign, which is
  // the whole reason they are two figures and not one.
  assert.equal(progressOf(bau), 16);
  assert.equal(commercialProgressOf(bau), 16);
  assert.ok(deliveryProgressOf(bau) > 70, `got ${deliveryProgressOf(bau)}`);
  // A campaign nobody has locked a creator on reports no delivery, rather than
  // borrowing the stage's number and implying work that hasn't started.
  assert.equal(deliveryProgressOf({ stage: "brief_locked", creators: [] }), 0);
  assert.equal(progressOf({ stage: "brief_locked", creators: [] }), 8);
});

test("the stage answers, and a roster cannot talk it up or down", () => {
  assert.equal(progressOf({ stage: "draft", creators: [] }), 0);
  // A settled campaign reads 100 whatever its roster looks like.
  assert.equal(progressOf({ stage: "payment_done", creators: [{ status: "locked", live: {} }] }), 100);
  // And a busy roster on an early stage does not inflate it.
  assert.equal(progressOf({ stage: "draft", creators: [{ status: "locked", live: { postUrls: ["u"] } }] }), 0);
});

test("a stage-only caller gets exactly the old behaviour", () => {
  // lib/api.js re-exports phaseOf for callers holding nothing but a stage
  // string; passing no delivery reading must not change what they get.
  for (const stage of Object.keys(STAGE_TO_PHASE)) {
    assert.equal(phaseOf(stage), STAGE_TO_PHASE[stage]);
    assert.equal(phaseOf(stage, undefined), STAGE_TO_PHASE[stage]);
  }
});
