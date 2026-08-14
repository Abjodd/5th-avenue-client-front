/**
 * Unit tests for lib/dates.js buildTimeSeries — `npm test` (node:test).
 *
 * The behaviour worth pinning here is `trimLeading`: the Reach vs Spend chart
 * has to start where the data starts, not at the left edge of whatever period
 * the reader selected. Getting that wrong is not a cosmetic bug — leading zero
 * buckets are real points to the y-axis, so they both invent a collapse that
 * never happened and squash the scale of the part that has data in it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTimeSeries, bucketStart, nextBucket, bucketLabel } from "./dates.js";

const d = (iso) => new Date(`${iso}T00:00:00`);
const FIELDS = ["spend", "reach"];

// A six-month window in which nothing happens until month four.
const FROM = d("2026-01-01");
const TO = d("2026-06-15");
const EVENTS = [
  { date: d("2026-04-10"), spend: 100, reach: 1000 },
  { date: d("2026-06-02"), spend: 300, reach: 3000 },
];

test("without trimLeading, the window is reported in full", () => {
  const s = buildTimeSeries(EVENTS, { from: FROM, to: TO }, "monthly", FIELDS);
  assert.equal(s.length, 6, "Jan..Jun");
  assert.equal(s[0].label, "Jan '26");
  assert.equal(s[0].spend, 0);
  assert.equal(s[0].count, 0);
});

test("trimLeading starts the series at the first bucket with activity", () => {
  const s = buildTimeSeries(EVENTS, { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true });
  assert.equal(s.length, 3, "Apr, May, Jun — Jan-Mar dropped");
  assert.equal(s[0].label, "Apr '26");
  assert.equal(s[0].spend, 100);
  assert.equal(s[0].reach, 1000);
});

test("trimLeading keeps empty buckets in the MIDDLE — a quiet month is real", () => {
  const s = buildTimeSeries(EVENTS, { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true });
  assert.equal(s[1].label, "May '26");
  assert.equal(s[1].count, 0, "May had no campaigns and must still be plotted");
  assert.equal(s[2].spend, 300, "June still lands after the gap");
});

test("trimLeading keeps TRAILING empties — the current period is still filling in", () => {
  const s = buildTimeSeries(
    [{ date: d("2026-04-10"), spend: 100, reach: 1000 }],
    { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true },
  );
  assert.equal(s.length, 3, "Apr, May, Jun");
  assert.equal(s[s.length - 1].label, "Jun '26");
});

test("with no events at all, the empty frame survives rather than becoming []", () => {
  // The chart distinguishes "no data for this period" (draw axes, say so) from
  // an empty array, which would flip it to a different panel entirely.
  const s = buildTimeSeries([], { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true });
  assert.equal(s.length, 6);
  assert.ok(s.every((r) => r.count === 0));
});

test("an event in the very first bucket trims nothing", () => {
  const s = buildTimeSeries(
    [{ date: d("2026-01-04"), spend: 5, reach: 50 }, ...EVENTS],
    { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true },
  );
  assert.equal(s.length, 6);
  assert.equal(s[0].spend, 5);
});

test("events outside the window are ignored, and cannot anchor the trim", () => {
  const s = buildTimeSeries(
    [{ date: d("2025-11-01"), spend: 999, reach: 999 }, ...EVENTS],
    { from: FROM, to: TO }, "monthly", FIELDS, { trimLeading: true },
  );
  assert.equal(s[0].label, "Apr '26");
  assert.ok(s.every((r) => r.spend !== 999), "the out-of-range event is not summed anywhere");
});

test("weekly buckets trim on the same rule", () => {
  const s = buildTimeSeries(
    [{ date: d("2026-01-29"), spend: 7, reach: 70 }],
    { from: d("2026-01-01"), to: d("2026-02-05") }, "weekly", FIELDS, { trimLeading: true },
  );
  assert.equal(s[0].count, 1, "series opens on the week the event lands in");
  assert.equal(s[0].spend, 7);
});

test("bucketStart/nextBucket/bucketLabel agree on weekly boundaries (Monday-start)", () => {
  // Underpins the trimming above: if bucketStart disagreed with the loop in
  // buildTimeSeries, events would land in buckets the series never created and
  // the trim would drop everything.
  const thu = d("2026-01-29"); // a Thursday
  const start = bucketStart(thu, "weekly");
  assert.equal(start.getDay(), 1, "weeks start Monday");
  assert.ok(start <= thu);
  assert.ok(nextBucket(start, "weekly") > thu);
  assert.equal(bucketLabel(start, "weekly"), "Jan 26");
});
