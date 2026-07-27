/* The 16 services shown on the landing page, grouped for the editorial index. */

export interface Service {
  index: string;
  group: string;
  name: string;
  blurb: string;
  tags: string[];
}

export interface ServiceGroup {
  id: string;
  label: string;
  services: Service[];
}

const g = (
  group: string,
  items: Array<[string, string, string[]]>,
  startAt: number,
): Service[] =>
  items.map(([name, blurb, tags], i) => ({
    index: String(startAt + i).padStart(2, "0"),
    group,
    name,
    blurb,
    tags,
  }));

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: "growth",
    label: "Growth",
    services: g(
      "Growth",
      [
        ["Influencer Marketing", "Creator campaigns matched to your audience — from nano to celebrity, briefed, approved and tracked in one place.", ["Creator matching", "Dual approvals", "Live tracking"]],
        ["Performance Marketing", "Paid media that answers to revenue, not impressions. Meta, Google and programmatic under one ledger.", ["Meta & Google", "CPA-driven", "Attribution"]],
        ["SEO", "Technical and editorial search work that compounds — architecture, content and authority.", ["Technical audits", "Content ops", "Authority"]],
        ["AI Search Optimization", "Be the answer when AI engines respond. AEO for Google AI, Perplexity and ChatGPT surfaces.", ["AEO", "Featured answers", "Schema"]],
      ],
      1,
    ),
  },
  {
    id: "brand",
    label: "Brand & Content",
    services: g(
      "Brand & Content",
      [
        ["Branding", "Identity systems built to survive a decade — strategy, voice, and visual language.", ["Identity", "Positioning", "Guidelines"]],
        ["Content Creation", "An always-on content engine: reels, carousels, stories and long-form, produced on cadence.", ["Reels", "Editorial", "Cadence"]],
        ["Creative Design", "Campaign craft — key visuals, packaging moments and platform-native design.", ["Key visuals", "Campaign kits", "Platform-native"]],
        ["Video Production", "Concept to color grade. Product films, creator collabs and performance cuts.", ["Product films", "Edit suites", "Performance cuts"]],
      ],
      5,
    ),
  },
  {
    id: "creators",
    label: "Creators & Community",
    services: g(
      "Creators & Community",
      [
        ["Creator Campaign Management", "Shortlists, negotiations, briefs, usage rights and payments — managed end to end.", ["Shortlisting", "Usage rights", "Payouts"]],
        ["Community Building", "Owned audiences that outlast algorithms — groups, ambassadors, advocacy loops.", ["Ambassadors", "Advocacy", "Retention"]],
        ["Social Media Management", "Channels run like products: calendars, community response and monthly learning loops.", ["Calendars", "Community", "Reporting"]],
        ["Custom Marketing Solutions", "Regional launches, offline activations, category experiments — built to your brief.", ["Regional", "Activations", "Bespoke"]],
      ],
      9,
    ),
  },
  {
    id: "intelligence",
    label: "Intelligence & Ops",
    services: g(
      "Intelligence & Ops",
      [
        ["Analytics & Reporting", "One dashboard for every wing — reach, engagement, spend and ROI in live numbers.", ["Live dashboards", "ROI", "Auto-insights"]],
        ["Marketing Strategy", "Goal-based planning across services — where to spend the next rupee and why.", ["Goal planning", "Mix modeling", "Quarterly"]],
        ["Marketing Automation", "Journeys, triggers and CRM flows that follow up while you sleep.", ["Journeys", "CRM flows", "Triggers"]],
        ["Website Design & Development", "Fast, handsome, conversion-honest sites — engineered, not templated.", ["Design", "Engineering", "CRO"]],
      ],
      13,
    ),
  },
];

export const ALL_SERVICES = SERVICE_GROUPS.flatMap((grp) => grp.services);
