import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useReveal } from "../../../motion/useReveal";
import { Icon } from "../../../components/primitives/Icon";
import { SERVICE_GROUPS } from "../../../lib/marketing/data/services";
import { SERVICES_HUB } from "../../../lib/marketing/data/service-pages";
import { CtaBand } from "../../landing/sections/CtaBand";

/** /services — every service, grouped, each linking to its own page. */
export default function ServicesHub() {
  const heroRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06, immediate: true });
  const listRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.05 });

  return (
    <>
      <section className="relative overflow-hidden border-b border-line px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(50% 55% at 85% 0%, var(--accent-muted) 0%, transparent 70%)" }}
        />
        <div ref={heroRef} className="mx-auto max-w-[1200px]">
          <p data-reveal className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Services</p>
          <h1 data-reveal className="mt-4 max-w-3xl font-serif text-display-lg text-ink">{SERVICES_HUB.h1}</h1>
          <p data-reveal className="mt-5 max-w-2xl text-body-lg text-ink-2">{SERVICES_HUB.lede}</p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 md:py-24">
        <div ref={listRef} className="mx-auto grid max-w-[1200px] gap-x-16 gap-y-14 md:grid-cols-2">
          {SERVICE_GROUPS.map((group) => (
            <div key={group.id} data-reveal>
              <h2 className="mb-1 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">{group.label}</h2>
              <ul className="border-b border-line">
                {group.services.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to={`/services/${s.slug}`}
                      className="group flex items-start gap-4 border-t border-line py-5 transition-colors hover:bg-hover/40 md:gap-6 md:px-2"
                    >
                      <span className="tnum w-8 pt-1 font-mono text-caption text-ink-3">{s.index}</span>
                      <span className="flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-title font-medium text-ink">{s.name}</span>
                          <Icon
                            icon={ArrowUpRight}
                            size={18}
                            className="shrink-0 text-ink-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                          />
                        </span>
                        <span className="mt-1.5 block max-w-lg text-body text-ink-2">{s.blurb}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
