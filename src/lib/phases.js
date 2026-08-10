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

// The backend stores the internal 16-stage pipeline stage on each campaign;
// the portal shows clients this simpler 5-phase view.
export const STAGE_TO_PHASE = {
  draft: "brief",
  creator_shortlist: "shortlist",
  po_raised: "shortlist",
  advance_received: "shortlist",
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
