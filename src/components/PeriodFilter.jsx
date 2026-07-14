// Period filter row: range preset dropdown + daily/weekly/monthly segmented
// control. Purely presentational — the page owns the state.
// Accepts an optional `dark` prop that switches to the dark panel palette
// used inside PerformanceSection.
import { useState, useEffect, useRef } from "react";
import { RANGE_PRESETS, GRANULARITIES } from "../lib/dates";

const DARK_SURFACE = "#1E2B4A";
const DARK_BORDER  = "rgba(255,255,255,0.10)";
const DARK_INK     = "#E8ECF4";
const DARK_MUTE    = "rgba(255,255,255,0.42)";
const DARK_ACCENT  = "#4C9BFF";

export default function PeriodFilter({ preset, onPreset, gran, onGran, dark = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = RANGE_PRESETS.find(r => r.id === preset);

  if (dark) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: DARK_MUTE }}>Period</span>

        {/* Range preset dropdown */}
        <div ref={ref} className="relative">
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 rounded-md px-[11px] py-[5px] text-[11.5px] font-semibold transition-colors"
            style={{ background: DARK_SURFACE, border: `1px solid ${DARK_BORDER}`, color: DARK_INK }}>
            {current?.label}
            <span style={{ color: DARK_MUTE, fontSize: 9 }}>{open ? "▴" : "▾"}</span>
          </button>
          {open && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-[60] min-w-[155px] overflow-hidden rounded-[8px] py-1"
              style={{ background: "#1E2B4A", border: `1px solid ${DARK_BORDER}`, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              {RANGE_PRESETS.map(r => (
                <button key={r.id} onClick={() => { onPreset(r.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors"
                  style={{
                    color: r.id === preset ? DARK_ACCENT : DARK_INK,
                    background: r.id === preset ? "rgba(76,155,255,0.12)" : "transparent",
                  }}
                  onMouseEnter={e => { if (r.id !== preset) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (r.id !== preset) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 14, fontSize: 10, color: DARK_ACCENT }}>{r.id === preset ? "✓" : ""}</span>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Granularity tabs */}
        <div className="flex overflow-hidden rounded-md" style={{ border: `1px solid ${DARK_BORDER}` }}>
          {GRANULARITIES.map(g => (
            <button key={g.id} onClick={() => onGran(g.id)}
              className="px-3 py-[5px] text-[11.5px] font-semibold transition-colors"
              style={{
                background: gran === g.id ? "rgba(76,155,255,0.18)" : "transparent",
                color: gran === g.id ? DARK_ACCENT : DARK_MUTE,
              }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Light mode (default — used elsewhere on the portal) ──────────────────
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
