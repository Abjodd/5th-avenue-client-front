/**
 * Unit tests for toViewCampaign's brief mapping — `npm test` (node:test).
 *
 * Pinned here because the shape of a brief field is NOT stable on the internal
 * side. `deliverables` is stored as a LIST (["Reel — Collab", "Reel —
 * Non-Collab"]) while its neighbours are plain strings, and React renders an
 * array of strings by concatenating them with nothing in between — so every
 * Pronto campaign's brief read "Reel — CollabReel — Non-Collab" to the brand,
 * on the one screen that is supposed to be their own words back to them.
 *
 * It survived review because the failure is invisible to types and to any
 * fixture written by hand from the field NAMES: a string flows through
 * perfectly. Only the real payload has the array in it. These tests stand in
 * for that payload.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { toViewCampaign } from "./mapping.js";

/* The full brief rides on lockedBrief/pendingBrief depending on whether
   Fifth Avenue has signed it off; the view's own `brief` field is just the
   objective, used as the card summary. Tests want whichever holds it. */
const fullBrief = (c) => {
  const v = toViewCampaign(c);
  return { brief: v.lockedBrief ?? v.pendingBrief, summary: v.brief };
};

const campaign = (brief) => ({
  id: "c1", name: "August 2026", client: "Pronto", service: "Influencer Marketing",
  stage: "invoice_raised", start: "2026-08-01", end: "2026-08-31",
  budget: 95700, creators: [], brief,
});

test("a brief field stored as a LIST renders as separated text, not run together", () => {
  const { brief } = fullBrief(campaign({
    objective: "BAU Campaign",
    deliverables: ["Reel — Collab", "Reel — Non-Collab"],
  }));
  assert.equal(brief.deliverables, "Reel — Collab · Reel — Non-Collab");
  assert.doesNotMatch(brief.deliverables, /CollabReel/, "the two items must not be glued together");
});

test("a brief field stored as a string is passed through untouched", () => {
  const { brief } = fullBrief(campaign({
    objective: "BAU Campaign",
    deliverables: "4 reels",
  }));
  assert.equal(brief.deliverables, "4 reels");
  assert.equal(brief.objective, "BAU Campaign");
});

test("every brief text field tolerates a list — they share one shape upstream", () => {
  const { brief } = fullBrief(campaign({
    objective: ["Drive trial", "Build recall"],
    audience: ["18-24", "tier-1 metros"],
    messages: ["Fast", "Tasty"],
    deliverables: ["Reel"],
    timeline: ["Aug 2026"],
  }));
  assert.equal(brief.objective, "Drive trial · Build recall");
  assert.equal(brief.targetAudience, "18-24 · tier-1 metros");
  assert.equal(brief.keyMessages, "Fast · Tasty");
  assert.equal(brief.timeline, "Aug 2026");
});

test("empty entries in a list are dropped rather than printed as stray separators", () => {
  const { brief } = fullBrief(campaign({ deliverables: ["Reel", "", null, "  ", "Story"] }));
  assert.equal(brief.deliverables, "Reel · Story");
});

test("a missing brief field is empty, never the string 'undefined'", () => {
  const { brief } = fullBrief(campaign({ objective: "Only this one" }));
  assert.equal(brief.deliverables, "");
  assert.equal(brief.keyMessages, "");
});

test("no brief at all leaves the view's brief null, so the tab can say so", () => {
  const v = toViewCampaign(campaign(null));
  assert.equal(v.lockedBrief, null);
  assert.equal(v.pendingBrief, null);
});

test("the card's objective summary is guarded against a list too", () => {
  const { summary } = fullBrief(campaign({ objective: ["Drive trial", "Build recall"] }));
  assert.equal(summary, "Drive trial · Build recall");
});

test("budget falls back to the campaign's own figure when the brief omits it", () => {
  const { brief } = fullBrief(campaign({ objective: "x", budget: "" }));
  assert.equal(brief.budget, "₹95,700");
});
