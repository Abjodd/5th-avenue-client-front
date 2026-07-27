// src/context.js — Shared theme palette and app context.
// Palette mirrors 5th-internal-front/src/theme/tokens.js (the internal OS
// design system): warm paper neutrals + deep indigo-navy accent, Newsreader
// for display type, Sora for UI. Light theme only — same as the internal
// dashboard. Keys keep the P.* names the pages already consume.

export const LIGHT = {
  bg: "#F6F4EE",            // warm cream — T.bg
  surface: "#FFFFFF",       // cards / bars — T.surface
  card: "#FFFFFF",
  raised: "#FCFAF5",        // T.raised
  hover: "rgba(25,22,17,0.035)",
  border: "rgba(25,22,17,0.10)",
  borderMid: "rgba(25,22,17,0.16)",
  text: "#191611",          // ink — T.text
  sub: "#625D4E",           // T.sub
  mute: "#6F6A5A",          // faint text — WCAG AA (4.5:1) on white
  label: "#6F6A5A",
  white: "#191611",         // pages use P.white for headings; ink in light theme
  done: "#F0EDE5",          // completed-card wash
  doneTxt: "#A9A28E",

  accent: "#2C3E7E",        // rich indigo-navy — T.accent
  accentInk: "#FFFFFF",     // text on accent-filled buttons
  green: "#17915A",
  amber: "#A8720C",
  red: "#BE3A3A",
  purple: "#6C55CE",
  teal: "#178E80",
  pink: "#A2489A",
  gold: "#96792A",

  barBg: "rgba(25,22,17,0.055)",  // track/well behind bars & chips
  inputBg: "#FFFFFF",
  modalBg: "#FFFFFF",
  shadow: "0 1px 2px rgba(25,22,17,0.05), 0 8px 24px rgba(25,22,17,0.07)",
  shadowLg: "0 24px 64px rgba(25,22,17,0.18)",
  radius: 8,
  radiusSm: 5,
};

// Dark theme — mirrors the [data-theme="dark"] token overrides in index.css so
// inline P.* colours (SVG maps, charts, dynamic styles) match the CSS utilities.
export const DARK = {
  bg: "#131217",
  surface: "#1B1A21",
  card: "#1B1A21",
  raised: "#22212A",
  hover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.11)",
  borderMid: "rgba(255,255,255,0.18)",
  text: "#ECEAE3",
  sub: "#ABA697",
  mute: "#8E897A",
  label: "#8E897A",
  white: "#ECEAE3",
  done: "#23222B",
  doneTxt: "#6C6858",

  accent: "#7C93E4",
  accentInk: "#FFFFFF",
  green: "#3FB97E",
  amber: "#D69A38",
  red: "#E06A6A",
  purple: "#9A86EC",
  teal: "#3CB9A9",
  pink: "#D46BC7",
  gold: "#C7A452",

  barBg: "rgba(255,255,255,0.06)",
  inputBg: "#22212A",
  modalBg: "#1B1A21",
  shadow: "0 1px 2px rgba(0,0,0,0.35), 0 10px 28px rgba(0,0,0,0.45)",
  shadowLg: "0 26px 70px rgba(0,0,0,0.6)",
  radius: 8,
  radiusSm: 5,
};

import { createContext, useContext } from "react";
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
