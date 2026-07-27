/* All landing-page copy in one place. The DashboardTour steps encode the
   client's own answer to "what problems does the dashboard solve". */

export const HERO = {
  eyebrow: "Est. MMXXVI — Full-service marketing",
  wordmark: ["Fifth", "Avenue"],
  // rendered with the last word in italic serif
  headline: ["Marketing that", "compounds."],
  lede: "Influencer, AI-search, performance and regional campaigns — run by one team, on one calm dashboard where all of it adds up.",
  primaryCta: { label: "Start a project", href: "#contact" },
  secondaryCta: { label: "Explore the platform", href: "#dashboard" },
};

export const METRICS = [
  { value: 26.5, suffix: "M", label: "Audience reached" },
  { value: 77, suffix: "", label: "Creators engaged" },
  { value: 22, suffix: "", label: "Campaigns delivered" },
  { value: 83.5, prefix: "₹", suffix: "L", label: "Media managed" },
];

export interface TourStep {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  scene: "kanban" | "analytics" | "goals" | "map" | "billing" | "roadmap";
  soon?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "truth",
    eyebrow: "01 — One source of truth",
    title: "Out of the group chat, onto one board.",
    body: "Campaign status, deliverables and approvals stop living across WhatsApp, email and spreadsheets. Every campaign moves through five visible phases — briefs sign off in the open, creators lock with a two-sided approval, and nothing stalls silently.",
    scene: "kanban",
  },
  {
    id: "proof",
    eyebrow: "02 — Proof, not promises",
    title: "See what your spend returns. Live.",
    body: "Reach, engagement and cost roll up from creator-level data you can slice by niche, size, region and language. Auto-insights flag what to scale, investigate or pause — before your monthly review does.",
    scene: "analytics",
  },
  {
    id: "goals",
    eyebrow: "03 — Every wing, one goal",
    title: "Tag any campaign to a business goal.",
    body: "Influencer, AI search, paid ads, web — separate wings of marketing usually report separately. Here every campaign, whatever its service, is tagged to a goal you set. The dashboard shows how each wing contributes, so marketing compounds toward outcomes instead of scattering.",
    scene: "goals",
  },
  {
    id: "regional",
    eyebrow: "04 — Regional clarity",
    title: "Know where your brand is winning. And where it isn't.",
    body: "A live map of India shows performance state by state — campaigns, creators, reach and budget per region. Spot underserved markets and act on them with regional creators who already speak the language.",
    scene: "map",
  },
  {
    id: "ops",
    eyebrow: "05 — Operations without friction",
    title: "Approvals that move. Billing that explains itself.",
    body: "Structured sign-offs replace email loops, and every invoice arrives itemised with autopay, UPI and full payment history. You always know what's pending, what's paid and what it bought.",
    scene: "billing",
  },
  {
    id: "next",
    eyebrow: "06 — In development",
    title: "Market Intelligence & Market Planning.",
    body: "Coming to the same dashboard: a dedicated intelligence surface blending AI signals with our strategists' judgment, and goal-based planning that helps orchestrate the right next quarter — not just report the last one.",
    scene: "roadmap",
    soon: true,
  },
];

export const NETWORK = {
  eyebrow: "Regional creator network",
  title: "Authentic voices, in every language your market speaks.",
  body: "National influencers buy you attention. Regional creators buy you trust. Our network spans every Indian state — food reviewers in Chennai, storytellers in Guwahati, home cooks in Indore — matched to campaigns by language, niche and audience.",
  applyCta: "Apply as Creator",
  exploreCta: "Explore the network",
};

export const CTA_BAND = {
  statement: "Let's build your next quarter.",
  sub: "Tell us the goal. We'll bring the plan, the creators and the dashboard.",
  primary: "Start a project",
  secondary: "contact@fifth-avenue.in",
};
