// Campaign phase registry — single source for the pipeline stages, and for the
// mapping from the backend's internal 16-stage pipeline down to them.
// Every page renders these five phases; none may define its own copy.
//
// The stage→phase table used to live in lib/api.js, which meant importing the
// fetch client (and with it `import.meta.env`) just to ask what phase a
// campaign is in — enough to make lib/portalMetrics.js unusable outside a
// bundler. It's phase logic, so it lives with the phases; api.js re-exports it
// for the modules that already imported it from there.

export const PHASES = [
  { id: "brief",      label: "Brief & Strategy", short: "Brief",        icon: "📋" },
  { id: "shortlist",  label: "Shortlisting",     short: "Shortlisting", icon: "🔍" },
  { id: "production", label: "Production",       short: "Production",   icon: "🎬" },
  { id: "live",       label: "Live",             short: "Live",         icon: "🟢" },
  { id: "completed",  label: "Completed",        short: "Completed",    icon: "✅" },
];

export const PHASE_LABELS = Object.fromEntries(PHASES.map(p => [p.id, p.short]));

// Phase → colour, resolved against the theme palette P (context.js LIGHT)
export const phaseColors = (P) => ({
  brief: P.mute, shortlist: P.amber, production: P.accent, live: P.green, completed: P.doneTxt,
});

// The backend stores the internal pipeline stage on each campaign; the portal
// shows clients this simpler 5-phase view.
//
// This table listed ONLY the retired stage ids. The internal pipeline was
// forked into a stored finance track (draft → brief_locked → team_assigned →
// po_raised → advance_received → invoice_raised → payment_done) with delivery
// re-derived from the creators, and none of the new ids were added here. Since
// phaseOf() falls back to "brief" for anything it doesn't recognise, every
// campaign created after that fork was shown to the client as "Brief &
// Strategy" no matter how far along it actually was — and because "brief" is
// not "completed", a fully paid campaign also kept counting as active in the
// headline KPIs and the health ring.
//
// Both id sets are mapped here. The retired ids stay because campaigns are not
// migrated on read — a document keeps whatever stage it was last saved with.
export const STAGE_TO_PHASE = {
  // ── current forked pipeline ──
  draft: "brief",
  brief_locked: "brief",
  team_assigned: "shortlist",
  po_raised: "shortlist",
  advance_received: "production",
  invoice_raised: "live",
  payment_done: "completed",
  // ── retired ids, still on unmigrated documents ──
  brief_log: "brief",
  creator_shortlist: "shortlist",
  po: "shortlist",
  advance: "shortlist",
  execution: "production",
  brief_sent: "production",
  concept_submitted: "production",
  concept_approved: "production",
  production: "production",
  video_submitted: "production",
  internal_review: "production",
  client_approved: "production",
  live: "live",
  creator_paid: "live",
  reporting: "live",
  completed: "completed",
};

export const phaseOf = (stage) => STAGE_TO_PHASE[stage] || "brief";

// Percentage a campaign reads on entering each stored stage. Mirrors the `p`
// column of PIPELINE in the internal app's src/lib/campaign.js — the two must
// agree, or the client portal and the internal board report different progress
// for the same campaign.
const STAGE_PROGRESS = {
  draft: 0, brief_locked: 8, team_assigned: 16, po_raised: 35,
  advance_received: 55, invoice_raised: 80, payment_done: 100,
};

// Retired id → its equivalent on the forked track, so old documents still get
// a sensible percentage. Mirrors LEGACY_STAGE in the internal app.
const LEGACY_TO_STAGE = {
  brief_log: "draft", creator_shortlist: "draft", po: "team_assigned",
  advance: "po_raised", execution: "advance_received", reporting: "advance_received",
  brief_sent: "advance_received", concept_submitted: "advance_received",
  concept_approved: "advance_received", production: "advance_received",
  video_submitted: "advance_received", internal_review: "advance_received",
  client_approved: "advance_received", live: "advance_received",
  creator_paid: "advance_received", completed: "payment_done",
};

/**
 * How far along a campaign is, 0–100.
 *
 * `progress` used to be written onto the campaign document, and the portal
 * read it directly. It is now derived from the stage on the internal side and
 * is no longer written, so campaigns created since read `undefined` — which
 * the portal was turning into 0. That is how a campaign sitting at "Invoice
 * Raised" reported a health score of 0%: not a campaign in trouble, a field
 * that stopped being stored.
 *
 * A stored value still wins where one exists, so campaigns that predate the
 * change keep the number they were last saved with.
 */
export function progressOf(campaign) {
  const stored = Number(campaign?.progress);
  if (Number.isFinite(stored)) return Math.min(100, Math.max(0, stored));
  const stage = campaign?.stage;
  const p = STAGE_PROGRESS[stage] ?? STAGE_PROGRESS[LEGACY_TO_STAGE[stage]];
  return p ?? 0;
}
