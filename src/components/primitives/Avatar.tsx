import { cx } from "../../lib/cx";

interface AvatarProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "muted";
  className?: string;
}

export function Avatar({ initials, size = "md", tone = "accent", className }: AvatarProps) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        size === "sm" && "h-7 w-7 text-caption",
        size === "md" && "h-9 w-9 text-label",
        size === "lg" && "h-12 w-12 text-body",
        tone === "accent" ? "bg-accent-muted text-accent" : "bg-hover text-ink-2",
        className,
      )}
    >
      {initials}
    </span>
  );
}
