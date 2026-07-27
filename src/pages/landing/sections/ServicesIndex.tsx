import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useReveal } from "../../../motion/useReveal";
import { SERVICE_GROUPS, type Service } from "../../../lib/marketing/data/services";
import { Icon } from "../../../components/primitives/Icon";
import { cx } from "../../../lib/cx";

function Row({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      data-reveal
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      className="group flex w-full items-start gap-4 border-t border-line py-5 text-left transition-colors hover:bg-hover/40 md:gap-6 md:px-2"
    >
      <span className="tnum w-8 pt-1 font-mono text-caption text-ink-3">{service.index}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-title font-medium text-ink transition-colors">
            {service.name}
          </span>
          <Icon
            icon={ArrowUpRight}
            size={18}
            className={cx(
              "shrink-0 text-ink-3 transition-all duration-200",
              "opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
            )}
          />
        </div>
        <div
          className={cx(
            "grid transition-all duration-300 ease-out",
            open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <p className="max-w-lg text-body text-ink-2">{service.blurb}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {service.tags.map((t) => (
                <span key={t} className="rounded-full border border-line px-2 py-0.5 text-caption text-ink-3">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ServicesIndex() {
  const ref = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.04 });
  return (
    <section id="services" className="border-t border-line">
      <div ref={ref} className="mx-auto max-w-[1200px] px-6 py-24 md:px-10 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p data-reveal className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
            Services
          </p>
          <h2 data-reveal className="mt-4 font-serif text-display-lg text-ink">
            Sixteen capabilities. One accountable team.
          </h2>
        </div>

        <div className="grid gap-x-16 gap-y-10 md:grid-cols-2">
          {SERVICE_GROUPS.map((group) => (
            <div key={group.id} data-reveal>
              <p className="mb-1 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                {group.label}
              </p>
              <div className="border-b border-line">
                {group.services.map((s) => (
                  <Row key={s.name} service={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
