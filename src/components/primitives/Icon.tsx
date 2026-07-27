import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";

interface IconProps {
  icon: LucideIcon;
  /** 16 inline/dense · 18 nav/buttons */
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Single icon entry point — enforces the 1.75 stroke and absolute widths
    so every icon in the app reads at the same weight. */
export function Icon({ icon: I, size = 16, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <I
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      className={cx("shrink-0", className)}
      aria-hidden
    />
  );
}
