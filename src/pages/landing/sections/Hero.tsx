import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { gsap, useGSAP, SplitText } from "../../../motion/gsap";
import { DUR, EASE } from "../../../motion/tokens";
import { prefersReducedMotion } from "../../../motion/reducedMotion";
import { HERO } from "../../../lib/marketing/data/landing-copy";
import { Icon } from "../../../components/primitives/Icon";
import { HeroDashboard } from "./HeroDashboard";

export function Hero() {
  const scope = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(scope);

      // ── splash (on load): eyebrow + FIFTH AVENUE curtain reveal — the set-piece
      const split = new SplitText(q("[data-hero-wordmark]"), {
        type: "chars,lines",
        linesClass: "overflow-hidden py-[0.08em]",
      });
      const tl = gsap.timeline({ defaults: { ease: EASE.out } });
      tl.from(q("[data-hero-eyebrow]"), { opacity: 0, y: 10, duration: DUR.md })
        .from(split.chars, { yPercent: 120, opacity: 0, duration: DUR.xl, stagger: 0.035, ease: EASE.emph }, "-=0.15")
        .from(q("[data-hero-cue]"), { opacity: 0, duration: DUR.md }, "-=0.4");

      // ── statement (on scroll): large tagline + lede + CTAs, below the fold
      const stmt = q("[data-hero-statement]")[0];
      const tagSplit = new SplitText(q("[data-hero-tagline]"), { type: "lines", linesClass: "overflow-hidden" });
      gsap.from(tagSplit.lines, {
        yPercent: 110, duration: DUR.lg, stagger: 0.09, ease: EASE.out,
        scrollTrigger: { trigger: stmt, start: "top 80%", once: true },
      });
      gsap.from(q("[data-hero-lede], [data-hero-cta]"), {
        opacity: 0, y: 16, duration: DUR.md, stagger: 0.08, ease: EASE.out,
        scrollTrigger: { trigger: stmt, start: "top 72%", once: true },
      });

      // ── dashboard rise + scrubbed parallax
      gsap.from(frame.current, {
        opacity: 0, y: 56, rotateX: 7, transformPerspective: 1400, duration: DUR.xl, ease: EASE.out,
        scrollTrigger: { trigger: frame.current, start: "top 85%", once: true },
      });
      gsap.to(frame.current, {
        yPercent: -6, ease: "none",
        scrollTrigger: { trigger: frame.current, start: "top bottom", end: "bottom top", scrub: 0.5 },
      });

      // ── pointer tilt: the dashboard's sides lean toward/away from the cursor
      let onMove: ((e: PointerEvent) => void) | null = null;
      let onLeave: (() => void) | null = null;
      const host = frame.current;
      if (host && tilt.current) {
        gsap.set(tilt.current, { transformOrigin: "center center", transformPerspective: 1200 });
        const rotX = gsap.quickTo(tilt.current, "rotationX", { duration: 0.6, ease: EASE.out });
        const rotY = gsap.quickTo(tilt.current, "rotationY", { duration: 0.6, ease: EASE.out });
        onMove = (e) => {
          const r = host.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          rotY(px * 11);
          rotX(-py * 7);
        };
        onLeave = () => { rotX(0); rotY(0); };
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerleave", onLeave);
      }

      return () => {
        split.revert();
        tagSplit.revert();
        if (host && onMove) host.removeEventListener("pointermove", onMove);
        if (host && onLeave) host.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope },
  );

  return (
    <section ref={scope} id="platform" className="relative overflow-hidden">
      {/* ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(55% 45% at 50% 0%, var(--accent-muted) 0%, transparent 72%)" }}
      />

      {/* splash — the entire first screen is the wordmark.
          pt clears the fixed nav on every aspect ratio (never overlaps the
          eyebrow) and biases the centered wordmark a touch lower; the scroll
          cue is pinned to the bottom of the 100svh splash. */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-[1200px] flex-col items-center justify-center px-6 pb-28 pt-[max(7rem,15vh)] text-center md:px-10">
        <p data-hero-eyebrow className="font-mono text-eyebrow uppercase tracking-[0.28em] text-ink-3">
          {HERO.eyebrow}
        </p>
        <h1
          data-hero-wordmark
          className="mt-8 font-display font-extralight uppercase leading-[0.92] tracking-[0.14em] text-ink"
          style={{ fontSize: "clamp(46px, 12vw, 168px)" }}
        >
          {HERO.wordmark[0]}
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> </span>
          {HERO.wordmark[1]}
        </h1>
        <div data-hero-cue className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-ink-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="fa-scroll-cue h-8 w-px bg-gradient-to-b from-ink-3 to-transparent" />
        </div>
      </div>

      {/* statement — revealed on scroll, restored to full size */}
      <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-4 md:px-10 md:pb-24">
        <div data-hero-statement className="mx-auto max-w-3xl text-center">
          <h2 data-hero-tagline className="font-serif text-display-lg text-ink">
            Marketing that <span className="italic text-accent">compounds</span>.
          </h2>
          <p data-hero-lede className="mx-auto mt-6 max-w-xl text-body-lg text-ink-2">
            {HERO.lede}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              data-hero-cta
              to="/start"
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              {HERO.primaryCta.label}
              <Icon icon={ArrowRight} size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              data-hero-cta
              href={HERO.secondaryCta.href}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {HERO.secondaryCta.label}
            </a>
          </div>
        </div>

        <div ref={frame} className="mx-auto mt-14 max-w-4xl [perspective:1400px]">
          <div ref={tilt} className="[transform-style:preserve-3d] [will-change:transform]">
            <HeroDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
