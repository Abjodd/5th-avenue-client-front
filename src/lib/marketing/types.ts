/* Types for the public marketing site's regional/international map data.
   Extracted from the landing repo's monolithic lib/types.ts — the rest of that
   file described the mock portal and was dropped in the merge. The phase names
   below intentionally match the 5-phase client view in lib/phases.js. */

export type CampaignPhase =
  | "brief"
  | "shortlist"
  | "production"
  | "live"
  | "completed";

/* ── Regional map ── */
export type RegionId =
  | "north"
  | "south"
  | "west"
  | "east"
  | "northeast"
  | "central";

export interface StateMeta {
  name: string;
  region: RegionId;
  lang: string;
}

export interface StateData {
  c: number;
  r: string;
  cr: number;
  b: string;
}

export interface RegionCampaign {
  id: number;
  n: string;
  s: string;
  p: CampaignPhase;
  pr: number;
  r: string;
  b: string;
  /** true when this id resolves to a canonical Campaign (deep-linkable) */
  linked: boolean;
}

export interface RegionMetrics {
  c: number;
  r: string;
  cr: number;
  b: string;
  e: string;
  i: string;
  v: string;
}

export interface RegionData {
  id: RegionId;
  name: string;
  m: RegionMetrics;
  camps: RegionCampaign[];
}

/** Per-state drill detail for the public Network page (creators worked with,
    campaigns executed). Only active states carry an entry. */
export interface StateCampaign {
  name: string;
  reach: string;
  phase: CampaignPhase;
}

export interface StateDetail {
  creators: string[];
  campaigns: StateCampaign[];
  note?: string;
}

/** International markets — the "beyond India" section on the Network page. */
export interface IntlMarket {
  id: string;
  city: string;
  country: string;
  reach: string;
  creators: number;
  langs: string[];
  campaigns: StateCampaign[];
}
