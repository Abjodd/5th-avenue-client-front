import { motion } from "motion/react";
import { AlertTriangle, Users, Wallet, Eye } from "lucide-react";
import { useApp } from "../../context";
import { phaseColors as phaseColorsFor } from "../../lib/phases";

const COMPLETED_GREEN = "#087A45";

function ProgressRing({ value, color, size = 46, stroke = 4.5, done = false }) {
  const { P } = useApp();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={P.barBg}
          strokeWidth={stroke}
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset:
              circumference - (safeValue / 100) * circumference,
          }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </svg>

      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold leading-none"
        style={{ color: done ? COMPLETED_GREEN : "var(--color-ink)" }}
      >
        {safeValue}%
      </span>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
      title={label}
    >
      <Icon size={15} strokeWidth={1.8} className="text-[#777365]" />

      <span
        className={`tnum max-w-full truncate text-[12px] font-semibold leading-tight ${
          tone || "text-ink"
        }`}
      >
        {value || "—"}
      </span>

      <span className="text-[10px] leading-tight text-[#817d70]">
        {label}
      </span>
    </div>
  );
}

function TimelineBar({ start, end, color, done }) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  if (
    !done &&
    (Number.isNaN(startMs) ||
      Number.isNaN(endMs) ||
      endMs <= startMs)
  ) {
    return null;
  }

  const percent = done
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          ((Date.now() - startMs) / (endMs - startMs)) * 100
        )
      );

  return (
    <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-[#e9e8e4]">
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundColor: done ? COMPLETED_GREEN : color,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{
          duration: 0.7,
          ease: [0.16, 1, 0.3, 1],
        }}
      />
    </div>
  );
}

export default function CampaignCard({ campaign: c, onClick }) {
  const { P } = useApp();
  const phaseColors = phaseColorsFor(P);

  const done =
    c.status === "done" || c.phase === "completed";

  const color = done
    ? COMPLETED_GREEN
    : phaseColors[c.phase] || P.accent;

  const creatorsLabel = c.creators?.length
    ? c.numReq
      ? `${c.lockedCount}/${c.numReq}`
      : `${c.creators.length}`
    : "—";

  const meta = [
    c.service,
    c.region !== "—" ? c.region : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 30,
      }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="group flex h-full min-h-[190px] cursor-pointer flex-col rounded-[16px] border border-[#d4d4d4] bg-[#eeeeee] px-4 py-3.5 shadow-[0_2px_10px_rgba(30,28,20,0.045)] transition-all duration-200 hover:border-[#d9d5ca] hover:shadow-[0_8px_22px_rgba(30,28,20,0.075)]"
    >
      {/* Campaign title and progress */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-[14px] font-semibold leading-[1.35] text-[#24231f]">
            {c.name}
          </h3>

          {meta && (
            <div className="mt-1 truncate text-[11.5px] text-[#817d70]">
              {meta}
            </div>
          )}
        </div>

        <ProgressRing
          value={c.progress}
          color={color}
          size={49}
          stroke={4.5}
          done={done}
        />
      </div>

      {/* Pending information */}
      {(c.status === "pending" || c.waiting > 0) && (
        <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber">
          {c.status === "pending" ? (
            <span>Pending</span>
          ) : (
            <>
              <AlertTriangle size={10} />
              {c.waiting} waiting on you
            </>
          )}
        </div>
      )}

      {/* Campaign metrics */}
      <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#dedede] px-2 py-2.5">
        <StatChip
          icon={Users}
          label="Creators"
          value={creatorsLabel}
        />

        <StatChip
          icon={Wallet}
          label="Budget"
          value={c.budget}
          tone={
            c.budgetPending ||
            /to be confirm/i.test(String(c.budget || ""))
              ? "text-amber-600"
              : "text-ink"
          }
        />

        <StatChip
          icon={Eye}
          label="Est. Reach"
          value={c.views}
        />
      </div>

      {/* Progress bar */}
      <div className="mt-auto pt-3">
        <TimelineBar
          start={c.start}
          end={c.end}
          color={color}
          done={done}
        />
      </div>
    </motion.div>
  );
}