/* Motion tokens. Rules: UI feedback ≤ .25s, content entrances .4–.6s,
   landing set-pieces ≤ .9s. Only transform / opacity / clip-path animate;
   layout changes go through Flip. */

export const DUR = { xs: 0.15, sm: 0.25, md: 0.4, lg: 0.6, xl: 0.9 } as const;

export const EASE = {
  out: "power3.out",
  inOut: "power3.inOut",
  emph: "expo.out",
  settle: "back.out(1.2)", // sparingly
} as const;

export const STAG = { list: 0.05, cards: 0.08, words: 0.035 } as const;
