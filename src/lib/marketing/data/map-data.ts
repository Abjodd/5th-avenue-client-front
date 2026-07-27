/* Regional map data — ported verbatim from FifthAvenue_Old RegionalMap.jsx:3-39.
   Changes from the old app:
   - Region/language colors reference theme tokens (CSS vars) where possible.
   - Campaign id reconciliation: region campaigns whose names match a canonical
     Campaign (campaigns.ts ids 1–5) carry that id and `linked: true`; the old
     app's synthetic ids (101–601) deep-linked nowhere. Unlinked camps keep
     their ids and render without a dead-end "open campaign" button. */

import type {
  IntlMarket,
  RegionData,
  RegionId,
  StateData,
  StateDetail,
  StateMeta,
} from "../types";

export const REGION_COLORS: Record<RegionId, string> = {
  north: "var(--viz-blue)",
  south: "var(--viz-green)",
  west: "var(--viz-pink)",
  east: "var(--viz-amber)",
  northeast: "var(--viz-purple)",
  central: "var(--viz-orange)",
};

export const REGION_NAMES: Record<RegionId, string> = {
  north: "North",
  south: "South",
  west: "West",
  east: "East",
  northeast: "North-East",
  central: "Central",
};

export const PHASE_LABELS: Record<string, string> = {
  brief: "Brief",
  shortlist: "Shortlisting",
  production: "Production",
  live: "Live",
  completed: "Completed",
};

export const STATES_META: Record<string, StateMeta> = {
  ch: { name: "Chandigarh", region: "north", lang: "Hindi" },
  dl: { name: "Delhi", region: "north", lang: "Hindi" },
  hp: { name: "Himachal Pradesh", region: "north", lang: "Hindi" },
  hr: { name: "Haryana", region: "north", lang: "Hindi" },
  jk: { name: "Jammu & Kashmir", region: "north", lang: "Kashmiri" },
  pb: { name: "Punjab", region: "north", lang: "Punjabi" },
  rj: { name: "Rajasthan", region: "north", lang: "Hindi" },
  up: { name: "Uttar Pradesh", region: "north", lang: "Hindi" },
  ut: { name: "Uttarakhand", region: "north", lang: "Hindi" },
  ap: { name: "Andhra Pradesh", region: "south", lang: "Telugu" },
  tg: { name: "Telangana", region: "south", lang: "Telugu" },
  ka: { name: "Karnataka", region: "south", lang: "Kannada" },
  kl: { name: "Kerala", region: "south", lang: "Malayalam" },
  tn: { name: "Tamil Nadu", region: "south", lang: "Tamil" },
  gj: { name: "Gujarat", region: "west", lang: "Gujarati" },
  mh: { name: "Maharashtra", region: "west", lang: "Marathi" },
  ga: { name: "Goa", region: "west", lang: "Konkani" },
  mp: { name: "Madhya Pradesh", region: "central", lang: "Hindi" },
  ct: { name: "Chhattisgarh", region: "central", lang: "Hindi" },
  or: { name: "Odisha", region: "east", lang: "Odia" },
  jh: { name: "Jharkhand", region: "east", lang: "Hindi" },
  wb: { name: "West Bengal", region: "east", lang: "Bengali" },
  br: { name: "Bihar", region: "east", lang: "Hindi" },
  as: { name: "Assam", region: "northeast", lang: "Assamese" },
  mn: { name: "Manipur", region: "northeast", lang: "Meitei" },
  nl: { name: "Nagaland", region: "northeast", lang: "English" },
  ml: { name: "Meghalaya", region: "northeast", lang: "Khasi" },
  sk: { name: "Sikkim", region: "northeast", lang: "Nepali" },
  ar: { name: "Arunachal Pradesh", region: "northeast", lang: "English" },
  mz: { name: "Mizoram", region: "northeast", lang: "Mizo" },
  tr: { name: "Tripura", region: "northeast", lang: "Bengali" },
  ld: { name: "Lakshadweep", region: "south", lang: "Malayalam" },
  an: { name: "Andaman & Nicobar", region: "east", lang: "Hindi" },
  dn: { name: "Dadra & Nagar Haveli", region: "west", lang: "Gujarati" },
  dd: { name: "Daman & Diu", region: "west", lang: "Gujarati" },
  py: { name: "Puducherry", region: "south", lang: "Tamil" },
};

export const STATE_DATA: Record<string, StateData> = {
  ch: { c: 0, r: "540K", cr: 0, b: "₹2L" },
  dl: { c: 2, r: "3.1M", cr: 8, b: "₹8L" },
  hp: { c: 1, r: "320K", cr: 2, b: "₹1.5L" },
  hr: { c: 1, r: "620K", cr: 2, b: "₹2L" },
  jk: { c: 0, r: "690K", cr: 0, b: "₹2.5L" },
  pb: { c: 1, r: "890K", cr: 3, b: "₹2.5L" },
  rj: { c: 1, r: "1.9M", cr: 6, b: "₹5L" },
  up: { c: 1, r: "1.2M", cr: 4, b: "₹3L" },
  ut: { c: 0, r: "780K", cr: 0, b: "₹2.5L" },
  ap: { c: 0, r: "2.6M", cr: 0, b: "₹6.5L" },
  // Telangana mirrors Andhra Pradesh so the two always share a fill colour;
  // IndiaMap also groups them for hover/dim (they differ only by the border).
  tg: { c: 0, r: "2.6M", cr: 0, b: "₹6.5L" },
  ka: { c: 2, r: "3.5M", cr: 9, b: "₹7L" },
  kl: { c: 1, r: "1.8M", cr: 5, b: "₹4.5L" },
  tn: { c: 2, r: "3.1M", cr: 8, b: "₹12.5L" },
  gj: { c: 1, r: "1.9M", cr: 4, b: "₹5L" },
  mh: { c: 2, r: "3.9M", cr: 10, b: "₹13L" },
  ga: { c: 0, r: "620K", cr: 0, b: "₹2.5L" },
  mp: { c: 1, r: "900K", cr: 3, b: "₹3L" },
  ct: { c: 0, r: "710K", cr: 0, b: "₹2.5L" },
  or: { c: 1, r: "560K", cr: 2, b: "₹2.5L" },
  jh: { c: 0, r: "820K", cr: 0, b: "₹3L" },
  wb: { c: 1, r: "1.4M", cr: 4, b: "₹4.5L" },
  br: { c: 0, r: "1.6M", cr: 0, b: "₹4L" },
  as: { c: 2, r: "800K", cr: 3, b: "₹3.5L" },
  mn: { c: 0, r: "230K", cr: 0, b: "₹1.5L" },
  nl: { c: 0, r: "180K", cr: 0, b: "₹1.2L" },
  ml: { c: 1, r: "400K", cr: 2, b: "₹2L" },
  sk: { c: 0, r: "120K", cr: 0, b: "₹1L" },
  ar: { c: 0, r: "160K", cr: 0, b: "₹1.2L" },
  mz: { c: 0, r: "150K", cr: 0, b: "₹1L" },
  tr: { c: 0, r: "310K", cr: 0, b: "₹1.5L" },
  ld: { c: 0, r: "40K", cr: 0, b: "₹0.5L" },
  an: { c: 0, r: "90K", cr: 0, b: "₹0.8L" },
  dn: { c: 0, r: "70K", cr: 0, b: "₹0.8L" },
  dd: { c: 0, r: "60K", cr: 0, b: "₹0.7L" },
  py: { c: 0, r: "280K", cr: 0, b: "₹1.5L" },
};

export const REGIONS_DATA: RegionData[] = [
  {
    id: "north", name: "North",
    m: { c: 7, r: "8.1M", cr: 25, b: "₹22L", e: "4.1%", i: "14M", v: "9.8M" },
    camps: [
      { id: 4, n: "Summer Launch Teaser", s: "IM", p: "brief", pr: 8, r: "—", b: "₹8L", linked: true },
      { id: 102, n: "Delhi Street Food", s: "IM", p: "live", pr: 65, r: "1.8M", b: "₹6L", linked: false },
      { id: 103, n: "Rajasthan Ads", s: "Ads", p: "production", pr: 40, r: "2.1M", b: "₹5L", linked: false },
      { id: 104, n: "UP Activation", s: "Offline", p: "shortlist", pr: 20, r: "—", b: "₹3L", linked: false },
    ],
  },
  {
    id: "south", name: "South",
    m: { c: 6, r: "8.4M", cr: 24, b: "₹28L", e: "5.2%", i: "18M", v: "12.1M" },
    camps: [
      { id: 1, n: "Diwali Festive Push", s: "IM", p: "production", pr: 62, r: "2.4M", b: "₹12.5L", linked: true },
      { id: 202, n: "Bangalore Foodie", s: "IM", p: "live", pr: 78, r: "3.2M", b: "₹7L", linked: false },
      { id: 203, n: "Kerala Onam", s: "IM", p: "completed", pr: 100, r: "1.8M", b: "₹4.5L", linked: false },
    ],
  },
  {
    id: "west", name: "West",
    m: { c: 3, r: "5.8M", cr: 14, b: "₹18L", e: "5.8%", i: "12M", v: "8.2M" },
    camps: [
      { id: 3, n: "Micro-Influencer Wave", s: "IM", p: "completed", pr: 100, r: "1.1M", b: "₹4L", linked: true },
      { id: 302, n: "Mumbai Sprint", s: "IM", p: "live", pr: 72, r: "2.8M", b: "₹9L", linked: false },
    ],
  },
  {
    id: "east", name: "East",
    m: { c: 2, r: "2.1M", cr: 6, b: "₹7L", e: "3.8%", i: "5M", v: "3.2M" },
    camps: [
      { id: 401, n: "Kolkata Food", s: "IM", p: "production", pr: 50, r: "1.4M", b: "₹4.5L", linked: false },
      { id: 402, n: "Odisha Push", s: "SMM", p: "brief", pr: 10, r: "—", b: "₹2.5L", linked: false },
    ],
  },
  {
    id: "northeast", name: "North-East",
    m: { c: 3, r: "1.2M", cr: 5, b: "₹5.5L", e: "6.4%", i: "3M", v: "2.1M" },
    camps: [
      { id: 501, n: "NE Culture Series", s: "SMM", p: "brief", pr: 12, r: "—", b: "₹3.5L", linked: false },
      { id: 502, n: "Assam Tea", s: "IM", p: "shortlist", pr: 25, r: "—", b: "₹2L", linked: false },
    ],
  },
  {
    id: "central", name: "Central",
    m: { c: 1, r: "900K", cr: 3, b: "₹3L", e: "4.5%", i: "2M", v: "1.4M" },
    camps: [
      { id: 601, n: "MP Activation", s: "Offline", p: "production", pr: 55, r: "900K", b: "₹3L", linked: false },
    ],
  },
];

/** 18-language categorical palette (mid-saturation, readable on both themes). */
export const LANG_COLORS: Record<string, string> = {
  Hindi: "#5B8DEF", Tamil: "#3FBF6F", Telugu: "#E0569E", Kannada: "#E8874A",
  Malayalam: "#9077F0", Bengali: "#D9A93C", Marathi: "#DB5A8E", Gujarati: "#26A996",
  Punjabi: "#E4703A", Odia: "#6A6FDB", Assamese: "#8A5CE6", English: "#8B98A9",
  Kashmiri: "#4A85E8", Konkani: "#C452D9", Nepali: "#31BFD4", Meitei: "#A05CE0",
  Khasi: "#35BFA8", Mizo: "#7C86EE",
};

export const MAP_TOTALS = { c: 22, r: "26.5M", cr: 77, b: "₹83.5L" };

/** Per-state drill detail — creators worked with + campaigns executed.
    Only active states carry an entry; the Network page falls back gracefully. */
export const STATE_DETAIL: Record<string, StateDetail> = {
  dl: {
    creators: ["Delhi Eats", "Snack Scouts", "@capital.cravings"],
    campaigns: [
      { name: "Delhi Street Food Collab", reach: "4.1M", phase: "live" },
      { name: "Summer Launch Teaser", reach: "—", phase: "brief" },
    ],
  },
  hp: {
    creators: ["@himalayan.plates", "@pahadi.foodie"],
    campaigns: [{ name: "Hill Station Series", reach: "320K", phase: "production" }],
  },
  hr: {
    creators: ["@gurgaon.grub", "@haryanvi.tadka"],
    campaigns: [{ name: "NCR Foodie Push", reach: "620K", phase: "live" }],
  },
  pb: {
    creators: ["@punjabi.zaika", "@amritsar.eats", "@ludhiana.bites"],
    campaigns: [{ name: "Punjab Harvest", reach: "890K", phase: "completed" }],
  },
  rj: {
    creators: ["@marwari.kitchen", "Travel Tales"],
    campaigns: [{ name: "Rajasthan Ads", reach: "1.9M", phase: "production" }],
  },
  up: {
    creators: ["@lucknawi.tehzeeb", "@banaras.bites"],
    campaigns: [{ name: "UP Activation", reach: "1.2M", phase: "shortlist" }],
  },
  ka: {
    creators: ["Nano Nibble", "@namma.bengaluru", "@mysore.meals"],
    campaigns: [
      { name: "Bangalore Foodie", reach: "3.2M", phase: "live" },
      { name: "Brand Visibility Sprint", reach: "3.6M", phase: "shortlist" },
    ],
  },
  kl: {
    creators: ["Kerala Food Tales", "@malabar.tastes"],
    campaigns: [{ name: "Kerala Onam", reach: "1.8M", phase: "completed" }],
  },
  tn: {
    creators: ["South Foodie", "Chennai Bites", "@madras.meals"],
    campaigns: [
      { name: "Diwali Festive Push", reach: "2.4M", phase: "production" },
      { name: "Chennai Bites Collab", reach: "3.1M", phase: "live" },
    ],
  },
  gj: {
    creators: ["Anjali Kitchen", "@surat.snacks"],
    campaigns: [{ name: "Gujarat Thali", reach: "1.9M", phase: "live" }],
  },
  mh: {
    creators: ["Mumbai Munchies", "Tiny Tastes", "Lifestyle Priya", "@pune.plates"],
    campaigns: [
      { name: "Mumbai Foodie Sprint", reach: "2.8M", phase: "live" },
      { name: "Micro-Influencer Wave", reach: "1.1M", phase: "completed" },
    ],
  },
  mp: {
    creators: ["@indori.namkeen", "Central Kitchen"],
    campaigns: [{ name: "MP Activation", reach: "900K", phase: "production" }],
  },
  or: {
    creators: ["@odia.rasoi", "@bhubaneswar.bites"],
    campaigns: [{ name: "Odisha Push", reach: "—", phase: "brief" }],
  },
  wb: {
    creators: ["Bengali Biryani", "@kolkata.cravings"],
    campaigns: [{ name: "Kolkata Food", reach: "1.4M", phase: "production" }],
  },
  as: {
    creators: ["NorthEast Flavors", "@assam.tea.tales"],
    campaigns: [
      { name: "Assam Tea", reach: "—", phase: "shortlist" },
      { name: "NE Culture Series", reach: "—", phase: "brief" },
    ],
  },
  ml: {
    creators: ["@shillong.eats"],
    campaigns: [{ name: "NE Culture Series", reach: "400K", phase: "brief" }],
  },
};

/** Beyond India — diaspora-led international markets. */
export const INTERNATIONAL: IntlMarket[] = [
  {
    id: "dxb", city: "Dubai", country: "UAE", reach: "9.2M", creators: 640,
    langs: ["Arabic", "English", "Hindi"],
    campaigns: [
      { name: "Dubai Ramadan Feast", reach: "5.6M", phase: "live" },
      { name: "Gulf Foodie Wave", reach: "3.6M", phase: "production" },
    ],
  },
  {
    id: "sin", city: "Singapore", country: "Singapore", reach: "4.8M", creators: 350,
    langs: ["English", "Tamil", "Mandarin"],
    campaigns: [
      { name: "SG Hawker Series", reach: "3.1M", phase: "live" },
      { name: "Little India Push", reach: "1.7M", phase: "completed" },
    ],
  },
  {
    id: "lon", city: "London", country: "United Kingdom", reach: "7.6M", creators: 540,
    langs: ["English", "Hindi", "Punjabi"],
    campaigns: [
      { name: "British-Indian Kitchen", reach: "4.7M", phase: "live" },
      { name: "Diaspora Diwali", reach: "2.9M", phase: "production" },
    ],
  },
  {
    id: "nyc", city: "New York", country: "United States", reach: "6.4M", creators: 470,
    langs: ["English", "Hindi"],
    campaigns: [
      { name: "NYC Street Eats", reach: "3.9M", phase: "live" },
      { name: "Desi in America", reach: "2.5M", phase: "shortlist" },
    ],
  },
];

export const INTL_TOTALS = { markets: 4, reach: "28M", creators: 2000 };

/** Centroid of an SVG path — ported verbatim from RegionalMap.jsx:42. */
export function centroid(path: string): [number, number] {
  const nums = path
    .replace(/[MLZHVCSQTA]/gi, " ")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !isNaN(n));
  let cx = 0,
    cy = 0,
    n = 0;
  for (let i = 0; i < nums.length; i += 2) {
    cx += nums[i];
    cy += nums[i + 1];
    n++;
  }
  return n ? [cx / n, cy / n] : [0, 0];
}
