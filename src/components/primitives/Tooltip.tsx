import { useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/** Lightweight CSS tooltip — appears on hover/focus after a short delay. */
export function Tooltip({ label, children, side = "top", className }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <span
      className={cx("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={cx(
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-modal px-2 py-1 text-caption text-ink shadow-pop",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
