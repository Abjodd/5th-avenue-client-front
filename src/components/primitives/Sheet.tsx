import { useEffect, useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { usePresence } from "../../motion/usePresence";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { cx } from "../../lib/cx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  side?: "left" | "right";
  className?: string;
}

/** Edge slide-over. Panel glides on translateX; scrim fades + blurs. */
export function Sheet({ open, onClose, children, width = 640, side = "right", className }: SheetProps) {
  const { mounted, stage } = usePresence(open, 340);
  const scrim = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hidden = side === "right" ? "100%" : "-100%";

  useGSAP(
    () => {
      if (!mounted) return;
      if (prefersReducedMotion()) {
        gsap.set(panel.current, { x: stage === "open" ? 0 : hidden });
        gsap.set(scrim.current, { opacity: stage === "open" ? 1 : 0 });
        return;
      }
      if (stage === "open") {
        gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: DUR.md });
        gsap.fromTo(
          panel.current,
          { x: hidden },
          { x: 0, duration: DUR.lg, ease: EASE.out },
        );
      } else {
        gsap.to(scrim.current, { opacity: 0, duration: DUR.sm });
        gsap.to(panel.current, { x: hidden, duration: DUR.md, ease: EASE.inOut });
      }
    },
    { dependencies: [stage, mounted], scope: scrim },
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        ref={scrim}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal
        style={{ width }}
        className={cx(
          "absolute top-0 flex h-full max-w-[92vw] flex-col overflow-hidden bg-surface shadow-modal",
          side === "right" ? "right-0 border-l border-line" : "left-0 border-r border-line",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
