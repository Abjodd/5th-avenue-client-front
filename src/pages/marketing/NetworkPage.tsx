import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Users, Megaphone, Globe, ArrowRight } from "lucide-react";
import { gsap, useGSAP, SplitText } from "../../motion/gsap";
import { EASE, DUR } from "../../motion/tokens";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { useReveal } from "../../motion/useReveal";
import { AnimatedNumber } from "../../motion/AnimatedNumber";
import { IndiaMap } from "../../components/map/IndiaMap";
import {
  STATES_META, STATE_DATA, STATE_DETAIL, REGION_COLORS, REGION_NAMES,
} from "../../lib/marketing/data/map-data";
import { Icon } from "../../components/primitives/Icon";

const ACTIVE_STATES = Object.keys(STATE_DATA).filter((id) => (STATE_DATA[id]?.cr ?? 0) > 0);

/* Portfolio-scale figures for the public site — deterministic per state and
   weighted by reach, so bigger markets read bigger. Creators land in 50–5000,
   campaigns in 15–200 as the brief specifies. */
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
function reachNum(r: string | undefined) {
  if (!r || r === "—") return 0;
  const n = parseFloat(r);
  if (r.includes("M")) return n * 1e6;
  if (r.includes("K")) return n * 1e3;
  return n;
}
const MAX_REACH = Math.max(...ACTIVE_STATES.map((id) => reachNum(STATE_DATA[id]?.r)), 1);
function portfolio(id: string) {
  const w = Math.min(1, reachNum(STATE_DATA[id]?.r) / MAX_REACH);
  const s = Math.min(1, w * (0.78 + hashStr(id) * 0.4)); // plausibility jitter
  return {
    creators: Math.round(50 + s * (5000 - 50)),
    campaigns: Math.round(15 + s * (200 - 15)),
  };
}

/** Large state name that types itself in each time the selection changes. */
function StateName({ id }: { id: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const name = STATES_META[id]?.name ?? id;
  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      const split = new SplitText(ref.current, { type: "chars" });
      gsap.from(split.chars, {
        opacity: 0, y: 8, duration: DUR.sm, stagger: 0.03, ease: EASE.out,
      });
      return () => split.revert();
    },
    { dependencies: [id], scope: ref },
  );
  return (
    <h3 ref={ref} className="font-serif text-display-lg leading-[0.95] text-ink">
      {name}
    </h3>
  );
}

export default function NetworkPage() {
  const [selected, setSelected] = useState<string>("mh");
  const bodyRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.05 });

  const meta = STATES_META[selected];
  const data = STATE_DATA[selected];
  const detail = STATE_DETAIL[selected];
  const fig = portfolio(selected);

  // Every state carries its region colour — the map reads as one whole country,
  // not a few lit states over grey. The selected state still pops via dimUnfocused.
  const colorFor = (id: string) => {
    const m = STATES_META[id];
    return m ? REGION_COLORS[m.region] : "var(--hover)";
  };

  return (
    <>
      {/* hero */}
      <section className="border-b border-line px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Regional creator network</p>
          <h1 className="mt-4 max-w-3xl font-serif text-display-lg text-ink">
            Authentic voices, in every language your market speaks.
          </h1>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-2">
            National influencers buy you attention. Regional creators buy you trust. Explore the network
            state by state — the exclusive creators we represent and the reach we command on the ground.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Audience reached", value: "26.5M" },
              { label: "Creators engaged", value: 77 },
              { label: "Campaigns delivered", value: 22 },
              { label: "States active", value: ACTIVE_STATES.length },
            ].map((s) => (
              <div key={s.label}>
                <p className="tnum font-serif text-title-lg text-ink">
                  {typeof s.value === "number" ? <AnimatedNumber value={s.value} snap={1} /> : s.value}
                </p>
                <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.1em] text-ink-3">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* interactive map + drill */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_1fr]">
          {/* map */}
          <div className="flex items-center">
            <IndiaMap
              colorFor={colorFor}
              selected={selected}
              onSelectState={(id) => setSelected(id)}
              dimUnfocused
              outline="var(--border-strong)"
              outlineWidth={0.8}
              className="max-h-[560px]"
            />
          </div>

          {/* drill panel — reflects the currently selected state */}
          <div ref={bodyRef} className="flex flex-col">
            <div data-reveal>
              <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                {meta ? REGION_NAMES[meta.region] : "—"} · {meta?.lang}
              </p>
              <div className="mt-2 min-h-[64px]">
                {/* key forces a fresh mount per selection — otherwise SplitText's
                    revert() restores the previous state's text over React's update. */}
                <StateName key={selected} id={selected} />
              </div>
            </div>

            {data && (
              <div data-reveal className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { icon: Users, label: "Creators", value: fig.creators, isNum: true },
                  { icon: Megaphone, label: "Campaigns", value: fig.campaigns, isNum: true },
                  { icon: MapPin, label: "Reach", value: data.r, isNum: false },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-line bg-card p-4">
                    <Icon icon={s.icon} size={16} className="text-ink-3" />
                    <p className="tnum mt-2 text-title text-ink">
                      {s.isNum ? <AnimatedNumber value={s.value as number} snap={1} /> : (s.value as string)}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {detail ? (
              <div data-reveal className="mt-6">
                <p className="mb-2 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Top exclusive creators</p>
                <div className="flex flex-wrap gap-2">
                  {detail.creators.map((c) => (
                    <span key={c} className="rounded-full border border-line bg-card px-3 py-1 text-caption text-ink-2">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p data-reveal className="mt-6 text-body text-ink-3">
                No creators listed here yet — talent is available on request across this market.
              </p>
            )}

            <div data-reveal className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/apply" className="group inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover">
                Apply as Creator
                <Icon icon={ArrowRight} size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link to="/international" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                <Icon icon={Globe} size={15} /> International campaigns
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
