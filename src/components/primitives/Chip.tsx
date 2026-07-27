import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  count?: number;
}

/** Selectable filter chip. Selection = accent-muted fill + accent text. */
export function Chip({ selected, count, className, children, ...rest }: ChipProps) {
  return (
    <button
      aria-pressed={selected}
      className={cx(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-caption font-medium",
        "transition-colors duration-150 active:scale-[0.97]",
        selected
          ? "border-accent/30 bg-accent-muted text-accent"
          : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <span
          className={cx(
            "tnum rounded-full px-1.5 text-[10px] leading-4",
            selected ? "bg-accent/15" : "bg-hover",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
