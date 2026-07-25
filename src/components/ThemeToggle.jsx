// src/components/ThemeToggle.jsx — single light/dark toggle button.
// Default is System (follows the OS via prefers-color-scheme on iOS, Android,
// Windows and macOS); the first tap sets an explicit choice. `showLabel` adds
// a text label + auto-hint for the profile Appearance setting.

import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle({ showLabel = false }) {
  const { resolved, mode, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      onClick={toggle}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`group flex items-center gap-2 rounded-full border border-line bg-[--color-glass-soft] shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-accent/25 hover:shadow-md ${
        showLabel ? "px-3.5 py-2" : "size-9 justify-center"
      }`}
    >
      <span className="relative flex size-5 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "sun" : "moon"}
            initial={{ y: -14, opacity: 0, rotate: -40 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 14, opacity: 0, rotate: 40 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute text-[15px] text-accent"
          >
            {isDark ? "☀" : "☾"}
          </motion.span>
        </AnimatePresence>
      </span>
      {showLabel && (
        <span className="text-[12.5px] font-semibold text-ink">
          {isDark ? "Dark" : "Light"}
          <span className="ml-1 text-[11px] font-medium text-mute">{mode === "system" ? "· Auto" : ""}</span>
        </span>
      )}
    </button>
  );
}
