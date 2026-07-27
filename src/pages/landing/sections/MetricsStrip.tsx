import { AnimatedNumber } from "../../../motion/AnimatedNumber";
import { useReveal } from "../../../motion/useReveal";
import { METRICS } from "../../../lib/marketing/data/landing-copy";

export function MetricsStrip() {
  const ref = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.08 });
  return (
    <section className="border-y border-line">
      <div
        ref={ref}
        className="mx-auto grid max-w-[1200px] grid-cols-2 divide-line px-6 md:grid-cols-4 md:divide-x md:px-10"
      >
        {METRICS.map((m) => (
          <div key={m.label} data-reveal className="px-2 py-8 md:px-8 md:py-10">
            <p className="tnum font-serif text-title-lg text-ink md:text-[40px]">
              {m.prefix ?? ""}
              <AnimatedNumber
                value={m.value}
                snap={Number.isInteger(m.value) ? 1 : 0.1}
                format={(n) => (Number.isInteger(m.value) ? Math.round(n).toString() : n.toFixed(1))}
              />
              {m.suffix}
            </p>
            <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
              {m.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
