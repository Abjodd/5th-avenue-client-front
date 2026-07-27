import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useReveal } from "../../../motion/useReveal";
import { CTA_BAND } from "../../../lib/marketing/data/landing-copy";
import { Icon } from "../../../components/primitives/Icon";

export function CtaBand() {
  const ref = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.1 });
  return (
    <section id="contact" className="relative overflow-hidden border-t border-line">
      {/* ambient dotted grid + slow accent drift */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(70% 60% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 50%, black, transparent)",
        }}
      />
      <div
        aria-hidden
        className="fa-drift pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, var(--accent-muted), transparent 70%)" }}
      />

      <div ref={ref} className="mx-auto max-w-3xl px-6 py-28 text-center md:py-36">
        <h2 data-reveal className="font-serif text-display-2xl text-ink">
          {CTA_BAND.statement}
        </h2>
        <p data-reveal className="mx-auto mt-5 max-w-lg text-body-lg text-ink-2">
          {CTA_BAND.sub}
        </p>
        <div data-reveal className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/start"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            {CTA_BAND.primary}
            <Icon icon={ArrowRight} size={16} />
          </Link>
          <a
            href={`mailto:${CTA_BAND.secondary}`}
            className="inline-flex h-11 items-center rounded-md border border-line px-5 font-mono text-label text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            {CTA_BAND.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
