/**
 * Unit tests for lib/profileCompletion — `npm test` (node:test).
 *
 * The behaviour worth pinning is that the score only ever counts fields a
 * person would recognise as their profile, and that "complete" means every
 * item is filled rather than a percentage that happens to round to 100.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { profileCompletion } from "./profileCompletion.js";

const FULL = {
  hasAvatar: true, name: "Rahul Menon", title: "Marketing Head",
  email: "rahul@freshbitefoods.com", phone: "+91 98765 43210",
};

test("a fully populated account is 100% and has nothing missing", () => {
  const r = profileCompletion(FULL);
  assert.equal(r.pct, 100);
  assert.equal(r.done, r.total);
  assert.deepEqual(r.missing, []);
});

test("a brand-new login with only an email scores low, not zero", () => {
  // What the portal actually looks like on first login: the credential always
  // carries the username it signs in with, and nothing else is required.
  const r = profileCompletion({ email: "new@brand.com" });
  assert.equal(r.done, 1);
  assert.equal(r.total, 5);
  assert.equal(r.pct, 20);
});

test("uploading a photo is what moves the ring on first login", () => {
  const before = profileCompletion({ email: "new@brand.com" });
  const after = profileCompletion({ email: "new@brand.com", hasAvatar: true });
  assert.equal(after.pct > before.pct, true);
  assert.equal(after.done, before.done + 1);
});

test("the photo is the only self-serve item", () => {
  const actionable = profileCompletion({}).items.filter((i) => i.actionable);
  assert.deepEqual(actionable.map((i) => i.key), ["photo"]);
});

test("whitespace is not a value", () => {
  // A name of " " would otherwise count as filled and quietly inflate the score.
  const r = profileCompletion({ ...FULL, name: "   ", phone: "" });
  assert.equal(r.done, 3);
  assert.deepEqual(r.missing.map((m) => m.key), ["name", "phone"]);
});

test("hasAvatar false is missing even when an avatar initials string exists", () => {
  // `avatar` holds initials for the fallback chip and is set on every record —
  // reading it instead of hasAvatar would mark everyone as having a photo.
  const r = profileCompletion({ ...FULL, hasAvatar: false, avatar: "RM" });
  assert.equal(r.items.find((i) => i.key === "photo").filled, false);
  assert.equal(r.pct, 80);
});

test("a null/undefined user does not throw and reports 0%", () => {
  for (const u of [null, undefined, {}]) {
    const r = profileCompletion(u);
    assert.equal(r.pct, 0);
    assert.equal(r.done, 0);
    assert.equal(r.total, 5);
  }
});

test("pct is for display; done/total is the completion test", () => {
  // 4 of 5 rounds to 80 so the two agree here, but the contract is that callers
  // compare done === total rather than pct === 100.
  const r = profileCompletion({ ...FULL, phone: null });
  assert.equal(r.pct, 80);
  assert.notEqual(r.done, r.total);
});
