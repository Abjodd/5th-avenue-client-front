// src/lib/motion.js — shared easing curves, springs, and variants for motion/react.
// One idiom for the whole portal: small y-offsets, expo-out ease, subtle springs.

export const EASE = [0.16, 1, 0.3, 1]; // expo-out — matches --ease-out-expo token
export const SPRING = { type: "spring", stiffness: 340, damping: 28 };
export const SPRING_SOFT = { type: "spring", stiffness: 220, damping: 26 };

/* ── Entrance variants ── */
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: SPRING },
};

/* Container that staggers its children (children use fadeUp/scaleIn etc.) */
export const staggerParent = (stagger = 0.06, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/* ── Overlay / drawer variants ── */
export const overlayFade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};

export const drawerRight = {
  hidden: { x: "104%" },
  show: { x: 0, transition: { type: "spring", stiffness: 300, damping: 32 } },
  exit: { x: "104%", transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } },
};

export const popModal = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.18, ease: "easeIn" } },
};
