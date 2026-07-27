import { Link } from "react-router-dom";
import {
  Database, Cpu, Gauge, LineChart as LineIcon, Braces, Radar, ArrowUpRight, ArrowRight, Zap,
} from "lucide-react";
import { useReveal } from "../../motion/useReveal";
import { AnimatedNumber } from "../../motion/AnimatedNumber";
import { Sparkline, DonutChart } from "../../components/charts";
import { Icon } from "../../components/primitives/Icon";
import type { LucideIcon } from "lucide-react";

interface Capability {
  icon: LucideIcon;
  name: string;
  blurb: string;
  tags: string[];
}

const CAPABILITIES: Capability[] = [
  { icon: LineIcon, name: "Analytics & Reporting", blurb: "Live dashboards that turn scattered campaign data into one accountable view — reach, ROI and auto-surfaced insights, refreshed continuously.", tags: ["Live dashboards", "ROI", "Auto-insights"] },
  { icon: Radar, name: "AI Search Optimization", blurb: "Engineer your brand into the answers AI assistants give — schema, entity coverage and answer-engine positioning across the models people actually ask.", tags: ["AEO", "Schema", "Answer positioning"] },
  { icon: Cpu, name: "AI-enabled Ops", blurb: "Creator matching, brief drafting and content QA accelerated by models in the loop — the busywork automated so strategists spend time on judgement.", tags: ["Creator matching", "Brief AI", "QA"] },
  { icon: Database, name: "Data Science", blurb: "Marketing-mix modeling, cohort and attribution analysis on your first-party data — so budget follows evidence, not the loudest opinion.", tags: ["Mix modeling", "Attribution", "Cohorts"] },
  { icon: Braces, name: "Web & Dashboards", blurb: "Fast, measurable properties — landing pages, microsites and bespoke client dashboards built to the same engineering bar as this platform.", tags: ["Landing pages", "Microsites", "Portals"] },
  { icon: Gauge, name: "Speed of Delivery", blurb: "Instrumented pipelines and a component system mean a dashboard or campaign report ships in days, not quarters — and updates itself after.", tags: ["Rapid builds", "Automation", "Always-on"] },
];

const SPEED = [
  { label: "Avg dashboard turnaround", value: 48, suffix: "h" },
  { label: "Data sources unified", value: 14, suffix: "" },
  { label: "Reports auto-refreshed", value: 100, suffix: "%" },
  { label: "Models in the loop", value: 6, suffix: "" },
];

const MOCK_SPLIT = [
  { label: "Influencer", value: 46, color: "var(--viz-blue)" },
  { label: "AI Search", value: 28, color: "var(--viz-green)" },
  { label: "Performance", value: 26, color: "var(--viz-purple)" },
];

export default function TechPage() {
  const capsRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const speedRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.05 });

  return (
    <>
      {/* hero */}
      <section className="border-b border-line px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Tech &amp; Data</p>
          <h1 className="mt-4 max-w-3xl font-serif text-display-lg text-ink">
            Marketing, run like an engineering team.
          </h1>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-2">
            Data science, analytics, dashboards and AI-enabled operations — the machinery underneath the
            campaigns. Everything is measured, everything compounds, and the numbers arrive before you ask.
          </p>
        </div>
      </section>

      {/* live dashboard moment */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
              <Icon icon={LineIcon} size={13} /> Instrumented by default
            </p>
            <h2 className="mt-3 font-serif text-display-lg text-ink">Dashboards that update themselves.</h2>
            <p className="mt-4 max-w-lg text-body-lg text-ink-2">
              Every engagement ships with a live view — spend, reach and efficiency reconciled from all your
              channels into one honest picture. No monthly deck lag; the truth is always on screen.
            </p>
          </div>

          {/* mock dashboard card (all local, CSP-safe) */}
          <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">Live · campaign health</p>
              <span className="flex items-center gap-1.5 text-caption text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> streaming
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: "Reach", v: 26.5, fmt: (n: number) => `${n.toFixed(1)}M` },
                { k: "Avg ER", v: 5.4, fmt: (n: number) => `${n.toFixed(1)}%` },
                { k: "₹/1M reach", v: 0.96, fmt: (n: number) => `₹${n.toFixed(2)}L` },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-line bg-bg p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">{s.k}</p>
                  <p className="tnum mt-1 text-title text-ink"><AnimatedNumber value={s.v} format={s.fmt} snap={0.01} /></p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3">
              <div className="rounded-xl border border-line bg-bg p-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Reach trend</p>
                <Sparkline data={[8, 11, 14, 18, 22, 24, 26.5]} width={220} height={48} color="var(--viz-blue)" className="h-auto w-full" />
              </div>
              <div className="rounded-xl border border-line bg-bg p-3">
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Spend split</p>
                <DonutChart data={MOCK_SPLIT} size={92} thickness={12} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* capabilities */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Capabilities</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">The stack behind the storytelling.</h2>
          <div ref={capsRef} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <div data-reveal key={c.name} className="flex flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <Icon icon={c.icon} size={18} />
                </span>
                <h3 className="mt-4 text-title text-ink">{c.name}</h3>
                <p className="mt-2 flex-1 text-body text-ink-2">{c.blurb}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-full bg-hover px-2.5 py-0.5 text-caption text-ink-2">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* speed of delivery */}
      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="flex items-center gap-2 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
            <Icon icon={Zap} size={13} /> Speed of delivery
          </p>
          <h2 className="mt-3 font-serif text-display-lg text-ink">Days, not quarters.</h2>
          <div ref={speedRef} className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {SPEED.map((s) => (
              <div data-reveal key={s.label} className="border-l border-line pl-4">
                <p className="tnum font-serif text-[clamp(36px,5vw,56px)] leading-none text-ink">
                  <AnimatedNumber value={s.value} snap={1} />{s.suffix}
                </p>
                <p className="mt-2 font-mono text-eyebrow uppercase tracking-[0.1em] text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link to="/start" className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover">
              Start a project
              <Icon icon={ArrowUpRight} size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/creatives" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
              See the creative work
              <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
