// src/pages/Insights.jsx — thin re-export. The page itself now lives in
// ./insightsView/ (index.jsx = shell/hero, sections.jsx = the four sections,
// primitives.jsx = the redesign's scroll/GSAP chrome, theme.js = its
// palette) — kept as a small folder rather than one file since a full
// redesign of every section pushed a single file past 1,000 lines (folder
// named insightsView, not insights, since this repo's mounted filesystem
// is case-insensitive and `./insights` resolved back to this very file).
// This re-export exists only so routes.jsx's `import("./pages/Insights")`
// keeps working unchanged.
export { default } from "./insightsView";
