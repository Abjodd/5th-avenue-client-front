// Campaign phase registry — single source for the pipeline stages.
// Every page renders these five phases; none may define its own copy.

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
