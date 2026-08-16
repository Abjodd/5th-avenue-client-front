/**
 * Unit tests for growthSeries() in lib/portalMetrics.js — `npm test`.
 *
 * The behaviour worth pinning is carry-forward. Creator histories are
 * cumulative but sampled independently, so the naive "sum whatever points
 * exist on this day" produces a campaign total that falls whenever a creator
 * simply wasn't refreshed — a collapse the brand never had.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { growthSeries, growthByCreator, growthAcross } from "./portalMetrics.js";

const pt = (day, views, likes = 0) => ({
  at: `${day}T20:00:00.000Z`, views, likes, comments: 0, forwards: 0, posts: 1,
});
const creator = (name, points) => ({ name, tracking: { history: points } });

test("no tracking history at all yields no series", () => {
  assert.deepEqual(growthSeries([]), []);
  assert.deepEqual(growthSeries([{ name: "A", tracking: null }]), []);
  assert.deepEqual(growthSeries([{ name: "A", tracking: { history: [] } }]), []);
});

test("a single day of readings is not a growth chart", () => {
  // One point cannot show growth; the caller hides the tab rather than
  // drawing a lone dot.
  assert.deepEqual(growthSeries([creator("A", [pt("2026-08-01", 100)])]), []);
});

test("one creator's cumulative series comes through in order", () => {
  const s = growthSeries([creator("A", [
    pt("2026-08-01", 100), pt("2026-08-02", 250), pt("2026-08-03", 400),
  ])]);
  assert.deepEqual(s.map(r => r.date), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.deepEqual(s.map(r => r.views), [100, 250, 400]);
});

test("creators sampled on different days are carried forward, not zeroed", () => {
  // A was measured on the 1st and 3rd, B only on the 2nd. On the 2nd, A has
  // not vanished — it still has its 100 views.
  const s = growthSeries([
    creator("A", [pt("2026-08-01", 100), pt("2026-08-03", 300)]),
    creator("B", [pt("2026-08-02", 50)]),
  ]);
  assert.deepEqual(s.map(r => r.date), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.deepEqual(s.map(r => r.views), [
    100, // only A has reported yet
    150, // A carried forward (100) + B's first reading (50)
    350, // A's new reading (300) + B carried forward (50)
  ]);
});

test("the campaign total never goes down", () => {
  // The property that matters: a cumulative metric that dips is always a bug.
  const s = growthSeries([
    creator("A", [pt("2026-08-01", 1000), pt("2026-08-05", 4000)]),
    creator("B", [pt("2026-08-02", 20), pt("2026-08-03", 900), pt("2026-08-04", 1500)]),
    creator("C", [pt("2026-08-03", 7), pt("2026-08-05", 90)]),
  ]);
  const views = s.map(r => r.views);
  views.forEach((v, i) => {
    if (i) assert.ok(v >= views[i - 1], `day ${s[i].date} fell from ${views[i - 1]} to ${v}`);
  });
});

test("a creator whose first reading comes late contributes nothing before it", () => {
  const s = growthSeries([
    creator("A", [pt("2026-08-01", 100), pt("2026-08-02", 200)]),
    creator("B", [pt("2026-08-02", 500)]),
  ]);
  assert.equal(s[0].views, 100, "B has no reading yet and must not be counted as 0 or as 500");
  assert.equal(s[1].views, 700);
});

test("several refreshes on one day collapse to that day's standing total", () => {
  const s = growthSeries([creator("A", [
    { at: "2026-08-01T06:00:00.000Z", views: 10, likes: 1, comments: 0, forwards: 0 },
    { at: "2026-08-01T21:00:00.000Z", views: 90, likes: 9, comments: 0, forwards: 0 },
    pt("2026-08-02", 120, 12),
  ])]);
  assert.equal(s.length, 2, "one row per day");
  assert.equal(s[0].views, 90, "the last reading of the day is the day's total");
});

test("engagements sum likes, comments and forwards", () => {
  const s = growthSeries([creator("A", [
    { at: "2026-08-01T20:00:00.000Z", views: 10, likes: 5, comments: 3, forwards: 2 },
    { at: "2026-08-02T20:00:00.000Z", views: 20, likes: 9, comments: 4, forwards: 7 },
  ])]);
  assert.equal(s[0].engagements, 10);
  assert.equal(s[1].engagements, 20);
});

test("out-of-order stored points are still read chronologically", () => {
  // Nothing guarantees array order after a merge, so the series sorts by `at`.
  const s = growthSeries([creator("A", [
    pt("2026-08-03", 400), pt("2026-08-01", 100), pt("2026-08-02", 250),
  ])]);
  assert.deepEqual(s.map(r => r.views), [100, 250, 400]);
});

test("null metrics count as zero rather than poisoning the sum with NaN", () => {
  const s = growthSeries([creator("A", [
    { at: "2026-08-01T20:00:00.000Z", views: 10, likes: null, comments: null, forwards: null },
    { at: "2026-08-02T20:00:00.000Z", views: 30, likes: null, comments: null, forwards: null },
  ])]);
  assert.equal(s[1].views, 30);
  assert.equal(s[1].engagements, 0);
  assert.ok(!Number.isNaN(s[1].engagements));
});

/* ── per-creator split ─────────────────────────────────────────────────────── */

test("each creator gets their own keyed series", () => {
  const { rows, series } = growthByCreator([
    creator("Asha", [pt("2026-08-01", 100), pt("2026-08-02", 300)]),
    creator("Bhavin", [pt("2026-08-01", 10), pt("2026-08-02", 25)]),
  ]);
  assert.deepEqual(series.map(s => s.name), ["Asha", "Bhavin"]);
  assert.deepEqual(series.map(s => s.key), ["c0", "c1"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].c0_views, 300);
  assert.equal(rows[1].c1_views, 25);
});

test("creators sharing a display name still get separate lines", () => {
  // Keys are positional precisely so this cannot collapse into one line.
  const { series, rows } = growthByCreator([
    creator("Same Name", [pt("2026-08-01", 5), pt("2026-08-02", 9)]),
    creator("Same Name", [pt("2026-08-01", 50), pt("2026-08-02", 90)]),
  ]);
  assert.equal(series.length, 2);
  assert.notEqual(series[0].key, series[1].key);
  assert.equal(rows[1].c0_views, 9);
  assert.equal(rows[1].c1_views, 90);
});

test("a creator is absent from rows before their first reading, not zero", () => {
  // undefined makes recharts start the line at the first real point; 0 would
  // draw a climb from a baseline the creator was never at.
  const { rows } = growthByCreator([
    creator("Early", [pt("2026-08-01", 100), pt("2026-08-03", 300)]),
    creator("Late", [pt("2026-08-02", 40), pt("2026-08-03", 60)]),
  ]);
  assert.equal(rows[0].c1_views, undefined, "Late has no reading on day one");
  assert.equal(rows[1].c1_views, 40);
});

test("per-creator values carry forward on unmeasured days", () => {
  const { rows } = growthByCreator([
    creator("A", [pt("2026-08-01", 100), pt("2026-08-03", 300)]),
    creator("B", [pt("2026-08-02", 40)]),
  ]);
  assert.equal(rows[1].c0_views, 100, "A carried across the day it wasn't measured");
  assert.equal(rows[2].c1_views, 40, "B carried forward to the last day");
});

test("per-creator series sum to the combined series", () => {
  // The two views must never disagree — they share carriedByDay().
  const creators = [
    creator("A", [pt("2026-08-01", 100), pt("2026-08-03", 300)]),
    creator("B", [pt("2026-08-02", 40), pt("2026-08-03", 60)]),
  ];
  const combined = growthSeries(creators);
  const { rows, series } = growthByCreator(creators);
  rows.forEach((row, i) => {
    const summed = series.reduce((s, sr) => s + (row[`${sr.key}_views`] || 0), 0);
    assert.equal(summed, combined[i].views, `day ${row.date}`);
  });
});

test("no history yields an empty split, matching growthSeries", () => {
  assert.deepEqual(growthByCreator([]), { rows: [], series: [] });
  assert.deepEqual(growthByCreator([creator("A", [pt("2026-08-01", 5)])]), { rows: [], series: [] });
});

/* ── growthAcross: the Overview page's account-wide roll-up ───────────────── */

const campaign = (id, creators) => ({ id, creators });

test("account growth carries forward per creator, not per campaign", () => {
  // The bug this pins: summing each campaign's own series would carry B's
  // campaign forward from its first measured day only, so day 1 would count
  // B at 0 and day 2 would jump by B's whole total — inventing a spike. Per
  // creator, B simply has no reading until the 2nd and A holds its 100.
  const across = growthAcross([
    campaign("c1", [creator("A", [pt("2026-08-01", 100), pt("2026-08-03", 300)])]),
    campaign("c2", [creator("B", [pt("2026-08-02", 40), pt("2026-08-03", 60)])]),
  ]);
  assert.deepEqual(across.points.map(p => p.date), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.deepEqual(across.points.map(p => p.views), [100, 140, 360]);
  assert.equal(across.creators, 2);
  assert.equal(across.campaigns, 2);
});

test("account growth matches growthSeries over one campaign's roster", () => {
  // The Overview and a campaign's own Growth tab must never disagree when the
  // brand has exactly one campaign.
  const creators = [
    creator("A", [pt("2026-08-01", 100), pt("2026-08-02", 250)]),
    creator("B", [pt("2026-08-01", 10), pt("2026-08-02", 30)]),
  ];
  assert.deepEqual(growthAcross([campaign("c1", creators)]).points, growthSeries(creators));
});

test("account growth reports counts even with nothing to plot yet", () => {
  // One day of readings: no chart, but the panel still says what is tracked
  // rather than claiming nothing is.
  const across = growthAcross([campaign("c1", [creator("A", [pt("2026-08-01", 100)])])]);
  assert.deepEqual(across.points, []);
  assert.equal(across.creators, 1);
  assert.equal(across.campaigns, 1);

  const none = growthAcross([]);
  assert.deepEqual(none, { points: [], creators: 0, campaigns: 0 });
});
