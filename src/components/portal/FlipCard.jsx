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
 * HIDING THE TURNED-AWAY FACE takes two mechanisms. `backfaceVisibility`
 * (plus its `-webkit-` twin, and the same for `preserve-3d`, or Safari
 * ignores both) is the cheap GPU cull and works most of the time — but
 * WebKit stops culling once the turning element is promoted to its own
 * compositing layer, which Motion does while it animates. That is why the
 * ghost only ever appeared on a card that had been flipped, and why the
 * ghosted KPI band showed it on faces carrying no `backdrop-filter` at all.
 *
 * So `showFace` also fades the away-face out at the 90° crossover. Fading
 * rather than covering: the two faces are coplanar and the back is later in
 * the DOM, so an opaque back would paint over the front at REST too, leaving
 * every unflipped card showing its own mirrored reverse.
 *
 * `prefers-reduced-motion` swaps the 3D turn for a plain crossfade — the
 * same back face, no rotation.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cx } from "../../lib/cx";
import { EASE, SPRING } from "../../lib/motion";

const POP = { duration: 0.55, ease: EASE };

// A click on any of these is the card's own business, not a request to flip.
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="tab"], [role="button"], [contenteditable="true"]';

/* The chrome every face gets no matter what the caller passed in. Both
   spellings of both, because WebKit is the browser that needs them.

   `backfaceVisibility` is the cheap GPU cull, not the guarantee — showFace is
   (see the note at the top). `backdropFilter: none` is not a ghost fix
   either: it is here because a face blurring its backdrop inside a panel that
   is already blurring the same backdrop is work with nothing left to do.

   Inline rather than merged into the class strings, so a call site cannot
   re-break either by passing `backdrop-blur-*` in its chrome — which most of
   them do, that being the portal's standard panel recipe. */
const FACE = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};

/** `cardClassName` is the front's chrome, and what sizes the card.
 *  `backClassName` (defaults to it) is the back's — kept separate because the
 *  back rarely wants the front's padding/flex repeated under FlipSummary's
 *  own layout, which is what squeezed the KPI and stat tiles' summaries. */
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
  const frontRef = useRef(null);
  const backRef = useRef(null);

  /* Fade the away-face out at the 90° crossover, off the turn's LIVE angle.
     Written to the faces, never to the animating element, so the spring is
     untouched — and through refs, because this runs every frame and a
     setState per frame would re-render the card's whole subtree, chart and
     all. Normalised to 0–360 first so the spring's overshoot past 180° still
     reads as "the back" instead of wrapping round to the front. */
  const showFace = useCallback((deg) => {
    const a = (((deg ?? 0) % 360) + 360) % 360;
    const isBack = a > 90 && a < 270;
    if (frontRef.current) frontRef.current.style.opacity = isBack ? "0" : "1";
    if (backRef.current) backRef.current.style.opacity = isBack ? "1" : "0";
  }, []);

  /* Seed the first paint only. If the turn never runs (throttled rAF in a
     background tab) the card never rotates either, so the front is correct;
     onAnimationComplete settles the final state once the spring stops. */
  useLayoutEffect(() => { showFace(0); }, [showFace]);

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
        onUpdate={(latest) => showFace(latest.rotateY)}
        onAnimationComplete={() => showFace(flipped ? 180 : 0)}
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
          ref={frontRef}
          className={cx("h-full w-full", cardClassName)}
          style={{ ...FACE, pointerEvents: flipped ? "none" : "auto" }}
        >
          {children}
        </div>
        {/* Back — pinned to the front's box and clipped, not left to grow.
            `position`/`inset` are inline, not `absolute inset-0` classes:
            `backCls` often carries its own `relative`, and Tailwind emits
            `.relative` after `.absolute`, so at equal specificity the back
            dropped out of the overlay into normal flow. Inline always wins,
            so no caller's chrome string can re-break it. */}
        <div
          ref={backRef}
          className={cx("overflow-hidden", backCls)}
          style={{
            ...FACE,
            position: "absolute",
            inset: 0,
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

/** Shared back-face layout — headline, then the reading, then an optional
 *  note — so no back has to invent its own hierarchy.
 *
 *  `points` is the normal case: a flip answers "so what?", not "the same
 *  figures again as a table". Derive them from the data (a leader vs the
 *  rest, a direction, a ratio), never a per-item echo of the front.
 *  `lines` is the exception, for a back that is genuinely a short lookup.
 *  `padding` must match the front's, or the back outgrows its clipped box. */
export function FlipSummary({ title, hint, points = [], lines = [], note, padding = "px-6 py-5", className }) {
  /* Prose reads from the top, the same edge the front's title starts at.
     Centred in `h-full` it left a ~120px block hovering mid-card on a 580px
     panel — the "floating / out of place" read. A title-and-one-line back has
     nothing to read DOWN, so those stay centred in their small tile. */
  const rich = points.length > 0 || lines.length > 0;

  return (
    /* overflow-y-auto, not hidden, so a back that outgrows its box scrolls
       instead of losing its last line. Centring uses `my-auto` rather than
       `justify-center`: an overflowing centred flex child is clipped at the
       TOP and can't be scrolled back to; auto margins stay reachable. */
    <div className={cx("flex h-full flex-col overflow-y-auto", padding, className)}>
      {/* Capped measure — these cards run to ~1900px, and an uncapped reading
          either spanned it or sat ragged at the left looking like a mistake. */}
      <div className={cx("max-w-[56ch]", !rich && "my-auto")}>
        {/* PanelTitle's own 19/12.5, so a flipped panel keeps its front's
            heading. The old flat 15/11/11 merged hint and reading into one
            grey block with no entry point. */}
        {title && (
          <h3
            className={cx(
              "font-serif font-semibold italic leading-tight text-ink",
              rich ? "text-[19px]" : "text-[15px]",
            )}
          >
            {title}
          </h3>
        )}
        {hint && (
          <p
            className={cx(
              "leading-snug",
              rich ? "text-[12.5px]" : "text-[11px]",
              // With no title, the hint IS the content, not a subtitle — so
              // it takes the reading colour and loses the heading gap.
              title ? "mt-1 text-sub" : "text-ink",
            )}
          >
            {hint}
          </p>
        )}

        {points.length > 0 && (
          /* The same hairline the masthead uses, doing the same job. */
          <ul className={cx("flex flex-col gap-2.5", (title || hint) && "mt-3.5 border-t border-line pt-3.5")}>
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink">
                {/* A short rule, not a dot — the portal's marks are drawn
                    rules (the name underline, the KPI column tick). */}
                <span aria-hidden className="mt-[9px] h-[1.5px] w-2.5 shrink-0 rounded-full bg-accent/60" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className={cx("flex flex-col gap-2", (title || hint || points.length > 0) && "mt-3.5 border-t border-line pt-3.5")}>
            {lines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
                <span className="min-w-0 truncate text-[11.5px] text-sub">{l.label}</span>
                <span className="tnum shrink-0 text-[12.5px] font-bold text-ink">{l.value}</span>
              </div>
            ))}
          </div>
        )}

        {note && <p className="mt-3 text-[11px] leading-snug text-mute">{note}</p>}
      </div>
    </div>
  );
}
