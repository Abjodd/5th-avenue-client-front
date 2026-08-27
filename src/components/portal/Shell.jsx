/**
 * src/components/portal/Shell.jsx — the portal's layout vocabulary.
 *
 * The glass panel, the editorial section header and the KPI tile were each
 * hand-written a dozen times across Overview, Campaigns, the Regional Map and
 * Profile, with the radius, blur and shadow drifting a little every time.
 * They live here now, so a change to the portal's card treatment is one edit.
 *
 * Everything is presentational — no data, no fetching, no palette lookups.
 */
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { cx } from "../../lib/cx";
import { useAnchoredPosition } from "../../lib/useAnchoredPosition";
import AnimatedNumber from "../AnimatedNumber";
import { Reveal, StaggerItem } from "../motion/Motion";

/* ── Panel — the portal's card ─────────────────────────────────────────────
   `as` swaps the element (a <button> panel for clickable rows); `reveal`
   wraps it in the shared scroll-reveal so callers stop pairing the two by
   hand; `interactive` adds the standard lift-on-hover. */
export function Panel({
  children, className, as = "div", reveal = false, delay = 0, interactive = false, ...rest
}) {
  const cls = cx(
    "rounded-[20px] border border-line bg-[--color-glass] shadow-card backdrop-blur-xl",
    interactive &&
      "text-left transition-all duration-250 ease-out hover:-translate-y-[3px] hover:border-accent/20 hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]",
    className,
  );
  if (reveal) return <Reveal as={as} delay={delay} className={cls} {...rest}>{children}</Reveal>;
  const Tag = as;
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

/** Smaller inset panel — nested cards inside a Panel (a chart tile, a stat). */
export function Subpanel({ children, className, ...rest }) {
  return (
    <div
      className={cx(
        "rounded-[16px] border border-line bg-[--color-glass] shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── Section — the page's editorial rhythm ─────────────────────────────────
   A mono eyebrow over a serif headline, optionally with something on the
   right. `id` lands on the wrapper so the hero's signals can scroll to it. */
export function Section({ eyebrow, title, hint, action, id, children, className }) {
  return (
    <section id={id} className={cx("scroll-mt-28 pt-10", className)}>
      <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <div className="microlabel mb-1.5 tracking-[0.2em]">{eyebrow}</div>}
          <h2 className="font-serif text-[clamp(24px,3vw,32px)] font-bold italic leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h2>
          {hint && <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-sub">{hint}</p>}
        </div>
        {action}
      </Reveal>
      {children}
    </section>
  );
}

/* ── Info hint ─────────────────────────────────────────────────────────────
   The small circled "i" that says what a panel is actually showing. It was
   hand-written inline (own hover state, own popover box) each time a panel
   needed one, and the size, offset and wording drifted every time. One
   definition here means a panel asks for the explanation and gets the same
   control, and a panel that needs one no longer has to become stateful to
   have it.

   Opens on focus as well as hover, and never toggles shut on the same
   gesture that opened it: a tap both focuses the button and fires its click,
   so a toggling handler closed the hint the instant a touch reader asked for
   it. Leaving is what closes it. */
const HINT_W = 264;

export function InfoHint({ children, label = "What this shows", align = "right", className }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  // On <body>, for the same reason the period menu is — a panel that carries
  // `backdrop-blur` is a stacking context, so a hint drawn inside one is
  // painted over by whatever panel comes next.
  const at = useAnchoredPosition(open, btnRef, { width: HINT_W, align, gap: 8 });

  return (
    <span className={cx("inline-flex", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line bg-accent/[0.12] font-serif text-[12px] font-semibold italic normal-case leading-none text-accent transition-colors duration-200 hover:bg-accent/[0.22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* Lowercase serif italic, never the sans bold "I". `normal-case`
            is load-bearing: this button is dropped beside `microlabel`
            headings (StatTile, PanelTitle), and an inherited `uppercase`
            turns the glyph into a capital I with no tittle — which reads as
            a stray letter rather than an information affordance. */}
        i
      </button>
      {open && at && createPortal(
        <span
          role="tooltip"
          style={{ top: at.top, left: at.left, width: HINT_W }}
          className="fixed z-[200] rounded-[12px] border border-line bg-modal p-3 text-left text-[11.5px] font-normal leading-relaxed text-sub shadow-modal"
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}

/** Panel-level heading — serif italic title + one line of context. */
export function PanelTitle({ title, hint, info, action, className }) {
  return (
    <div className={cx("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="font-serif text-[19px] font-semibold italic text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-[12.5px] text-sub">{hint}</p>}
      </div>
      {/* The hint sits with the action rather than beside the title: a panel
          that has both keeps them on one right-hand cluster instead of
          pushing the heading off its own line. */}
      {(info || action) && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {info && <InfoHint>{info}</InfoHint>}
        </div>
      )}
    </div>
  );
}

/* ── KPI tile ──────────────────────────────────────────────────────────────
   A missing value renders "—" rather than a zero: the portal never lets a
   metric it couldn't measure look like a metric that measured zero. */
export function KPI({ label, value, format, sublabel, color, index = 0 }) {
  const missing = value == null;
  return (
    <StaggerItem className="group relative overflow-hidden rounded-[20px] border border-line bg-[--color-glass] px-5 py-[18px] shadow-card backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(25,22,17,0.08)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.05]"
        style={{ background: `radial-gradient(120% 90% at 100% 0%, ${color}, transparent 60%)` }}
      />
      <div className="microlabel mb-2 text-[11px] tracking-[0.09em]">{label}</div>
      <div
        className="tnum text-[30px] font-bold leading-none tracking-tight transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ color: missing ? "var(--donetxt)" : color }}
      >
        {missing ? "—" : <AnimatedNumber value={value} format={format} duration={1000} delay={index * 60} />}
      </div>
      {sublabel && <div className="mt-2 text-[11.5px] text-mute">{sublabel}</div>}
    </StaggerItem>
  );
}

/* ── Metric switch ─────────────────────────────────────────────────────────
   The ER / Reach / Views toggle over a grouped view. Options are computed
   from the data (lib/portalMetrics availableMetrics), so a metric the DB
   can't answer never appears as a dead tab. */
export function MetricSwitch({ options, value, onChange, label = "Metric" }) {
  if (options.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 rounded-full border border-line bg-[--color-glass] p-1 shadow-sm backdrop-blur-sm">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={cx(
              "relative rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors duration-200",
              on ? "text-white" : "text-sub hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={`metric-${label}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                // Derived from the accent rather than a frozen navy rgba:
                // the dark theme's accent is a lighter blue, and a hardcoded
                // navy glow under it read as a shadow from a different button.
                className="absolute inset-0 rounded-full bg-accent shadow-[0_3px_10px_var(--accent-muted)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Inline "nothing here yet" note for a panel that has no data to draw. */
export function PanelEmpty({ children }) {
  return (
    // flex-1 so an empty panel fills the height of whatever it sits beside in a
    // stretched grid row, rather than collapsing to its minimum and leaving the
    // dashed box floating above a gap.
    <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-[16px] border border-dashed border-line-mid px-5 py-8 text-center text-[12px] leading-relaxed text-mute">
      {children}
    </div>
  );
}
