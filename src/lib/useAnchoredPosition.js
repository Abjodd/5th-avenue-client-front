import { useLayoutEffect, useState } from "react";

/**
 * Viewport coordinates for a popover that is drawn on <body>.
 *
 * Every portal panel carries `backdrop-blur`, and backdrop-filter makes an
 * element a stacking context — so a popover positioned inside one can never be
 * raised above the panels that follow it, whatever z-index it carries. That is
 * what had the stat tiles painting over the period menu. The way out is to
 * render the popover on <body>, where it is no longer in that contest and the
 * tokens still resolve (the portal identity is the document default — see
 * styles/index.css), and to place it against its anchor by hand.
 *
 * Shared because two controls need it now. A second copy of this is how their
 * edge-clamping starts disagreeing.
 *
 * Returns null until the anchor has been measured, so a caller renders nothing
 * rather than flashing the popover at 0,0.
 */
export function useAnchoredPosition(open, anchorRef, { width, align = "left", gap = 6 } = {}) {
  const [at, setAt] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setAt(null); return; }
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = align === "right" ? r.right - width : r.left;
      // Clamped to the viewport, so a control near the right edge opens
      // inward instead of off-screen.
      setAt({ top: r.bottom + gap, left: Math.max(8, Math.min(x, window.innerWidth - width - 8)) });
    };
    place();
    // Capture phase: the anchor can sit inside a scrolling panel, not only the
    // page, and neither scroll should leave the popover behind.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, width, align, gap]);

  return at;
}
