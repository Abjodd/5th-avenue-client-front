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
import { FlipCard } from "./FlipCard";

/* ── Panel — the portal's card ─────────────────────────────────────────────
   `as` swaps the element (a <button> panel for clickable rows); `reveal`
   wraps it in the shared scroll-reveal so callers stop pairing the two by
   hand; `interactive` adds the standard lift-on-hover.

   `flip` is opt-in: pass it with `back` (the content for the reverse face)
   and the panel turns over on a click anywhere on it instead of just
   sitting there. Off by default so every existing Panel — Campaigns,
   Profile, the Regional Map — is untouched; only call sites that actually
   pass `flip` change at all. A click that lands on something the panel
   already had (a metric switch, a chart's own toggle) still reaches that
   control instead of flipping the card out from under it — see
   FlipCard's INTERACTIVE_SELECTOR. */
export function Panel({
  children, className, as = "div", reveal = false, delay = 0, interactive = false,
  flip = false, back, ...rest
}) {
  const chrome = cx(
    "rounded-[20px] border border-line bg-glass shadow-card backdrop-blur-xl",
    interactive &&
      "text-left transition-all duration-250 ease-out hover:-translate-y-[3px] hover:border-accent/20 hover:shadow-[0_16px_34px_rgba(25,22,17,0.1)]",
  );
  const cls = cx(chrome, className);

  if (flip) {
    const card = (
      <FlipCard
        back={back}
        cardClassName={cls}
        backClassName={chrome}
        className="h-full"
      >
        {children}
      </FlipCard>
    );
    return reveal
      ? <Reveal as={as} delay={delay} className="h-full" {...rest}>{card}</Reveal>
      : card;
  }

  if (reveal) return <Reveal as={as} delay={delay} className={cls} {...rest}>{children}</Reveal>;
  const Tag = as;
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

/** Smaller inset panel — nested cards inside a Panel (a chart tile, a stat). */
export function Subpanel({ children, className, ...rest }) {
  return (
    <div
      className={cx(
        "rounded-[16px] border border-line bg-glass shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md",
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
   metric it couldn't measure look like a metric that measured zero.

   `back` is opt-in, same idea as Panel's `flip`: pass a node and the tile
   flips on a click anywhere on it. Leave it unset and the tile behaves
   exactly as before.

   `flush` drops the tile's own card chrome — border, radius, shadow, lift —
   so a row of them sits inside ONE panel as a ledger band divided by
   hairlines, the way a broadsheet prints a summary table, instead of
   floating as six shadowed boxes. Only the chrome changes.

   `tick` overrides the flush column rule's colour (it follows the figure by
   default) for a band whose rule carries a legend rather than the value.
   `size` steps the figure down for long strings — exact currency runs far
   wider than a count. */
export function KPI({
  label, value, format, sublabel, color, index = 0, back, flush = false,
  tick = color, showTick = true, size = "lg",
}) {
  const missing = value == null;
  // Padding held apart from the chrome so the back can take the chrome
  // without it — see FlipCard's `backClassName` note. Applied twice, it left
  // these tiles' summaries in half their own box.
  const pad = flush ? "px-5 py-[17px]" : "px-5 py-[18px]";
  const chromeBase = flush
    // No lift and no shadow: a cell that rises out of a band it is ruled into
    // reads as broken rather than interactive, so the hover is a wash instead.
    // Top-aligned, not centered: a row's cells share one height (the grid's
    // own stretch), and a shorter sublabel in one cell must not re-centre
    // that cell's tick/label/value a few px off the next cell's.
    ? "group relative flex flex-col overflow-hidden bg-glass-strong transition-colors duration-300 ease-out hover:bg-hover"
    : "group relative overflow-hidden rounded-[20px] border border-line bg-glass shadow-card backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(25,22,17,0.08)]";
  const chrome = cx(chromeBase, pad);

  const face = (
    <>
      {/* A corner wash is a card affordance; six inside one band is noise, so
          a flush cell wears a column rule — the mark a ruled table puts at the
          head of a column. `showTick` opts a band out of it entirely. */}
      {flush && showTick ? (
        <div
          aria-hidden
          className="kpi-tick mb-2.5 h-[2px] w-5 rounded-full transition-all duration-300 group-hover:w-8"
          style={{ background: tick, opacity: missing ? 0.25 : 0.55 }}
        />
      ) : !flush ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px] opacity-[0.05]"
          style={{ background: `radial-gradient(120% 90% at 100% 0%, ${color}, transparent 60%)` }}
        />
      ) : null}
      <div className="microlabel mb-2 text-[11px] tracking-[0.09em]">{label}</div>
      <div
        className={cx(
          "tnum font-bold leading-none tracking-tight",
          size === "sm" ? "text-[21px]" : "text-[30px]",
        )}
        style={{ color: missing ? "var(--donetxt)" : color }}
      >
        {missing ? "—" : <AnimatedNumber value={value} format={format} duration={1000} delay={index * 60} />}
      </div>
      {sublabel && <div className="mt-2 text-[11.5px] text-mute">{sublabel}</div>}
    </>
  );

  if (back) {
    return (
      <StaggerItem className="h-full">
        {/* radius 0 when flush — the turning box is a cell ruled into a band,
            and a rounded shadow on it during the flip would round a corner
            the cell itself doesn't have. */}
        <FlipCard back={back} cardClassName={chrome} backClassName={chromeBase} className="h-full" radius={flush ? 0 : 20}>
          {face}
        </FlipCard>
      </StaggerItem>
    );
  }

  return <StaggerItem className={chrome}>{face}</StaggerItem>;
}

/* ── Metric switch ─────────────────────────────────────────────────────────
   The ER / Reach / Views toggle over a grouped view. Options are computed
   from the data (lib/portalMetrics availableMetrics), so a metric the DB
   can't answer never appears as a dead tab. */
export function MetricSwitch({ options, value, onChange, label = "Metric" }) {
  if (options.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 rounded-full border border-line bg-glass p-1 shadow-sm backdrop-blur-sm">
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
