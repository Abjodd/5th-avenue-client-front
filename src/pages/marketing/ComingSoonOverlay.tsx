import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";

interface ComingSoonOverlayProps {
  /** the section name shown under "Coming Soon" */
  title: string;
  /** very small line under the section name */
  tagline?: string;
  /** how long the page stays clear before the blur drifts in (ms) */
  delayMs?: number;
  /** fired once the blur becomes visible */
  onShow?: () => void;
}

/** Frosted "coming soon" layer — no card, just centred type over a gradual
    blur. Sits below the fixed nav so visitors can still navigate away. */
export function ComingSoonOverlay({ title, tagline, delayMs = 400, onShow }: ComingSoonOverlayProps) {
  const [show, setShow] = useState(false);
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;

  useEffect(() => {
    const t = setTimeout(() => {
      setShow(true);
      onShowRef.current?.();
    }, delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <div
      aria-hidden={!show}
      className={cx(
        "fixed inset-0 z-30 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-[1100ms] ease-out",
        show ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="absolute inset-0 -z-10 bg-bg/45 backdrop-blur-2xl" />
      <h1
        className="font-display font-light uppercase tracking-[0.05em] text-ink"
        style={{ fontSize: "clamp(52px, 12vw, 148px)", lineHeight: 0.94 }}
      >
        Coming Soon
      </h1>
      <p className="mt-3 font-display text-title-lg uppercase tracking-[0.3em] text-ink-2">{title}</p>
      {tagline && <p className="mt-3 text-caption text-ink-3">{tagline}</p>}
    </div>
  );
}
