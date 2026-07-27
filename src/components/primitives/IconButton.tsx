import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string; // aria-label, required
  size?: "sm" | "md";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, label, size = "md", active, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cx(
          "inline-flex items-center justify-center rounded-md border transition-colors duration-150",
          "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
          size === "sm" ? "h-7 w-7" : "h-9 w-9",
          active
            ? "border-transparent bg-accent-muted text-accent"
            : "border-transparent text-ink-2 hover:bg-hover hover:text-ink",
          className,
        )}
        {...rest}
      >
        <Icon icon={icon} size={size === "sm" ? 16 : 18} />
      </button>
    );
  },
);
