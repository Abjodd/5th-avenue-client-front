// src/context/ThemeContext.jsx — app theme (System / Light / Dark).
// `mode` is the user's choice; `resolved` is the concrete theme applied.
// System follows the OS (prefers-color-scheme), defaulting to light. The
// resolved theme is written to <html data-theme> so the CSS token overrides
// in index.css take effect, and the matching palette object (LIGHT/DARK) is
// exposed as `P` for inline colours.

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { LIGHT, DARK } from "../context";

const THEME_KEY = "5av_theme";
const ThemeContext = createContext(null);

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; }
  });
  // Track the OS preference so "system" stays live if the user flips it.
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = useCallback((next) => {
    setModeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  }, []);

  // Single-button toggle: flip to the opposite of whatever is currently showing.
  // Until the first toggle, `mode` stays "system" and tracks the OS preference
  // (prefers-color-scheme — works on iOS, Android, Windows and macOS alike).
  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, setMode, toggle, resolved, P: resolved === "dark" ? DARK : LIGHT }),
    [mode, setMode, toggle, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
