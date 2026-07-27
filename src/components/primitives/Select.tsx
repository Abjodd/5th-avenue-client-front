import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, className, ...rest },
  ref,
) {
  return (
    <div className={cx("relative inline-flex", className)}>
      <select
        ref={ref}
        className={cx(
          "h-9 w-full appearance-none rounded-md border border-line bg-input pl-3 pr-8",
          "text-label text-ink transition-colors duration-150",
          "hover:border-line-strong focus:border-accent/50 focus:outline-none",
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-modal text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3">
        <Icon icon={ChevronDown} size={14} />
      </span>
    </div>
  );
});
