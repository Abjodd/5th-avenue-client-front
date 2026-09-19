// src/pages/insights/primitives.jsx — the redesigned Insights page's own
// chrome: ambient dark-canvas background, the section title bands (numeral
// + scroll-scrubbed color wash), the right-hand progress rail, the header
// ticker, and the small GSAP helpers the sections lean on for their
// scroll-triggered reveals. Kept apart from `sections.jsx` (the actual
// content) so the "how things move" lives in one place.
//
// GSAP + ScrollTrigger drive every scroll-linked effect here, per the brief
// (this page is deliberately its own standalone visual language, distinct
// from the rest of the portal's Motion/React-only vocabulary). Every
// scroll-scrubbed or batch-reveal effect is wrapped in
// `gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", …)` so a
// reduced-motion viewer gets the finished, fully-visible layout with no
// motion at all, never a half-played animation.
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ChevronDown } from "lucide-react";
import { SECTIONS, sectionById } from "./theme";
import { InfluencerMotifPattern } from "./motifs";
import { useTheme } from "../../context/ThemeContext";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ── Keyframes this page needs that Tailwind can't express as arbitrary
   values (no @keyframes block to point at) — injected once, scoped by an
   `iw-` prefix unlikely to collide with anything else in the app. ── */
export function InsightsKeyframes() {
  return (
    <style>{`
      @keyframes iw-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes iw-pulse { 0%, 100% { opacity: 0.9; transform: scale(1); } 50% { opacity: 0; transform: scale(2.2); } }
      @keyframes iw-motif-drift { from { transform: translate(0, 0); } to { transform: translate(-96px, -72px); } }
      @keyframes iw-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
      @keyframes iw-hero-kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
      @keyframes iw-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes iw-bounce-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
    `}</style>
  );
}

/* ── useScrollBatch — the one hook every section uses to reveal its cards:
   query `selector` inside `containerRef`, hide them, then fade/rise/
   sharpen each into place the first time it crosses 88% of the viewport,
   staggered in registration order. Re-runs when `deps` changes so cards
   that only exist once async data lands (every section here) still get
   wired up once they actually mount. ── */
export function useScrollBatch(containerRef, selector, opts = {}, deps = []) {
  const { y = 40, scale = 0.96, stagger = 0.08, blur = 8 } = opts;
  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;
      const targets = root.querySelectorAll(selector);
      if (!targets.length) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(targets, { opacity: 0, y, scale, filter: `blur(${blur}px)` });
        ScrollTrigger.batch(targets, {
          start: "top 90%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
              stagger,
              overwrite: true,
            }),
        });
      });
      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [selector, ...deps] },
  );
}

/* ── AmbientField — the canvas every section sits on: a tiled constellation
   of influencer-marketing iconography (see motifs.jsx — original line art,
   not a stock photo or any brand's actual assets) drifting slowly and
   recolored to whichever section is active, a soft two-blob color wash on
   top of that (see SectionBand), and a vignette so the far edges settle
   back toward the canvas tone. Fixed to the viewport so it reads as one
   continuous backdrop rather than scrolling away — same job
   AmbientBackground does for the rest of the portal, this page just gets
   its own illustrated ground, much darker in dark mode and much brighter
   in light mode (both driven by `resolved` from ThemeContext, same layer
   structure either way — only the base tone and motif strength flip). ── */
export function AmbientField({ activeId }) {
  const active = sectionById(activeId) || SECTIONS[0];
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      <svg
        aria-hidden
        className={`absolute inset-0 h-full w-full transition-[color] duration-[1600ms] ease-out ${dark ? "opacity-[0.16]" : "opacity-[0.11]"}`}
        style={{ color: active.accent, animation: "iw-motif-drift 46s ease-in-out infinite alternate" }}
      >
        <InfluencerMotifPattern patternId="iw-motifs" />
        <rect width="100%" height="100%" fill="url(#iw-motifs)" />
      </svg>
      <div
        className="absolute inset-0 transition-[background] duration-[1600ms] ease-out"
        style={{
          background: `radial-gradient(58% 46% at 16% 6%, ${active.glow}, transparent 62%), radial-gradient(46% 40% at 90% 78%, ${active.glow}, transparent 65%)`,
          opacity: dark ? 0.5 : 0.35,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(130% 100% at 50% 0%, transparent 38%, var(--bg) 100%)"
            : "radial-gradient(130% 100% at 50% 0%, transparent 45%, var(--bg) 100%)",
        }}
      />
    </div>
  );
}

/* ── HeroPhotoLayer — a rotating photo backdrop scoped to just the hero
   panel (not the page-wide AmbientField below it): crossfades between the
   supplied photos every 5s with a slow Ken Burns zoom, respects
   prefers-reduced-motion (holds on the first photo, no zoom), and sits
   behind the hero's text with a theme-tuned scrim so the headline/ticker/
   quick-jump chips stay legible over whichever photo is showing. Fades to
   the page's own background color at the bottom so it hands off cleanly
   to AmbientField once you scroll past the hero. ── */
const HERO_PHOTOS = [
  "https://images.unsplash.com/photo-1646446835625-4f23efd5c662?w=1600&auto=format&fit=crop&q=80&ixlib=rb-4.1.0",
  "https://images.unsplash.com/photo-1724862936518-ae7fcfc052c1?w=1600&auto=format&fit=crop&q=80&ixlib=rb-4.1.0",
  "https://images.unsplash.com/photo-1559854036-2409f22a918a?w=1600&auto=format&fit=crop&q=80&ixlib=rb-4.1.0",
  "https://images.unsplash.com/photo-1616509091334-2be806ea7a3b?w=1600&auto=format&fit=crop&q=80&ixlib=rb-4.1.0",
];

export function HeroPhotoLayer() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || HERO_PHOTOS.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_PHOTOS.length);
    }, 5000);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {HERO_PHOTOS.map((url, i) => (
        <div
          key={url}
          className="absolute inset-0 transition-opacity duration-[1600ms] ease-out"
          style={{
            opacity: i === index ? 1 : 0,
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: dark
              ? "brightness(0.55) saturate(1.1) contrast(1.05)"
              : "brightness(0.92) saturate(1.05)",
            animation: !reduced && i === index ? "iw-hero-kenburns 12s ease-out infinite alternate" : "none",
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? "linear-gradient(180deg, rgba(7,7,11,0.35) 0%, rgba(7,7,11,0.6) 60%, var(--bg) 100%), linear-gradient(90deg, rgba(7,7,11,0.6) 0%, rgba(7,7,11,0.05) 48%)"
            : "linear-gradient(180deg, rgba(250,246,236,0.4) 0%, rgba(250,246,236,0.68) 60%, var(--bg) 100%), linear-gradient(90deg, rgba(250,246,236,0.75) 0%, rgba(250,246,236,0.1) 48%)",
        }}
      />
    </div>
  );
}

/* ── LiveDot — a pulsing "live" indicator for the hero eyebrow, the one
   spot on the page that gets to claim real-time without being literal:
   nothing here actually streams, but Trending/Market Watch/News are all
   genuinely fresh reads, so the cue is honest in spirit if not in fact. ── */
export function LiveDot({ label = "Live" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex size-2 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-emerald-400"
          style={{ animation: "iw-pulse 1.9s ease-out infinite" }}
        />
        <span className="relative size-[5px] rounded-full bg-emerald-400" />
      </span>
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-black/50 dark:text-white/45">{label}</span>
    </span>
  );
}

/* ── Marquee — the four section names on an infinite horizontal ticker,
   duplicated once so the CSS animation can loop seamlessly at -50%. Purely
   decorative (aria-hidden) — the same four names are proper headings and
   nav links elsewhere on the page. ── */
export function Marquee() {
  return (
    <div aria-hidden className="relative overflow-hidden border-y border-black/[0.08] py-3 dark:border-white/[0.08]">
      <div
        className="flex w-max gap-12 whitespace-nowrap"
        style={{ animation: "iw-marquee 26s linear infinite" }}
      >
        {[0, 1].map((rep) => (
          <span key={rep} className="flex items-center gap-12">
            {SECTIONS.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-black/35 dark:text-white/30"
              >
                {s.label}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── ScrollCue — replaces the old plain "Scroll to explore" caption line
   with a bold circular cue: a slowly rotating ring of repeating "Scroll to
   explore" text around a big bouncing chevron. Click jumps (GSAP
   ScrollToPlugin, eased) to the first section instead of a plain anchor
   jump, so even this small affordance carries the page's new cinematic
   energy. Respects prefers-reduced-motion (ring stops spinning, chevron
   stops bouncing — the button still works). ── */
export function ScrollCue({ onClick }) {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to explore"
      className="group relative flex size-24 shrink-0 items-center justify-center rounded-full text-black/55 transition-colors duration-200 hover:text-[#171410] dark:text-white/50 dark:hover:text-white sm:size-28"
    >
      <svg
        viewBox="0 0 100 100"
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ animation: reduced ? "none" : "iw-spin 10s linear infinite" }}
      >
        <defs>
          <path id="iw-scroll-ring" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text fontSize="6.6" letterSpacing="3" fill="currentColor" className="font-mono uppercase opacity-70">
          <textPath href="#iw-scroll-ring" startOffset="0%">
            Scroll to explore • Scroll to explore •
          </textPath>
        </text>
      </svg>
      <ChevronDown
        size={34}
        strokeWidth={2.3}
        className="relative transition-transform duration-300 group-hover:translate-y-1"
        style={{ animation: reduced ? "none" : "iw-bounce-y 1.5s ease-in-out infinite" }}
      />
    </button>
  );
}

/* ── SectionBand — the big title card each of the four sections opens
   with: an outline roman numeral that sharpens into focus, a color wash
   that fades in behind it, both scrubbed to scroll position (not a
   one-shot reveal) so the numeral genuinely feels like it's developing as
   the section arrives, then settles once it has. Also the thing that
   tells the page (via onActivate) which section currently "owns" the
   screen, for the side rail and the ambient wash. ── */
export function SectionBand({ section, onActivate }) {
  const ref = useRef(null);
  const numeralRef = useRef(null);
  const washRef = useRef(null);
  const { resolved } = useTheme();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const toggle = ScrollTrigger.create({
        trigger: el,
        start: "top 65%",
        end: "bottom 35%",
        onToggle: (self) => {
          if (self.isActive) onActivate?.(section.id);
        },
      });

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          numeralRef.current,
          { scale: 0.72, opacity: 0.12, filter: "blur(14px)" },
          {
            scale: 1,
            opacity: 1,
            filter: "blur(0px)",
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 92%", end: "top 38%", scrub: 0.6 },
          },
        );
        gsap.fromTo(
          washRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 95%", end: "top 40%", scrub: 0.6 },
          },
        );
      });

      return () => {
        toggle.kill();
        mm.revert();
      };
    },
    { scope: ref, dependencies: [section.id] },
  );

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-[28px] border border-black/[0.08] bg-black/[0.015] px-6 py-9 dark:border-white/[0.08] dark:bg-white/[0.02] sm:px-10 sm:py-12"
    >
      <div
        ref={washRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{ background: `radial-gradient(120% 160% at 12% 0%, ${section.glow}, transparent 62%)` }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-4 sm:gap-6">
          <span
            ref={numeralRef}
            className="select-none font-serif text-[52px] italic leading-none sm:text-[76px]"
            style={{ WebkitTextStroke: `1.4px ${resolved === "dark" ? "#ffffff" : section.accent}`, color: "transparent" }}
          >
            {section.roman}
          </span>
          <h2 className="font-serif text-[clamp(30px,4.4vw,52px)] font-extrabold italic leading-[1.02] tracking-[-0.02em] text-[#171410] dark:text-white">
            {section.label}
          </h2>
        </div>
        <p className="max-w-sm text-[13px] leading-relaxed text-black/55 dark:text-white/50 sm:text-right">{section.hint}</p>
      </div>
    </div>
  );
}

/* ── CursorGlow — a large, very soft radial highlight that trails the
   pointer at a spring lag. Desktop-only (a touch viewport has no cursor to
   trail) and purely decorative, sitting well behind the content. ── */
export function CursorGlow() {
  const { resolved } = useTheme();
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 55, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 55, damping: 20, mass: 0.6 });
  const tx = useTransform(sx, (v) => v - 280);
  const ty = useTransform(sy, (v) => v - 280);

  useEffect(() => {
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none fixed left-0 top-0 hidden size-[560px] rounded-full blur-[100px] lg:block ${resolved === "dark" ? "opacity-[0.05]" : "opacity-[0.06]"}`}
      style={{ x: tx, y: ty, background: `radial-gradient(circle, ${resolved === "dark" ? "#ffffff" : "#171410"}, transparent 70%)` }}
    />
  );
}
