import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx";

interface TabsProps<T extends string> {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Underline tabs with a sliding accent indicator. */
export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = wrap.current;
    const b = bar.current;
    if (!w || !b) return;
    const idx = tabs.findIndex((t) => t.id === active);
    const btn = w.querySelectorAll<HTMLButtonElement>("[role=tab]")[idx];
    if (!btn) return;
    b.style.width = `${btn.offsetWidth}px`;
    b.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, [active, tabs]);

  return (
    <div ref={wrap} className={cx("relative border-b border-line", className)} role="tablist">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((x) => x.id === active);
              if (e.key === "ArrowRight" && idx < tabs.length - 1)
                onChange(tabs[idx + 1].id);
              if (e.key === "ArrowLeft" && idx > 0) onChange(tabs[idx - 1].id);
            }}
            className={cx(
              "flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-label font-medium transition-colors duration-150",
              t.id === active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="tnum rounded-full bg-hover px-1.5 text-[10px] leading-4 text-ink-2">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        ref={bar}
        aria-hidden
        className="absolute bottom-[-1px] h-[2px] rounded-full bg-accent transition-[transform,width] duration-200 ease-out"
      />
    </div>
  );
}
