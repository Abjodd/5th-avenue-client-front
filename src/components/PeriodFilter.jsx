// Period filter row: range preset dropdown + daily/weekly/monthly segmented
// control. Purely presentational — the page owns the state.
import { useState, useEffect, useRef } from "react";
import { RANGE_PRESETS, INTERVALS } from "../lib/dates";

export default function PeriodFilter({ preset, onPreset, interval, onInterval }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = RANGE_PRESETS.find(r => r.id === preset);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Period</span>

      {/* Range preset dropdown */}
      <div ref={ref} className="relative">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 px-3.5 py-[7px] text-[11.5px] font-semibold text-ink shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md">
          {current?.label}
          <span className={`text-[9px] text-mute transition-transform duration-200 ${open ? "-rotate-180" : ""}`}>▾</span>
        </button>
        {open && (
          <div className="fi absolute left-0 top-[calc(100%+6px)] z-[60] min-w-[160px] overflow-hidden rounded-[14px] border border-[rgba(15,23,42,0.08)] bg-white/95 py-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            {RANGE_PRESETS.map(r => (
              <button key={r.id} onClick={() => { onPreset(r.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12px] transition-colors duration-150 hover:bg-accent/[0.06] ${
                  r.id === preset ? "font-semibold text-accent" : "text-ink"
                }`}>
                <span className="w-3 text-[10px]">{r.id === preset ? "✓" : ""}</span>{r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interval tabs — daily / weekly / monthly */}
      <div className="flex gap-0.5 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/70 p-1 shadow-sm backdrop-blur-sm">
        {INTERVALS.map(iv => (
          <button key={iv.id} onClick={() => onInterval(iv.id)}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-200 ease-out ${
              interval === iv.id ? "bg-accent text-white shadow-[0_3px_10px_rgba(37,99,235,0.32)]" : "text-sub hover:text-ink"
            }`}>
            {iv.label}
          </button>
        ))}
      </div>
    </div>
  );
}