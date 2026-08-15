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

import { phaseOf, progressOf, STAGE_TO_PHASE } from "./phases.js";

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

test("a stored progress value still wins over the derived one", () => {
  // Campaigns saved before the change carry a real number; it must not be
  // overwritten by the stage default.
  assert.equal(progressOf({ stage: "reporting", progress: 90 }), 90);
  assert.equal(progressOf({ stage: "draft", progress: 42 }), 42);
});

test("a stored zero is honoured, not treated as missing", () => {
  // The `?? 0` idiom this replaced could not tell 0 from undefined; a real
  // stored 0 must survive.
  assert.equal(progressOf({ stage: "invoice_raised", progress: 0 }), 0);
});

test("stored progress is clamped to 0..100", () => {
  assert.equal(progressOf({ stage: "draft", progress: 140 }), 100);
  assert.equal(progressOf({ stage: "draft", progress: -5 }), 0);
});

test("retired stages derive a sensible progress too", () => {
  assert.equal(progressOf({ stage: "execution" }), 55);
  assert.equal(progressOf({ stage: "completed" }), 100);
});

test("an unknown or absent stage is 0, not NaN", () => {
  // NaN would propagate through mean() and render the health ring as "NaN%".
  assert.equal(progressOf({ stage: "who_knows" }), 0);
  assert.equal(progressOf({}), 0);
  assert.equal(progressOf(undefined), 0);
});
