// src/context.js — Shared theme palette and app context.
// Palette mirrors 5th-internal-front/src/theme/tokens.js (the internal OS
// design system): warm paper neutrals + deep indigo-navy accent, Newsreader
// for display type, Sora for UI. Light theme only — same as the internal
// dashboard. Keys keep the P.* names the pages already consume.

export const LIGHT = {
  bg: "#F7F6F2",            // warm paper — T.bg
  surface: "#FFFFFF",       // cards / bars — T.surface
  card: "#FFFFFF",
  raised: "#FBFAF8",        // T.raised
  hover: "rgba(28,24,16,0.035)",
  border: "rgba(28,24,16,0.09)",
  borderMid: "rgba(28,24,16,0.15)",
  text: "#1C1A15",          // ink — T.text
  sub: "#6E6A5C",           // T.sub
  mute: "#7A7566",          // faint text — darkened from #948E7C for WCAG AA (4.5:1)
  label: "#7A7566",
  white: "#1C1A15",         // pages use P.white for headings; ink in light theme
  done: "#F1EFE9",          // completed-card wash
  doneTxt: "#B0AA98",

  accent: "#2F3E6B",        // deep indigo-navy — T.accent
  accentInk: "#FFFFFF",     // text on accent-filled buttons
  green: "#1E9E5A",
  amber: "#B5790A",
  red: "#C13A3A",
  purple: "#7860D6",
  teal: "#1C9C8C",
  pink: "#A8519E",
  gold: "#A6862E",

  barBg: "rgba(28,24,16,0.06)",   // track/well behind bars & chips
  inputBg: "#FFFFFF",
  modalBg: "#FFFFFF",
  shadow: "0 1px 2px rgba(28,24,16,0.04), 0 6px 20px rgba(28,24,16,0.06)",
  shadowLg: "0 12px 40px rgba(28,24,16,0.14)",
  radius: 8,
  radiusSm: 5,
};

// The portal is light-only like the internal dashboard; DARK stays exported
// so nothing breaks if a stray import remains, but it's the same palette.
export const DARK = LIGHT;

import { createContext, useContext } from "react";
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
