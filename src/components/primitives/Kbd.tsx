import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-input px-1 font-mono text-[10px] text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
