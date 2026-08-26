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

import { phaseOf, progressOf, briefLockedOf, STAGE_TO_PHASE } from "./phases.js";

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
