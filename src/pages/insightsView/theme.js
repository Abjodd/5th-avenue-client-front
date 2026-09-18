// src/pages/insights/theme.js — the redesigned Insights page's own visual
// identity: a dark "watchroom" canvas by default, with a matching "daylight
// watchroom" palette for the app's light theme (see ThemeContext — this page
// follows the same light/dark toggle as the rest of the portal via Tailwind's
// `dark:` variant, it just has its own distinct colors in both modes rather
// than reusing the portal's warm-paper/navy tokens). Every color this page
// needs lives here so a component never hardcodes a hex twice and the four
// section identities stay in sync between the title bands and the cards
// inside them.

// Base canvas — near-black ink in dark mode, warm near-white in light mode.
// `bgLight`/`bg` back the page root and AmbientField; the rest of INK is
// mostly historical (only `bg` is read directly today) but kept as the
// canonical reference for this page's two ground colors.
export const INK = {
  bg: "#07070b",
  bgLight: "#faf6ec",
  bgSoft: "#0b0b12",
  surface: "#111118",
  surfaceLight: "#fffdf8",
  surfaceSoft: "rgba(255,255,255,0.035)",
  glass: "rgba(17,17,24,0.62)",
  line: "rgba(255,255,255,0.09)",
  lineStrong: "rgba(255,255,255,0.16)",
  text: "#f5f5f8",
  sub: "rgba(245,245,248,0.66)",
  mute: "rgba(245,245,248,0.42)",
  white: "#ffffff",
};

// One identity per section — index (roman numeral for the rail/title
// bands), a label, a solid accent and a two-stop gradient used for rims,
// glows and the scroll-scrubbed wash behind each title band. Accents are
// tuned to read clearly against both the light and dark canvas, so they
// don't need a separate light/dark variant of their own.
// A single formal accent shared by every section — the page used to give
// each section its own hue (gold/violet/cyan/rose); the user asked for a
// formal, non-multicolor look, so all four now converge on one restrained
// gold/bronze instead. Kept as a two-stop `from`/`to` pair (rather than one
// flat color) purely because several consumers already expect a gradient
// shape — visually it now reads as one consistent tone across the page.
const FORMAL_ACCENT = "#c0973a";
const FORMAL_FROM = "#d4ab5c";
const FORMAL_TO = "#a17a2c";
const FORMAL_GLOW = "rgba(192,151,58,0.32)";

export const SECTIONS = [
  {
    id: "questions",
    roman: "I",
    n: "01",
    label: "Questions",
    hint: "Worth asking about the account right now.",
    accent: FORMAL_ACCENT,
    from: FORMAL_FROM,
    to: FORMAL_TO,
    glow: FORMAL_GLOW,
  },
  {
    id: "trending",
    roman: "II",
    n: "02",
    label: "Trending",
    hint: "What's moving across the roster and the wider platforms.",
    accent: FORMAL_ACCENT,
    from: FORMAL_FROM,
    to: FORMAL_TO,
    glow: FORMAL_GLOW,
  },
  {
    id: "market-watch",
    roman: "III",
    n: "03",
    label: "Market Watch",
    hint: "Signals from outside the account — category and competitor moves.",
    accent: FORMAL_ACCENT,
    from: FORMAL_FROM,
    to: FORMAL_TO,
    glow: FORMAL_GLOW,
  },
  {
    id: "newsletter",
    roman: "IV",
    n: "04",
    label: "Newsletter",
    hint: "The latest dispatch from Fifth Avenue.",
    accent: FORMAL_ACCENT,
    from: FORMAL_FROM,
    to: FORMAL_TO,
    glow: FORMAL_GLOW,
  },
];

export const sectionById = (id) => SECTIONS.find((s) => s.id === id);

// The rotating rim pairs reel cards cycle through (Trending) — the reel
// stage itself stays black in both themes (see ReelCard/GhostReelCard —
// like a phone screen bezel, not page chrome), so these don't need a light
// variant either.
export const RIMS = [
  ["#c0973a", "#a17a2c"], // formal gold, single tone — was a 4-way color rotation
];

// Shared class-string fragments — literal (never templated) so Tailwind's
// scanner can see them at build time. Dynamic per-section color always goes
// through inline `style`, never through a computed class name. Each carries
// its own `dark:` twin so every card built from these picks up the correct
// look for whichever theme is active with no per-component branching.
export const GLASS_CARD =
  "rounded-[20px] border border-black/[0.08] bg-[#fffdf8]/92 backdrop-blur-xl shadow-[0_16px_44px_-22px_rgba(30,24,12,0.22),inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/[0.09] dark:bg-[#111118]/92 dark:shadow-[0_20px_60px_-25px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]";
export const GLASS_CARD_SOFT =
  "rounded-[16px] border border-black/[0.08] bg-[#fffdf8]/92 backdrop-blur-lg dark:border-white/[0.08] dark:bg-[#111118]/90";
export const MONO_LABEL =
  "font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em]";
