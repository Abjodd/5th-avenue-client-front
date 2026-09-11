/**
 * src/components/portal/FlipCard.jsx — the portal's flip-to-summary card.
 *
 * A handful of Overview cards (service cards, the pipeline, the podium, the
 * grouped creator chart, the growth panel, the KPI/stat tiles, and the
 * Performance section's graphs) hold data whose plain-language read is one
 * or two lines, not a re-drawn chart. FlipCard is the mechanism for that: a
 * real 3D turn on the Y axis — not a crossfade — lands on a back face built
 * from the same numbers, worded out.
 *
 * Click anywhere on the card to flip it — no separate control to find or
 * explain. A click that lands on something the card already had (a metric
 * switch, a chart's own toggle, a legend row) is left alone: INTERACTIVE_
 * SELECTOR below is checked first, and a match returns without flipping, so
 * those keep doing exactly what they did before the card could turn over.
 *
 * The FRONT sets the card's size — exactly like the plain (non-flip) version
 * of the same card did before it could flip, so turning a card over never
 * changes how much room the page gives it. The back is layered on top with
 * `position: absolute; inset: 0; overflow: hidden`, sized to match rather
 * than left to dictate its own height. That is why every back face here is
 * written short: a line or two, not a paragraph — it has exactly the front's
 * box to work with, on purpose, not by accident.
 *
 * `backfaceVisibility: hidden` needs its `-webkit-` twin, or Safari (still
 * the default browser on iOS/macOS) never actually hides the reverse face —
 * both faces paint at once, the back's mirrored text bleeding through the
 * front like a ghost. Same for `transform-style: preserve-3d`. Both are set
 * with both the unprefixed and `Webkit`-prefixed style keys below.
 *
 * `prefers-reduced-motion` swaps the 3D turn for a plain crossfade — the
 * same back face, no rotation.
 */
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cx } from "../../lib/cx";
import { EASE, SPRING } from "../../lib/motion";

const POP = { duration: 0.55, ease: EASE };

// A click on any of these is the card's own business, not a request to flip.
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="tab"], [role="button"], [contenteditable="true"]';

/**
 * `cardClassName` is the front's visual chrome — the same rounded/border/bg/
 * shadow classes the caller would otherwise put on a plain Panel/tile, and
 * what actually sizes the card. `backClassName` (defaults to `cardClassName`)
 * is the back's chrome — kept separate because the back almost never wants
 * the front's own layout classes (flex/padding for the real content)
 * repeated under FlipSummary's own layout.
 */
export function FlipCard({
  children,
  back,
  cardClassName,
  backClassName,
  className,
  style,
  radius = 20,
  as: Tag = "div",
  ...rest
}) {
  const [flipped, setFlipped] = useState(false);
  const reduce = useReducedMotion();
  const backCls = backClassName ?? cardClassName;

  const onClick = (e) => {
    if (e.target.closest?.(INTERACTIVE_SELECTOR)) return;
    setFlipped((f) => !f);
  };

  if (reduce) {
    return (
      <Tag className={cx("relative cursor-pointer", className)} style={style} onClick={onClick} {...rest}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={flipped ? "back" : "front"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={flipped ? backCls : cardClassName}
          >
            {flipped ? back : children}
          </motion.div>
        </AnimatePresence>
      </Tag>
    );
  }

  return (
    <Tag
      className={cx("relative cursor-pointer", className)}
      style={{ perspective: 1600, WebkitPerspective: 1600, ...style }}
      onClick={onClick}
      {...rest}
    >
      <motion.div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          borderRadius: radius,
        }}
        animate={{
          rotateY: flipped ? 180 : 0,
          scale: [1, 1.035, 1],
          boxShadow: [
            "0 10px 28px rgba(20,16,10,0.08)",
            "0 26px 58px var(--accent-muted)",
            "0 10px 28px rgba(20,16,10,0.08)",
          ],
        }}
        transition={{ rotateY: SPRING, scale: POP, boxShadow: POP }}
      >
        {/* Front — normal flow, so its natural size is the card's size. */}
        <div
          className={cx("h-full w-full", cardClassName)}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: flipped ? "none" : "auto",
          }}
        >
          {children}
        </div>
        {/* Back — pinned to the front's box, clipped rather than left to grow
            past it. `back` is written to fit that box, not the other way
            round; overflow-hidden is the guard rail if it ever doesn't.
            `position`/`inset` are set inline rather than via the `absolute
            inset-0` utility classes: `backCls` (usually the same chrome
            string as the front) often carries its own `relative` class for
            unrelated reasons, and Tailwind emits `.relative` after
            `.absolute` in its stylesheet — so with equal specificity,
            `.relative` silently wins and the back face drops out of the
            overlay into normal flow, stacking below the front instead of
            covering it (this is what produced the oversized, blank-then-
            text cards). Inline styles always beat a class, so this can't
            be re-broken by whatever chrome string a caller passes in. */}
        <div
          className={cx("overflow-hidden", backCls)}
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            pointerEvents: flipped ? "auto" : "none",
          }}
        >
          {back}
        </div>
      </motion.div>
    </Tag>
  );
}

/** Shared back-face layout — a headline, then a short read of what the chart
    actually MEANS, then an optional closing note — the one reading order
    every flipped card uses so the back never has to invent its own
    hierarchy.
 *
 * `points` (a sentence or two, as an array) is the normal case: a flip exists
 * to answer "so what?", not to re-print the same figures the front already
 * plots as a table would — a label/value list beside its own chart is the
 * chart's numbers said twice, once as a bar and once as a row. Each caller
 * derives its points from the underlying data (a leader vs the rest, a
 * direction, a share, a ratio), not a per-item echo of it.
 *
 * `lines` still exists for the rare back that is genuinely a short lookup —
 * a campaign's date window, its region tags — rather than a trend with a
 * reading to state. Reach for `points` first; `lines` is the exception, not
 * the default.
 *
 * `padding` matches the front's own padding by default assumption
 * (px-6 py-5); pass the front's actual padding classes for a tile whose
 * chrome is tighter than that, so the back doesn't out-grow the box FlipCard
 * clips it to. */
export function FlipSummary({ title, hint, points = [], lines = [], note, padding = "px-6 py-5", className }) {
  return (
    <div className={cx("flex h-full flex-col justify-center", padding, className)}>
      {title && <h3 className="font-serif text-[15px] font-semibold italic leading-tight text-ink">{title}</h3>}
      {hint && <p className="mt-1 text-[11px] leading-snug text-sub">{hint}</p>}
      {points.length > 0 && (
        <ul className={cx("flex flex-col gap-1.5", (title || hint) && "mt-2.5")}>
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink">
              <span className="mt-[5px] size-1 shrink-0 rounded-full bg-accent" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 && (
        <div className={cx("flex flex-col gap-1.5", (title || hint || points.length > 0) && "mt-2.5")}>
          {lines.map((l, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-b-0 last:pb-0">
              <span className="min-w-0 truncate text-[10.5px] text-sub">{l.label}</span>
              <span className="tnum shrink-0 text-[12px] font-bold text-ink">{l.value}</span>
            </div>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-[10.5px] leading-snug text-mute">{note}</p>}
    </div>
  );
}
