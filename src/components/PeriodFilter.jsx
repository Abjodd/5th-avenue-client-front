// Period filter row: range preset dropdown + daily/weekly/monthly segmented
// control. Purely presentational — the page owns the state, and a hand-picked
// window rides in the same `preset` string the presets use (see
// customPreset/parseCustom in lib/dates), so the page needed no second field
// and no extra fetch to support one.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RANGE_PRESETS, INTERVALS, customPreset, parseCustom } from "../lib/dates";
import { useAnchoredPosition } from "../lib/useAnchoredPosition";
import { dayLabel } from "../lib/format";

const MENU_W = 226;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PeriodFilter({ preset, onPreset, interval, onInterval }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  // Drawn on <body> rather than in place — see useAnchoredPosition for why an
  // in-place menu could not be raised above the tiles that follow it.
  const at = useAnchoredPosition(open, btnRef, { width: MENU_W });
  const custom = parseCustom(preset);
  // The draft lives here so a half-filled range never reaches the page — and
  // so never fires the analytics request the page runs off the applied value.
  const [draft, setDraft] = useState(() => custom ?? { from: "", to: todayISO() });

  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const label = custom
    ? `${dayLabel(custom.from)} – ${dayLabel(custom.to)}`
    : RANGE_PRESETS.find(r => r.id === preset)?.label;

  const applyCustom = () => {
    if (!draft.from || !draft.to) return;
    // Either order is a legitimate way to pick a window; normalise rather than
    // rejecting it, so an empty chart is never the feedback for a valid pick.
    const [from, to] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
    onPreset(customPreset(from, to));
    setOpen(false);
  };

  const menu = (
    /* Opaque, not glass: the translucent panel let the tiles behind it read
       straight through, which looked like two menus overlapping rather than
       one on top. */
    <div ref={menuRef} style={{ top: at?.top, left: at?.left, width: MENU_W }}
      className="fi fixed z-[200] overflow-hidden rounded-[14px] border border-line bg-modal shadow-modal">
      <div className="py-1.5">
        {RANGE_PRESETS.map(r => (
          <button key={r.id} onClick={() => { onPreset(r.id); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12px] transition-colors duration-150 hover:bg-accent/[0.06] ${
              r.id === preset ? "font-semibold text-accent" : "text-ink"
            }`}>
            <span className="w-3 text-[10px]">{r.id === preset ? "✓" : ""}</span>{r.label}
          </button>
        ))}
      </div>

      {/* Custom window — any two dates, so "one day" and "four weeks" are the
          same control as "1 Mar to 12 Jun". */}
      <div className="border-t border-line px-3.5 py-3">
        <div className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${custom ? "text-accent" : "text-mute"}`}>
          {custom ? "✓ Custom range" : "Custom range"}
        </div>
        <div className="flex flex-col gap-1.5">
          {[["from", "From"], ["to", "To"]].map(([key, text]) => (
            <label key={key} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] text-sub">{text}</span>
              <input type="date" value={draft[key]} max={todayISO()}
                onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-line bg-input px-2 py-1 text-[11.5px] text-ink outline-none focus:border-accent/50" />
            </label>
          ))}
        </div>
        <button onClick={applyCustom} disabled={!draft.from || !draft.to}
          className="mt-2.5 w-full rounded-full bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-on-accent transition-opacity duration-200 disabled:opacity-40">
          Apply
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Period</span>

      {/* Range preset dropdown */}
      <button ref={btnRef} onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-line bg-[--color-glass] px-3.5 py-[7px] text-[11.5px] font-semibold text-ink shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-md">
        {label}
        <span className={`text-[9px] text-mute transition-transform duration-200 ${open ? "-rotate-180" : ""}`}>▾</span>
      </button>
      {open && at && createPortal(menu, document.body)}

      {/* Interval tabs — daily / weekly / monthly */}
      <div className="flex gap-0.5 rounded-full border border-line bg-[--color-glass] p-1 shadow-sm backdrop-blur-sm">
        {INTERVALS.map(iv => (
          <button key={iv.id} onClick={() => onInterval(iv.id)}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-200 ease-out ${
              interval === iv.id ? "bg-accent text-on-accent shadow-[0_3px_10px_var(--accent-muted)]" : "text-sub hover:text-ink"
            }`}>
            {iv.label}
          </button>
        ))}
      </div>
    </div>
  );
}
