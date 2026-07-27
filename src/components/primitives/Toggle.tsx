import { cx } from "../../lib/cx";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Toggle({ checked, onChange, label, disabled, size = "md" }: ToggleProps) {
  const w = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const knob = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const shift = size === "sm" ? "translate-x-3" : "translate-x-4";
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200",
        w,
        checked ? "border-transparent bg-accent" : "border-line bg-input",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          knob,
          checked ? shift : "translate-x-0",
          !checked && "bg-ink-3",
        )}
      />
    </button>
  );
}
