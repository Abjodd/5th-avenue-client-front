/**
 * Unit tests for lib/format.js — `npm test` (node:test).
 *
 * Scoped to fmtCPV, which is the one formatter here with a rule that isn't
 * self-evident from reading it: two SIGNIFICANT digits past the leading zeros,
 * not a fixed decimal count. The same figure is printed by the Overview tile,
 * the campaign's Live Performance panel and (via its own mirror of this
 * function) the internal app's Deliverables tab, so a change in rounding here
 * makes three screens disagree about what a view cost.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { fmtCPV, fmtCPVTo } from "./format.js";

test("fmtCPV keeps two significant digits however small the rate", () => {
  // The regression this replaces: toFixed(2) rendered all three as "₹0.01".
  assert.equal(fmtCPV(0.005264), "₹0.0053");   // rounds up, never truncates
  assert.equal(fmtCPV(0.03578), "₹0.036");
  assert.equal(fmtCPV(0.00003578), "₹0.000036");
});

test("fmtCPV settles back to ordinary money at or above ₹1", () => {
  assert.equal(fmtCPV(1.25), "₹1.25");
  assert.equal(fmtCPV(12.5), "₹12.50");
  assert.equal(fmtCPV(0.1), "₹0.10");
});

test("fmtCPV distinguishes a measured zero from no measurement", () => {
  // 0 is a real rate (a campaign with no budget); null is "not computed yet"
  // and must never print as a number.
  assert.equal(fmtCPV(0), "₹0.00");
  for (const empty of [null, undefined, "", NaN, Infinity]) {
    assert.equal(fmtCPV(empty), "—");
  }
});

test("fmtCPVTo pins precision to the target, so a count-up can't jitter", () => {
  // AnimatedNumber formats every intermediate frame from 0 upward; each of
  // these would otherwise print a different decimal count and resize the tile.
  const f = fmtCPVTo(0.005264);
  assert.deepEqual([0, 0.001, 0.005264].map(f), ["₹0.0000", "₹0.0010", "₹0.0053"]);
  assert.equal(f(null), "—");
});
