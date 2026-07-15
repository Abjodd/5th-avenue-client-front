// Period filter row: range preset dropdown + daily/weekly/monthly segmented
// control. Purely presentational — the page owns the state.
import { useState, useEffect, useRef } from "react";
import { RANGE_PRESETS, GRANULARITIES } from "../lib/dates";

export default function PeriodFilter({ preset, onPreset, gran, onGran }) {
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Period</span>

      {/* Range preset dropdown */}
      <div ref={ref} className="relative">
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-[11px] py-[5px] text-[11.5px] font-semibold text-ink">
          {current?.label} <span className="text-[9px] text-mute">{open ? "▴" : "▾"}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-[60] min-w-[150px] rounded-[7px] border border-line bg-surface py-1 shadow-modal">
            {RANGE_PRESETS.map(r => (
              <button key={r.id} onClick={() => { onPreset(r.id); setOpen(false); }}
                className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12px] hover:bg-wash ${
                  r.id === preset ? "font-semibold text-accent" : "text-ink"
                }`}>
                <span className="w-3 text-[10px]">{r.id === preset ? "✓" : ""}</span>{r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Granularity tabs */}
      <div className="flex gap-0.5 rounded-md border border-line bg-surface p-0.5">
        {GRANULARITIES.map(g => (
          <button key={g.id} onClick={() => onGran(g.id)}
            className={`rounded px-2.5 py-1 text-[11.5px] font-semibold ${
              gran === g.id ? "bg-accent/[0.07] text-accent" : "text-sub"
            }`}>
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
