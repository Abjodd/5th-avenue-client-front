import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover border border-transparent",
  outline:
    "bg-transparent text-ink border border-line hover:border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-hover hover:text-ink",
  danger:
    "bg-transparent text-danger border border-line hover:border-danger/40 hover:bg-danger-muted",
  success:
    "bg-transparent text-success border border-line hover:border-success/40 hover:bg-success-muted",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-caption gap-1.5 rounded-sm",
  md: "h-9 px-3.5 text-label gap-2 rounded-md",
  lg: "h-11 px-5 text-body gap-2 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "outline", size = "md", icon, iconRight, loading, className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cx(
          "inline-flex select-none items-center justify-center font-medium",
          "transition-[background-color,border-color,color,transform] duration-150",
          "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Icon icon={Loader2} size={16} className="animate-spin" />
        ) : (
          icon && <Icon icon={icon} size={size === "sm" ? 14 : 16} />
        )}
        {children}
        {iconRight && !loading && (
          <Icon icon={iconRight} size={size === "sm" ? 14 : 16} />
        )}
      </button>
    );
  },
);
