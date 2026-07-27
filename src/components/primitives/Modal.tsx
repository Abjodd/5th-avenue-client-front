import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { usePresence } from "../../motion/usePresence";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { cx } from "../../lib/cx";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Modal({ open, onClose, title, children, size = "md", className }: ModalProps) {
  const { mounted, stage } = usePresence(open, 220);
  const scrim = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!mounted || prefersReducedMotion()) return;
      if (stage === "open") {
        gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: DUR.sm });
        gsap.fromTo(
          panel.current,
          { opacity: 0, scale: 0.96, y: 8 },
          { opacity: 1, scale: 1, y: 0, duration: DUR.sm, ease: EASE.out },
        );
      } else {
        gsap.to(scrim.current, { opacity: 0, duration: DUR.xs });
        gsap.to(panel.current, { opacity: 0, scale: 0.97, duration: DUR.xs, ease: EASE.out });
      }
    },
    { dependencies: [stage, mounted], scope: scrim },
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={scrim}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[4px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal
        aria-label={title}
        className={cx(
          "relative z-10 max-h-[88vh] w-full overflow-hidden rounded-xl border border-line bg-modal shadow-modal",
          widths[size],
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-title font-semibold text-ink">{title}</h2>
            <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
          </div>
        )}
        <div className="max-h-[calc(88vh-60px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
