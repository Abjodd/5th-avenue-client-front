import { forwardRef, type InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, invalid, className, ...rest },
  ref,
) {
  return (
    <div className={cx("relative", className)}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
          <Icon icon={icon} size={16} />
        </span>
      )}
      <input
        ref={ref}
        className={cx(
          "h-9 w-full rounded-md border bg-input text-body text-ink placeholder:text-ink-3",
          "transition-colors duration-150 focus:border-accent/50 focus:outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)]",
          icon ? "pl-9 pr-3" : "px-3",
          invalid ? "border-danger/50" : "border-line hover:border-line-strong",
        )}
        {...rest}
      />
    </div>
  );
});
