// src/components/campaigns/CampaignCard.jsx — rich, data-first campaign card
// shared by the board and grid views. Everything shown is real data from the
// view model (mapping.js); missing values render "—" or hide the row entirely.

import { motion } from "motion/react";
import { useApp } from "../../context";
import { phaseColors as phaseColorsFor } from "../../lib/phases";

/* Progress ring — phase-colored */
export function Donut({ value, size = 40, stroke = 4.5, color }) {
  const { P } = useApp();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = value === 100 ? P.doneTxt : (color || P.accent);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={P.barBg} strokeWidth={stroke}/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={c} strokeLinecap="round"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (value/100)*c }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}/>
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold leading-none ${value===100?"text-donetxt":"text-ink"}`}>{value}%</span>
    </div>
  );
}

/* Initials avatar stack (max 4 + "+N") from real creators */
function AvatarStack({ creators }) {
  if (!creators?.length) return null;
  const shown = creators.slice(0, 4);
  const extra = creators.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((cr, i) => (
        <div key={i} title={cr.name}
          className="-ml-1.5 flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-white bg-gradient-to-br from-accent/[0.14] to-accent/[0.05] text-[8.5px] font-bold text-accent shadow-sm first:ml-0">
          {cr.avatar || cr.name[0]}
        </div>
      ))}
      {extra > 0 && (
        <div className="-ml-1.5 flex size-[22px] items-center justify-center rounded-full border-[1.5px] border-white bg-well text-[8.5px] font-bold text-sub shadow-sm">
          +{extra}
        </div>
      )}
    </div>
  );
}

/* Timeline mini-bar: start→end with a "today" marker. Renders nothing when the
   dates don't parse — never invents a timeline. */
function TimelineBar({ start, end, color }) {
  const s = Date.parse(start), e = Date.parse(end);
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const now = Date.now();
  const pct = Math.max(0, Math.min(1, (now - s) / (e - s)));
  return (
    <div className="mt-2.5">
      <div className="relative h-[4px] rounded-full bg-well">
        <motion.div className="h-full rounded-full" style={{ background: color, opacity: 0.75 }}
          initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}/>
        {pct > 0 && pct < 1 && (
          <div className="absolute -top-[2.5px] h-[9px] w-[2px] rounded-full bg-ink/60" style={{ left: `${pct * 100}%` }} title="Today"/>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-mute">
        <span>{start}</span><span>{end}</span>
      </div>
    </div>
  );
}

export default function CampaignCard({ campaign: c, onClick }) {
  const { P } = useApp();
  const phaseColors = phaseColorsFor(P);
  const color = phaseColors[c.phase] || P.accent;
  const done = c.phase === "completed";
  const pending = c.status === "pending";

  /* stat microrow — only rows with real values are rendered */
  const stats = [];
  if (c.creators.length) stats.push(["Creators", c.numReq ? `${c.lockedCount}/${c.numReq}` : `${c.creators.length}`]);
  if (c.engRate !== "—") stats.push(["Avg ER", c.engRate]);
  if (c.views !== "—") stats.push(["Views", c.views]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      whileHover={done ? undefined : { y: -4, scale: 1.01 }}
      onClick={onClick}
      className={`group cursor-pointer rounded-[16px] border-[1.5px] px-4 py-3.5 shadow-sm backdrop-blur-md transition-colors duration-200 ${
        done ? "bg-well/40 opacity-60" : "bg-white/65 hover:bg-white/85 hover:shadow-[0_14px_32px_rgba(25,22,17,0.09)]"
      }`}
      style={{ borderColor: pending ? P.amber + "55" : "rgba(25,22,17,0.06)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold leading-[1.3] text-ink">{c.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-well px-2 py-0.5 text-[9.5px] font-medium text-sub">{c.service}</span>
            {c.region !== "—" && <span className="rounded-full bg-well px-2 py-0.5 text-[9.5px] font-medium text-sub">{c.region}</span>}
          </div>
        </div>
        <Donut value={c.progress} size={38} stroke={4} color={color}/>
      </div>

      {(pending || c.waiting > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {pending && <span className="rounded-full bg-amber/[0.1] px-2 py-0.5 text-[10px] font-semibold uppercase text-amber shadow-sm">Pending</span>}
          {c.waiting > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber/25 bg-amber/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber shadow-sm">
              ⚠ {c.waiting} waiting on you
            </span>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          {stats.map(([l, v]) => (
            <div key={l}>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-mute">{l}</div>
              <div className={`mt-px text-[13px] font-semibold ${done ? "text-donetxt" : "text-ink"}`}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {c.creators.length > 0 && <div className="mt-2.5 flex"><AvatarStack creators={c.creators}/></div>}

      <TimelineBar start={c.start} end={c.end} color={color}/>

      {/* budget strip reveals on hover */}
      <div className="flex gap-1 overflow-hidden transition-all duration-250 max-h-0 opacity-0 group-hover:mt-2 group-hover:max-h-[22px] group-hover:opacity-100">
        <span className="rounded-full bg-well px-2 py-0.5 text-[10.5px] text-sub">Budget {c.budget}</span>
        {c.liveCount > 0 && <span className="rounded-full bg-green/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-green">{c.liveCount} live</span>}
      </div>
    </motion.div>
  );
}
