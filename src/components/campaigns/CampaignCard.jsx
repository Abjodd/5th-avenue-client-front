// src/components/campaigns/CampaignCard.jsx — the board/grid card. One
// glance's worth of information: a small progress ring plus the three
// figures a brand actually asks about — creators, budget, views. Everything
// shown is real data from the view model (mapping.js); missing values render
// "—" rather than being invented.

import { motion } from "motion/react";
import { AlertTriangle, Users, Wallet, Eye } from "lucide-react";
import { useApp } from "../../context";
import { phaseColors as phaseColorsFor } from "../../lib/phases";

/* Progress ring — phase-coloured, kept small: this is a supporting glance,
   not the card's whole reason for being. */
function ProgressRing({ value, color, size = 46, stroke = 4.5 }) {
  const { P } = useApp();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.barBg} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeLinecap="round"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.min(100, Math.max(0, value)) / 100) * c }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <title>Progress: {value}%</title>
        </motion.circle>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold leading-none text-ink">{value}%</span>
    </div>
  );
}

/* One figure of the icon · value trio — Creators, Budget, Views. Renders
   "—" rather than hiding, so the row of three never reflows unevenly. */
function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" title={label}>
      <Icon size={13} strokeWidth={2} className="text-mute" />
      <span className={`tnum max-w-full truncate text-[11.5px] font-semibold ${tone || "text-ink"}`}>{value}</span>
    </div>
  );
}

/* A hairline of where "today" sits between start and end — the flight, not
   the dates either side of it. Renders nothing when the dates don't parse. */
function TimelineBar({ start, end, color }) {
  const s = Date.parse(start), e = Date.parse(end);
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const pct = Math.max(0, Math.min(1, (Date.now() - s) / (e - s)));
  return (
    <div className="relative mt-3 h-[3px] rounded-full bg-well">
      <motion.div className="h-full rounded-full" style={{ background: color, opacity: 0.7 }}
        initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

export default function CampaignCard({ campaign: c, onClick }) {
  const { P } = useApp();
  const phaseColors = phaseColorsFor(P);
  const color = phaseColors[c.phase] || P.accent;
  const done = c.phase === "completed";
  const pending = c.status === "pending";

  const creatorsLabel = c.creators.length ? (c.numReq ? `${c.lockedCount}/${c.numReq}` : `${c.creators.length}`) : "—";
  const meta = [c.service, c.region !== "—" ? c.region : null].filter(Boolean).join(" · ");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      whileHover={done ? undefined : { y: -3 }}
      onClick={onClick}
      className={`group cursor-pointer rounded-[16px] border border-line bg-glass px-4 py-3.5 shadow-[0_1px_10px_rgba(25,22,17,0.04)] backdrop-blur-md transition-all duration-200 ${
        done ? "opacity-60" : "hover:border-line-strong hover:bg-glass-strong hover:shadow-[0_12px_28px_rgba(25,22,17,0.08)]"
      }`}
      style={pending ? { borderColor: P.amber + "55" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold leading-[1.3] text-ink">{c.name}</h3>
          {meta && <div className="mt-0.5 truncate text-[11px] text-mute">{meta}</div>}
        </div>
        <ProgressRing value={c.progress} color={done ? P.doneTxt : color} />
      </div>

      {(pending || c.waiting > 0) && (
        <div className="mt-2 flex items-center gap-1 text-[10.5px] font-medium text-amber">
          {pending
            ? <span>Pending</span>
            : <><AlertTriangle size={11} strokeWidth={2.2}/> {c.waiting} waiting on you</>}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-well/60 px-2 py-2.5">
        <StatChip icon={Users} label="Creators" value={creatorsLabel} />
        <StatChip icon={Wallet} label="Budget" value={c.budget} tone={c.budgetPending ? "text-amber" : "text-ink"} />
        <StatChip icon={Eye} label="Views" value={c.views} />
      </div>

      <TimelineBar start={c.start} end={c.end} color={color}/>
    </motion.div>
  );
}
