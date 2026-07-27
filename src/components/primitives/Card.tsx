import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../lib/cx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "dense" | "default";
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = "default", hoverable, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        "rounded-lg border border-line bg-card shadow-card",
        padding === "default" && "p-6",
        padding === "dense" && "p-5",
        hoverable &&
          "transition-[border-color,background-color] duration-150 hover:border-line-strong",
        className,
      )}
      {...rest}
    />
  );
});

export function CardTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-label font-semibold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-caption text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
