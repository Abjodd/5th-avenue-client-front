/* Open roles shown on the public Careers page. Self-contained — editing this
   list is the only thing needed to add/remove an opening. */

export interface Opening {
  id: string;
  title: string;
  dept: "Growth" | "Brand & Content" | "Creators & Community" | "Sales & Client" | "Intelligence & Ops";
  location: string;
  type: "Full-time" | "Contract" | "Internship";
  blurb: string;
  tags: string[];
}

export const OPENINGS: Opening[] = [
  {
    id: "performance-manager",
    title: "Performance Marketing Manager",
    dept: "Growth",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Own Meta, Google and programmatic budgets end to end — planning, buying and the CPA story behind every rupee.",
    tags: ["Meta & Google", "CPA-driven", "Attribution"],
  },
  {
    id: "aeo-strategist",
    title: "AEO / SEO Strategist",
    dept: "Growth",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Engineer brands into the answers AI engines give — technical SEO, schema and answer-engine positioning.",
    tags: ["Technical SEO", "AEO", "Schema"],
  },
  {
    id: "creative-designer",
    title: "Creative Designer",
    dept: "Brand & Content",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Key visuals, campaign kits and platform-native design for brands across India's regional markets.",
    tags: ["Key visuals", "Campaign kits", "Platform-native"],
  },
  {
    id: "business-development-executive",
    title: "Business Development Executive",
    dept: "Sales & Client",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Open doors with brands across India — prospect, pitch and close new client partnerships end to end.",
    tags: ["Prospecting", "Pitching", "Closing"],
  },
  {
    id: "crm-executive",
    title: "CRM Executive",
    dept: "Sales & Client",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Own the client relationship after the sale — onboarding, retention and the health of every account.",
    tags: ["Onboarding", "Retention", "Account health"],
  },
  {
    id: "creator-partnerships",
    title: "Creator Partnerships Associate",
    dept: "Creators & Community",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Shortlist, negotiate and brief creators across every region and language we operate in.",
    tags: ["Shortlisting", "Negotiation", "Briefing"],
  },
  {
    id: "campaign-execution-intern",
    title: "Campaign Execution Intern",
    dept: "Creators & Community",
    location: "Bangalore",
    type: "Internship",
    blurb: "Get hands-on with live campaigns — coordinate creators, track deliverables and keep every launch on schedule.",
    tags: ["Coordination", "Deliverables", "Live campaigns"],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    dept: "Intelligence & Ops",
    location: "Bangalore",
    type: "Full-time",
    blurb: "Turn campaign data from every channel into the one dashboard clients actually trust.",
    tags: ["Dashboards", "Mix modeling", "Attribution"],
  },
];

export const DEPTS = ["All", ...Array.from(new Set(OPENINGS.map((o) => o.dept)))] as const;
