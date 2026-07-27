import type { InputHTMLAttributes } from "react";
import { cx } from "../../lib/cx";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
}

/** Range slider styled to the token system (accent fill left of the thumb). */
export function Slider({ value, min = 0, max = 100, step = 1, className, ...rest }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      className={cx("fa-slider h-1.5 w-full cursor-pointer appearance-none rounded-full", className)}
      style={{
        background: `linear-gradient(to right, var(--accent) ${pct}%, var(--input-bg) ${pct}%)`,
      }}
      {...rest}
    />
  );
}
