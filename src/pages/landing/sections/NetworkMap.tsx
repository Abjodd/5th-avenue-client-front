import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useReveal } from "../../../motion/useReveal";
import { useTheme } from "../../../context/ThemeContext";
import { IndiaMap } from "../../../components/map/IndiaMap";
import {
  REGIONS_DATA,
  REGION_COLORS,
  STATES_META,
  STATE_DATA,
} from "../../../lib/marketing/data/map-data";
import { NETWORK } from "../../../lib/marketing/data/landing-copy";
import { Icon } from "../../../components/primitives/Icon";
import { cx } from "../../../lib/cx";

export function NetworkMap() {
  const ref = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const { theme } = useTheme();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<string | null>(null);
  const activeRegion = hoverRegion ?? selectedRegion;

  // light mode desaturates the region fills toward white so the map reads muted
  const regionFill = (region: keyof typeof REGION_COLORS) =>
    theme === "light"
      ? `color-mix(in oklab, ${REGION_COLORS[region]} 52%, #ffffff)`
      : REGION_COLORS[region];

  const colorFor = (id: string) => {
    const region = STATES_META[id]?.region;
    if (!region) return "var(--hover)";
    return regionFill(region);
  };

  const tooltip = hoverState
    ? { name: STATES_META[hoverState]?.name, data: STATE_DATA[hoverState] }
    : null;

  return (
    <section id="network" className="border-t border-line">
      <div
        ref={ref}
        className="mx-auto grid max-w-[1200px] gap-12 px-6 py-24 md:grid-cols-[1fr_1fr] md:gap-16 md:px-10 md:py-32"
      >
        {/* copy column */}
        <div className="flex flex-col justify-center">
          <p data-reveal className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
            {NETWORK.eyebrow}
          </p>
          <h2 data-reveal className="mt-4 font-serif text-display-lg text-ink">
            {NETWORK.title}
          </h2>
          <p data-reveal className="mt-5 max-w-md text-body-lg text-ink-2">
            {NETWORK.body}
          </p>

          <div data-reveal className="mt-8">
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">Regions</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {REGIONS_DATA.map((r) => {
                const on = selectedRegion === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRegion(on ? null : r.id)}
                    onMouseEnter={() => setHoverRegion(r.id)}
                    onMouseLeave={() => setHoverRegion(null)}
                    style={on ? { boxShadow: "var(--region-glow)" } : undefined}
                    className={cx(
                      "flex flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 text-left transition-all duration-200",
                      on ? "border-line-strong" : "border-line hover:border-line-strong",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: REGION_COLORS[r.id] }} />
                      <span className="text-body font-semibold text-ink">{r.name}</span>
                    </span>
                    <span className="tnum text-caption text-ink-3">{r.m.cr} creators</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div data-reveal className="mt-6 flex items-baseline gap-2.5">
            <span className="font-serif text-title-lg leading-none text-ink">30+</span>
            <span className="text-body text-ink-2">languages spoken across the network</span>
          </div>

          <div data-reveal className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/apply"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              {NETWORK.applyCta}
              <Icon icon={ArrowUpRight} size={16} />
            </Link>
            <Link
              to="/regional"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-5 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              {NETWORK.exploreCta}
              <Icon icon={ArrowRight} size={16} />
            </Link>
          </div>
        </div>

        {/* map column */}
        <div data-reveal className="relative flex items-center justify-center">
          <div className="relative w-full max-w-md">
            <IndiaMap
              colorFor={activeRegion
                ? (id) =>
                    STATES_META[id]?.region === activeRegion
                      ? regionFill(activeRegion as keyof typeof REGION_COLORS)
                      : "var(--hover)"
                : colorFor}
              onHoverState={setHoverState}
              dimUnfocused={!activeRegion}
              animateIn
              className="max-h-[520px]"
            />
            {tooltip && tooltip.data && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border border-line bg-modal px-3 py-2 shadow-pop">
                <p className="text-caption font-medium text-ink">{tooltip.name}</p>
                <p className="tnum mt-0.5 text-[11px] text-ink-3">
                  {tooltip.data.cr} creators · {tooltip.data.r} reach
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
