import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx";

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** Pill group with a sliding active thumb (CSS transition on transform). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: SegmentedControlProps<T>) {
  const wrap = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = wrap.current;
    const t = thumb.current;
    if (!w || !t) return;
    const idx = options.findIndex((o) => o.value === value);
    const btn = w.querySelectorAll<HTMLButtonElement>("button")[idx];
    if (!btn) return;
    t.style.width = `${btn.offsetWidth}px`;
    t.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
  }, [value, options]);

  return (
    <div
      ref={wrap}
      role="tablist"
      className={cx(
        // `isolate` scopes the buttons' z-10 to this control so it can't paint
        // over sticky UI (e.g. the frozen filter bar) elsewhere on the page.
        "relative isolate inline-flex items-center gap-0.5 rounded-md border border-line bg-input p-[3px]",
        className,
      )}
      onKeyDown={(e) => {
        const idx = options.findIndex((o) => o.value === value);
        if (e.key === "ArrowRight" && idx < options.length - 1)
          onChange(options[idx + 1].value);
        if (e.key === "ArrowLeft" && idx > 0) onChange(options[idx - 1].value);
      }}
      {...rest}
    >
      <div
        ref={thumb}
        className="absolute left-[3px] top-[3px] bottom-[3px] rounded-[7px] bg-card shadow-card ring-1 ring-line transition-[transform,width] duration-200 ease-out"
        aria-hidden
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cx(
            "relative z-10 whitespace-nowrap rounded-[7px] font-medium transition-colors duration-150",
            size === "sm" ? "h-6 px-2.5 text-caption" : "h-7 px-3 text-label",
            o.value === value ? "text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
