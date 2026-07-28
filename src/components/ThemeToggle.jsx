// src/components/ThemeToggle.jsx — appearance control, in two shapes.
//
//   <ThemeToggle />            compact icon button for the app bar — one tap
//                              flips between light and dark.
//   <ThemeToggle showLabel />  three-way segmented control (Auto / Light /
//                              Dark) for the Profile → Appearance card.
//
// The segmented form exists because the compact one can only ever reach an
// explicit light or dark: once you tap it, `mode` stops being "system" and
// nothing in the UI could put it back. Auto is the default and the right
// setting for most people, so it needs a way home.

import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const EASE = [0.16, 1, 0.3, 1];

const MODES = [
  { id: "system", label: "Auto",  Icon: MonitorSmartphone },
  { id: "light",  label: "Light", Icon: Sun },
  { id: "dark",   label: "Dark",  Icon: Moon },
];

/** Compact icon button — swaps sun/moon with a short rotate-and-lift. */
function IconToggle() {
  const { resolved, mode, toggle } = useTheme();
  const isDark = resolved === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      onClick={toggle}
      title={`Switch to ${isDark ? "light" : "dark"} mode${mode === "system" ? " — currently following your device" : ""}`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="group relative flex size-9 items-center justify-center rounded-full border border-line bg-[--color-glass-soft] shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-[1px] hover:border-accent/25 hover:shadow-md"
    >
      <span className="relative flex size-[18px] items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "sun" : "moon"}
            initial={{ y: -16, opacity: 0, rotate: -50, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 16, opacity: 0, rotate: 50, scale: 0.7 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="absolute text-accent"
          >
            <Icon size={17} strokeWidth={1.9} />
          </motion.span>
        </AnimatePresence>
      </span>

      {/* while following the device, a dot marks the button as automatic */}
      {mode === "system" && (
        <span className="absolute right-[7px] top-[7px] size-[5px] rounded-full bg-accent ring-2 ring-surface" />
      )}
    </button>
  );
}

/** Three-way segmented control. The active pill is a single shared element
    moved by layoutId, so the selection slides between options. */
function SegmentedToggle() {
  const { mode, setMode, resolved } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex items-center gap-1 rounded-full border border-line bg-well p-1"
    >
      {MODES.map(({ id, label, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            onClick={() => setMode(id)}
            title={id === "system" ? `Follow your device — currently ${resolved}` : `Always ${label.toLowerCase()}`}
            className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-200 ${
              active ? "text-ink" : "text-mute hover:text-sub"
            }`}
          >
            {active && (
              <motion.span
                layoutId="theme-mode-pill"
                transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
                className="absolute inset-0 rounded-full border border-line bg-surface shadow-sm"
              />
            )}
            <span className="relative z-[1] flex items-center gap-1.5">
              <Icon size={14} strokeWidth={2} className={active ? "text-accent" : ""} />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function ThemeToggle({ showLabel = false }) {
  return showLabel ? <SegmentedToggle /> : <IconToggle />;
}
