import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, Play, Layers, Video, PenTool, type LucideIcon } from "lucide-react";
import { useReveal } from "../../motion/useReveal";
import { SegmentedControl } from "../../components/primitives/SegmentedControl";
import { Icon } from "../../components/primitives/Icon";
import { cx } from "../../lib/cx";

/* Moved off the Creatives page (which now ends in the rain takeover) —
   this is the landing spot for the spiral's logo button and the shatter.
   Placeholder layout: full redesign to come. */

type Discipline = "all" | "film" | "social" | "campaign" | "branding";

interface Work {
  id: number;
  title: string;
  client: string;
  category: Exclude<Discipline, "all">;
  tag: string;
  stat: string;
  grad: [string, string];
  tall?: boolean;
}

const WORKS: Work[] = [
  { id: 1, title: "Festival of Flavours", client: "FreshBite Foods", category: "campaign", tag: "Integrated campaign", stat: "8.2M reach", grad: ["var(--viz-orange)", "var(--viz-pink)"], tall: true },
  { id: 2, title: "Midnight Kitchen", client: "Chennai Bites", category: "film", tag: "Short film", stat: "2.4M views", grad: ["var(--viz-purple)", "var(--viz-blue)"] },
  { id: 3, title: "Nano Diaries", client: "Snack Box", category: "social", tag: "Reel series", stat: "7.9% ER", grad: ["var(--viz-green)", "var(--viz-teal)"] },
  { id: 4, title: "Heritage Marks", client: "Kerala Food Tales", category: "branding", tag: "Identity system", stat: "Full rebrand", grad: ["var(--viz-amber)", "var(--viz-orange)"] },
  { id: 5, title: "Street to Screen", client: "Delhi Eats", category: "film", tag: "Documentary", stat: "4.1M views", grad: ["var(--viz-blue)", "var(--viz-purple)"], tall: true },
  { id: 6, title: "The Founder's Table", client: "Anjali Kitchen", category: "social", tag: "Founder story", stat: "9.1% ER", grad: ["var(--viz-pink)", "var(--viz-orange)"] },
  { id: 7, title: "Onam Unboxed", client: "Malabar Tastes", category: "campaign", tag: "Regional launch", stat: "1.8M reach", grad: ["var(--viz-teal)", "var(--viz-green)"] },
  { id: 8, title: "Type & Table", client: "Lifestyle Lens", category: "branding", tag: "Art direction", stat: "Brand book", grad: ["var(--viz-purple)", "var(--viz-pink)"] },
  { id: 9, title: "Behind the Tandoor", client: "Mumbai Munchies", category: "film", tag: "Process film", stat: "1.2M views", grad: ["var(--viz-orange)", "var(--viz-amber)"], tall: true },
];

const FILTERS: { value: Discipline; label: string }[] = [
  { value: "all", label: "All" },
  { value: "film", label: "Film" },
  { value: "social", label: "Social" },
  { value: "campaign", label: "Campaigns" },
  { value: "branding", label: "Branding" },
];

const DISCIPLINES: { icon: LucideIcon; name: string; blurb: string }[] = [
  { icon: PenTool, name: "Content Creation", blurb: "Reels, carousels and stories built for the platform they live on." },
  { icon: Layers, name: "Creative Design", blurb: "Art direction and design systems that make a brand recognisable." },
  { icon: Video, name: "Video Production", blurb: "From founder films to fast-turn social — shot, cut and graded." },
  { icon: Play, name: "Branding", blurb: "Identity, voice and the visual language that carries every campaign." },
];

export default function PortfolioPage() {
  const [filter, setFilter] = useState<Discipline>("all");
  const gridRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.05 });
  const discRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const shown = filter === "all" ? WORKS : WORKS.filter((w) => w.category === filter);

  return (
    <>
      <section className="px-6 pb-12 pt-32 md:px-10 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Portfolio</p>
          <h1 className="mt-4 max-w-3xl font-serif text-display-lg text-ink">Work worth watching twice.</h1>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-2">
            Films, social series, campaigns and brand systems — made with regional creators and a house
            standard for craft.
          </p>
          <div className="mt-8 overflow-x-auto no-scrollbar">
            <SegmentedControl aria-label="Filter work" value={filter} onChange={setFilter} options={FILTERS} />
          </div>
        </div>
      </section>

      <section className="px-6 pb-16 md:px-10 md:pb-24">
        <div ref={gridRef} className="mx-auto grid max-w-[1200px] auto-rows-[220px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((w) => (
            <article
              data-reveal
              key={w.id}
              className={cx(
                "group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-line p-5",
                w.tall && "sm:row-span-2",
              )}
            >
              <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${w.grad[0]}, ${w.grad[1]})` }} />
              <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.02))" }} />
              <span className="absolute left-5 top-5 z-10 rounded-full bg-[rgba(0,0,0,0.3)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white backdrop-blur-sm">{w.tag}</span>
              <div className="relative z-10">
                <h3 className="font-serif text-title-lg text-white">{w.title}</h3>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-caption text-white/80">{w.client}</span>
                  <span className="tnum rounded-full bg-white/20 px-2 py-0.5 text-caption text-white backdrop-blur-sm">{w.stat}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Disciplines</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">One studio, every format.</h2>
          <div ref={discRef} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DISCIPLINES.map((d) => (
              <div data-reveal key={d.name} className="rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <Icon icon={d.icon} size={18} />
                </span>
                <h3 className="mt-4 text-title text-ink">{d.name}</h3>
                <p className="mt-2 text-body text-ink-2">{d.blurb}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link to="/start" className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover">
              Start a project
              <Icon icon={ArrowUpRight} size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link to="/creatives" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
              Back to Creatives
              <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
