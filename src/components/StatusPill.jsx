/* Status tiers — every creator/campaign status maps to one of four client-
   facing meanings so colour always communicates the same thing:
   action = waiting on you · progress = agency at work · done = complete/positive
   dropped = not going ahead · neutral = not started */
export const TIERS = {
  action:   { cls: "bg-amber/10 text-amber",   label: "Needs you" },
  progress: { cls: "bg-accent/10 text-accent", label: "In progress" },
  done:     { cls: "bg-green/10 text-green",   label: "Done" },
  dropped:  { cls: "bg-red/10 text-red",       label: "Dropped" },
  neutral:  { cls: "bg-well text-sub",         label: "Not started" },
};

export function StatusPill({ tier = "neutral", children }) {
  const t = TIERS[tier] || TIERS.neutral;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${t.cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(TIERS).filter(([k]) => k !== "neutral").map(([k, t]) => (
        <StatusPill key={k} tier={k}>{t.label}</StatusPill>
      ))}
    </div>
  );
}
