import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { useReveal } from "../../../motion/useReveal";
import { Icon } from "../../../components/primitives/Icon";
import { serviceBySlug, type Service } from "../../../lib/marketing/data/services";
import { SERVICE_PAGES, type ServicePageCopy } from "../../../lib/marketing/data/service-pages";
import { CtaBand } from "../../landing/sections/CtaBand";
import NotFound from "../../NotFound";

/** /services/:slug — one long-form page per service. The copy lives in
    service-pages.ts and is also prerendered into the HTML at build time
    (src/seo/site.js), so this component and search engines read the same text. */
export default function ServicePage() {
  const { slug = "" } = useParams();
  const service = serviceBySlug(slug);
  const copy = SERVICE_PAGES[slug];
  if (!service || !copy) return <NotFound />;
  // keyed so reveal animations re-run when moving between services
  return <ServiceBody key={slug} service={service} copy={copy} />;
}

const eyebrow = "font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3";

function ServiceBody({ service, copy }: { service: Service; copy: ServicePageCopy }) {
  const heroRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06, immediate: true });
  const incRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const stepRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const whyRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const related = copy.related.map((s) => serviceBySlug(s)).filter(Boolean) as Service[];

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-line px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(50% 55% at 85% 0%, var(--accent-muted) 0%, transparent 70%)" }}
        />
        <div ref={heroRef} className="mx-auto max-w-[1200px]">
          <nav data-reveal aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center gap-2 text-caption text-ink-3">
              <li><Link to="/" className="transition-colors hover:text-ink">Home</Link></li>
              <li aria-hidden>/</li>
              <li><Link to="/services" className="transition-colors hover:text-ink">Services</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink-2">{service.name}</li>
            </ol>
          </nav>
          <p data-reveal className={eyebrow}>
            {service.index} — {service.group}
          </p>
          <h1 data-reveal className="mt-4 max-w-4xl font-serif text-display-lg text-ink first-letter:uppercase">
            {copy.h1}
          </h1>
          <p data-reveal className="mt-5 max-w-2xl text-body-lg text-ink-2">{copy.lede}</p>
          <div data-reveal className="mt-7 flex flex-wrap gap-1.5">
            {service.tags.map((t) => (
              <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-caption text-ink-2">{t}</span>
            ))}
          </div>
          <div data-reveal className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/start"
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Start a project
              <Icon icon={ArrowRight} size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/services"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              All services
            </Link>
          </div>
        </div>
      </section>

      {/* overview */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-6 md:grid-cols-[220px_1fr] md:gap-16">
          <p className={`${eyebrow} md:pt-2`}>Overview</p>
          <div className="max-w-3xl space-y-5">
            {copy.overview.map((p, i) => (
              <p key={i} className={i === 0 ? "font-serif text-[clamp(22px,2.4vw,30px)] leading-[1.3] text-ink" : "text-body-lg text-ink-2"}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* what's included */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>What's included</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">The work, end to end.</h2>
          <div ref={incRef} className="mt-10 grid gap-4 sm:grid-cols-2">
            {copy.included.map((c, i) => (
              <div data-reveal key={c.title} className="flex gap-5 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong md:p-7">
                <span className="tnum pt-1 font-mono text-caption text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-title text-ink">{c.title}</h3>
                  <p className="mt-2 text-body text-ink-2">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>How it works</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">From brief to results.</h2>
          <ol ref={stepRef} className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {copy.process.map((s, i) => (
              <li data-reveal key={s.title} className="border-t border-line-strong pt-5">
                <span className="tnum font-serif text-[40px] italic leading-none text-accent">{i + 1}</span>
                <h3 className="mt-4 text-title text-ink">{s.title}</h3>
                <p className="mt-2 text-body text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* why fifth avenue */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>Why Fifth Avenue</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">
            One team. One <span className="italic text-accent">calm</span> dashboard.
          </h2>
          <div ref={whyRef} className="mt-10 grid gap-8 md:grid-cols-3">
            {copy.why.map((w) => (
              <div data-reveal key={w.title} className="border-l border-line pl-5">
                <h3 className="text-title text-ink">{w.title}</h3>
                <p className="mt-2 text-body text-ink-2">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — native <details>: crawlable, keyboard-accessible, no JS needed */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-[1fr_1.6fr] md:gap-16">
          <div>
            <p className={eyebrow}>FAQ</p>
            <h2 className="mt-3 font-serif text-display-lg text-ink">Questions, answered.</h2>
          </div>
          <div className="border-b border-line">
            {copy.faqs.map((f) => (
              <details key={f.q} className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <h3 className="text-title font-medium text-ink">{f.q}</h3>
                  <Icon icon={Plus} size={18} className="mt-1 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45" />
                </summary>
                <p className="max-w-2xl pb-6 text-body-lg text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* related */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className={eyebrow}>Related services</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/services/${r.slug}`}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
              >
                <span className="flex items-center justify-between">
                  <span className="tnum font-mono text-caption text-ink-3">{r.index}</span>
                  <Icon icon={ArrowUpRight} size={18} className="text-ink-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </span>
                <span className="mt-4 text-title font-medium text-ink">{r.name}</span>
                <span className="mt-2 text-body text-ink-2">{r.blurb}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
