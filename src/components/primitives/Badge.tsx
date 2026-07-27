import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export type BadgeTone =
  | "accent"
  | "success"
  | "danger"
  | "warning"
  | "pink"
  | "muted";

const tones: Record<BadgeTone, string> = {
  accent: "bg-accent-muted text-accent",
  success: "bg-success-muted text-success",
  danger: "bg-danger-muted text-danger",
  warning: "bg-warning-muted text-warning",
  pink: "bg-viz-pink/12 text-viz-pink",
  muted: "bg-hover text-ink-2",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ tone = "muted", children, dot, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
