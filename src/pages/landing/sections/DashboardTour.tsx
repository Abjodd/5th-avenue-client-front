import { useRef, useState } from "react";
import { gsap, useGSAP } from "../../../motion/gsap";
import { DUR, EASE } from "../../../motion/tokens";
import { prefersReducedMotion } from "../../../motion/reducedMotion";
import { TOUR_STEPS } from "../../../lib/marketing/data/landing-copy";
import { cx } from "../../../lib/cx";
import { TourScene } from "./TourScenes";

export function DashboardTour() {
  const scope = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const steps = gsap.utils.toArray<HTMLElement>("[data-tour-step]");
      steps.forEach((step, i) => {
        gsap.to(step, {
          scrollTrigger: {
            trigger: step,
            start: "top center",
            end: "bottom center",
            onToggle: (self) => self.isActive && setActive(i),
          },
        });
      });
    },
    { scope },
  );

  // crossfade the scene mock when the active step changes
  useGSAP(
    () => {
      if (!sceneRef.current || prefersReducedMotion()) return;
      gsap.fromTo(
        sceneRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: DUR.md, ease: EASE.out },
      );
    },
    { dependencies: [active], scope: sceneRef },
  );

  return (
    <section
      ref={scope}
      id="dashboard"
      className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32"
    >
      <div className="mb-14 max-w-2xl">
        <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
          Our dashboard
        </p>
        <h2 className="mt-4 font-serif text-display-lg text-ink">
          Every wing of your marketing, on one calm surface.
        </h2>
      </div>

      <div className="grid gap-12 md:grid-cols-[1fr_1.05fr] md:gap-16">
        {/* steps */}
        <div className="flex flex-col">
          {TOUR_STEPS.map((step, i) => (
            <div
              key={step.id}
              data-tour-step
              className={cx(
                "border-l-2 py-8 pl-6 transition-colors duration-300",
                active === i ? "border-accent" : "border-line",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                  {step.eyebrow}
                </span>
                {step.soon && (
                  <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-3">
                    In development
                  </span>
                )}
              </div>
              <h3
                className={cx(
                  "mt-3 text-title font-semibold transition-colors duration-300",
                  active === i ? "text-ink" : "text-ink-2",
                )}
              >
                {step.title}
              </h3>
              <p className="mt-2 max-w-md text-body text-ink-2">{step.body}</p>

              {/* inline scene on mobile */}
              <div className="mt-5 md:hidden">
                <TourScene scene={step.scene} />
              </div>
            </div>
          ))}
        </div>

        {/* sticky scene panel (desktop) */}
        <div className="hidden md:block">
          <div className="sticky top-24">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-danger/50" />
                <span className="h-2 w-2 rounded-full bg-warning/50" />
                <span className="h-2 w-2 rounded-full bg-success/50" />
                <span className="ml-2 font-mono text-[10px] text-ink-3">
                  {TOUR_STEPS[active].eyebrow.split("—")[1]?.trim() ?? "Overview"}
                </span>
              </div>
              <div ref={sceneRef} className="min-h-[320px]">
                <TourScene scene={TOUR_STEPS[active].scene} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
