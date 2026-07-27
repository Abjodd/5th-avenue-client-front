import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "./Icon";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-hover text-ink-3">
        <Icon icon={icon} size={20} />
      </span>
      <div>
        <p className="text-label font-semibold text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-xs text-caption text-ink-3">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
