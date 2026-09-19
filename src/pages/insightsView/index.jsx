/**
 * src/pages/insights/index.jsx — the portal's Insights tab, redesigned as
 * its own standalone visual language: a dark "watchroom" canvas rather than
 * the portal's warm-paper/navy system used everywhere else (Overview,
 * Campaigns, Profile, …). Deliberate — this is the one page whose entire
 * subject is watching things (Questions, Trending, Market Watch, the
 * Newsletter), so it gets to look like a briefing room instead of a ledger.
 *
 * Structure: a pinned-feeling hero (headline + live ticker), then the four
 * sections in the same order as before (Questions → Trending → Market
 * Watch → Newsletter), each opening with a big scroll-scrubbed title band
 * (SectionBand, in primitives.jsx) before its actual content. The ambient
 * background's color wash cross-fades to whichever section is currently
 * in view.
 *
 * All data contracts are unchanged from the previous Insights.jsx — see
 * sections.jsx, which owns the four sections' actual content and reuses
 * every hook (usePortalQuestions/Trending/MarketWatch/News/Newsletter)
 * as-is. This file only owns the shell: hero, rail, section scaffolding.
 */
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  InsightsKeyframes, AmbientField, HeroPhotoLayer, LiveDot, SectionBand, CursorGlow, ScrollCue,
} from "./primitives";
import { SECTIONS } from "./theme";
import { QuestionsSection, TrendingSection, MarketWatchSection, NewsletterSection } from "./sections";

const SECTION_CONTENT = {
  questions: QuestionsSection,
  trending: TrendingSection,
  "market-watch": MarketWatchSection,
  newsletter: NewsletterSection,
};

function Hero() {
  const wrapRef = useRef(null);
  const flashRef = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const words = wrapRef.current?.querySelectorAll("[data-word]");
        if (words?.length) {
          gsap.set(words, { opacity: 0, y: 26, filter: "blur(10px)" });
          gsap.to(words, {
            opacity: 1, y: 0, filter: "blur(0px)",
            duration: 0.9, ease: "power3.out", stagger: 0.05, delay: 0.15,
          });
        }
        gsap.fromTo(
          "[data-hero-fade]",
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.08, delay: 0.55 },
        );
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-word], [data-hero-fade]", { opacity: 1, y: 0, filter: "blur(0px)" });
      });
      return () => mm.revert();
    },
    { scope: wrapRef },
  );

  // Bold, eased jump (GSAP ScrollToPlugin, registered in primitives.jsx) in
  // place of a plain anchor jump, plus a quick radial flash across the
  // hero — used by both the quick-jump chips and the new ScrollCue.
  function jumpTo(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (flashRef.current) {
      gsap.fromTo(flashRef.current, { opacity: 0.55 }, { opacity: 0, duration: 0.6, ease: "power2.out" });
    }
    if (reduced) {
      target.scrollIntoView({ block: "start" });
      return;
    }
    gsap.to(window, { duration: 1.1, ease: "power3.inOut", scrollTo: { y: target, offsetY: 88 } });
  }

  // Click the headline for a quick cinematic "punch" — a snappy scale-up
  // that settles back with an elastic ease, plus the same radial flash.
  function punchHeadline(e) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const el = e.currentTarget;
    gsap.timeline()
      .to(el, { scale: 1.05, duration: 0.15, ease: "power2.out" })
      .to(el, { scale: 1, duration: 0.55, ease: "elastic.out(1, 0.4)" });
    if (flashRef.current) {
      gsap.fromTo(flashRef.current, { opacity: 0.5 }, { opacity: 0, duration: 0.55, ease: "power2.out" });
    }
  }

  const headline = "Beyond the account.";

  return (
    <div className="relative">
      {/* Photo backdrop, pulled up by the floating glass navbar's own
          footprint (72px bar + 12px top gutter = 84px) so it reads as
          running continuously behind the navbar instead of stopping with a
          hard edge right under it. z-0, so it sits behind the navbar's
          z-40; owns its own overflow boundary so the Ken Burns zoom never
          leaks past the extended area. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 z-0 overflow-hidden" style={{ top: -84 }}>
        <HeroPhotoLayer />
      </div>
      <div ref={wrapRef} className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col justify-start px-5 pb-10 pt-28 sm:px-9 sm:pt-32">
        <div
          ref={flashRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 opacity-0"
          style={{ background: `radial-gradient(circle at 32% 38%, ${SECTIONS[0].accent}66, transparent 62%)` }}
        />
        <div className="relative z-10">
        <div data-hero-fade className="mb-7 flex flex-wrap items-center gap-4">
          <LiveDot label="Fifth Avenue Intelligence" />
          <span className="h-3 w-px bg-black/15 dark:bg-white/15" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45 dark:text-white/35">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>

        <h1
          onClick={punchHeadline}
          className="max-w-6xl cursor-pointer select-none text-[clamp(48px,9vw,128px)] italic leading-[0.96] tracking-[-0.02em] text-[#171410] dark:text-white"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          {headline.split(" ").map((w, i) => (
            <span key={i} data-word className="mr-[0.28em] inline-block">
              {w}
            </span>
          ))}
        </h1>

        <p data-hero-fade className="mt-8 max-w-3xl text-[18px] leading-relaxed text-black/60 dark:text-white/55 sm:text-[20px]">
          Questions worth asking, what's trending, what the wider market is doing, and Fifth Avenue's own dispatch —
          one continuous read, four signals deep.
        </p>

        <div data-hero-fade className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4">
          {SECTIONS.map((s, i) => (
            <span key={s.id} className="flex items-center gap-x-5">
              {i > 0 && <span aria-hidden className="h-3 w-px bg-black/15 dark:bg-white/15" />}
              <a
                href={`#${s.id}`}
                onClick={(e) => { e.preventDefault(); jumpTo(s.id); }}
                className="group relative inline-flex items-baseline gap-2 font-serif text-[19px] italic text-black/55 transition-colors duration-200 hover:text-[#171410] dark:text-white/50 dark:hover:text-white sm:text-[22px]"
              >
                <span className="font-mono text-[11.5px] font-semibold not-italic tracking-[0.14em] text-black/35 dark:text-white/30">{s.roman}</span>
                {s.label}
                <span className="pointer-events-none absolute -bottom-1 left-0 h-px w-0 bg-current transition-all duration-300 ease-out group-hover:w-full" />
              </a>
            </span>
          ))}
        </div>

        <div data-hero-fade className="mt-20 flex justify-start">
          <ScrollCue onClick={() => jumpTo(SECTIONS[0].id)} />
        </div>
        </div>
      </div>
    </div>
  );
}

export default function Insights() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-page">
      <InsightsKeyframes />
      <AmbientField activeId={activeId} />
      <CursorGlow />

      <Hero />

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-28 sm:px-9">
        {SECTIONS.map((s) => {
          const Content = SECTION_CONTENT[s.id];
          return (
            <section key={s.id} id={s.id} className="scroll-mt-24 pt-16 sm:pt-24">
              <SectionBand section={s} onActivate={setActiveId} />
              <div className="mt-8 sm:mt-10">
                <Content />
              </div>
            </section>
          );
        })}

        <div className="mt-24 flex flex-col items-center gap-3 border-t border-black/[0.08] pt-10 text-center dark:border-white/[0.08]">
          <span className="font-serif text-[22px] italic text-black/75 dark:text-white/70">Fifth Avenue</span>
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.24em] text-black/40 dark:text-white/30">
            End of briefing — back to Overview any time
          </span>
        </div>
      </div>
    </div>
  );
}
