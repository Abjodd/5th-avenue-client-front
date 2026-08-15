/**
 * How complete is this account's profile, and what is missing from it.
 *
 * ── What counts, and what deliberately doesn't ──────────────────────────────
 * Only fields a person would recognise as "their profile": the photo, their
 * name, their role, and the two ways to reach them. System-assigned values
 * (account id, created-at) are excluded even though the page displays them —
 * they are present on every record that exists, so counting them would add a
 * fixed block of free points to everyone's score and compress the range that
 * actually varies. A meter where nobody can score below 60% is decoration.
 *
 * ── Honesty about who can fix what ──────────────────────────────────────────
 * In this portal only the PHOTO is self-serve; name, role and contact details
 * are held by 5th Avenue and changed by an account manager. So each item
 * carries `actionable`, and the UI uses it to split "you can fix this now" from
 * "ask your account manager" — rather than showing a checklist that silently
 * implies the reader can complete all of it.
 */

/** A value counts as filled only if it is a non-empty, non-whitespace string. */
const filled = (v) => v != null && String(v).trim() !== "";

/**
 * @param user the session user (the sanitized BrandCredential + brandId/clientName)
 * @returns {{pct:number,done:number,total:number,items:Array,missing:Array}}
 */
export function profileCompletion(user) {
  const u = user || {};
  const items = [
    // `hasAvatar` rather than the image bytes: the login payload never carries
    // the photo itself (it is served from …/:id/avatar), so this flag is the
    // only thing here that knows whether one is set.
    { key: "photo", label: "Profile photo", filled: !!u.hasAvatar, actionable: true },
    { key: "name",  label: "Full name",     filled: filled(u.name),  actionable: false },
    { key: "title", label: "Role",          filled: filled(u.title), actionable: false },
    { key: "email", label: "Email address", filled: filled(u.email), actionable: false },
    { key: "phone", label: "Phone number",  filled: filled(u.phone), actionable: false },
  ];

  const done = items.filter((i) => i.filled).length;
  return {
    items,
    missing: items.filter((i) => !i.filled),
    done,
    total: items.length,
    // Rounded for display only. Callers that need "is it actually finished"
    // must compare done === total: 4 of 5 rounds to 80, but 199 of 200 would
    // round to 100 and claim completion that hasn't happened.
    pct: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}
