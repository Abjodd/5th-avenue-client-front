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

/* ── Range presets & the hand-picked custom window ──────────────────────────
 *
 * `rangeFor` turns whatever the period control holds into the {from,to} pair
 * the analytics request is built from, so a mistake here is a mistake in every
 * figure on the Performance panel.
 *
 * Two things below have already been wrong in this code and must stay pinned:
 *
 *  · the END of a custom window is inclusive, in LOCAL time. The picker hands
 *    over calendar dates, and a brand asking for "1–25 Aug" means through the
 *    end of the 25th where they are. Taking the date at face value ends the
 *    window at 00:00 and silently drops the last day.
 *  · the fallback preset is found by INDEX. Adding "Today" to the head of
 *    RANGE_PRESETS shifted every one of them, so the fallback has to move with
 *    it or an unrecognised id starts resolving to the wrong window.
 */
import {
  RANGE_PRESETS, rangeFor, customPreset, parseCustom,
} from "./dates.js";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("customPreset and parseCustom round-trip a window", () => {
  const id = customPreset("2026-07-01", "2026-08-25");
  assert.equal(id, "custom:2026-07-01:2026-08-25");
  assert.deepEqual(parseCustom(id), { from: "2026-07-01", to: "2026-08-25" });
});

test("parseCustom returns null for a plain preset id, so presets keep their own path", () => {
  for (const p of RANGE_PRESETS) assert.equal(parseCustom(p.id), null, p.id);
});

test("parseCustom rejects anything that isn't two ISO dates", () => {
  for (const bad of [
    null, undefined, "", "custom:", "custom:2026-07-01",
    "custom:2026-7-1:2026-08-25",        // unpadded
    "custom:2026-07-01:2026-08-25:extra",
    "custom:not-a-date:2026-08-25",
    "6m",
  ]) {
    assert.equal(parseCustom(bad), null, JSON.stringify(bad));
  }
});

test("a custom window starts at local midnight on `from`", () => {
  const { from } = rangeFor(customPreset("2026-07-01", "2026-08-25"));
  assert.equal(iso(from), "2026-07-01");
  assert.equal(from.getHours(), 0);
  assert.equal(from.getMinutes(), 0);
  assert.equal(from.getSeconds(), 0);
});

test("a custom window ENDS INCLUSIVELY, at the last instant of `to` in local time", () => {
  const { to } = rangeFor(customPreset("2026-07-01", "2026-08-25"));
  assert.equal(iso(to), "2026-08-25", "still the 25th locally, not rolled into the 26th");
  assert.equal(to.getHours(), 23);
  assert.equal(to.getMinutes(), 59);
  assert.equal(to.getSeconds(), 59);
});

test("the same date at both ends means that whole day, not a zero-width window", () => {
  const { from, to } = rangeFor(customPreset("2026-08-25", "2026-08-25"));
  assert.ok(to > from, "an empty window would report every metric as zero");
  // One full day, minus the single millisecond the end is short of midnight.
  assert.equal(to - from, 86400000 - 1);
});

test("an unrecognised preset id falls back to Last 3 months", () => {
  // Pinned by LABEL, not by index: the point of the test is to catch the
  // fallback drifting when RANGE_PRESETS is reordered or added to.
  const now = new Date(2026, 7, 26, 12, 0, 0); // 26 Aug 2026, local
  const { from } = rangeFor("no-such-preset", now);
  const threeMonths = rangeFor("3m", now);
  assert.equal(+from, +threeMonths.from);
});

test("every preset resolves to a window ending now and starting no later", () => {
  const now = new Date(2026, 7, 26, 12, 0, 0);
  for (const p of RANGE_PRESETS) {
    const { from, to } = rangeFor(p.id, now);
    assert.equal(+to, +now, `${p.id} should run up to now`);
    assert.ok(from <= to, `${p.id} starts after it ends`);
  }
});

test("Today starts at local midnight, so it cannot reach back into yesterday", () => {
  const now = new Date(2026, 7, 26, 0, 30, 0); // 00:30 local — the UTC trap
  const { from } = rangeFor("1d", now);
  assert.equal(iso(from), "2026-08-26");
  assert.equal(from.getHours(), 0);
});

test("preset ids are unique — the control looks them up by id", () => {
  const ids = RANGE_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
