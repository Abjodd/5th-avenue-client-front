// Whole-page and section states: loading skeleton, fetch error, empty data.

export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-[14px] bg-gradient-to-r from-well via-white/40 to-well bg-[length:200%_100%] ${className}`}
    style={{ animation: "shimmer 1.6s ease-in-out infinite, pulse 1.6s ease-in-out infinite" }} />
);

/* Full-page loading placeholder shared by all three pages */
export function PageSkeleton() {
  return (
    <div className="relative min-h-screen">
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full opacity-[0.08] blur-[110px]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)" }} />
        <div className="absolute -right-32 top-40 size-[460px] rounded-full opacity-[0.06] blur-[120px]" style={{ background: "radial-gradient(circle, #7860D6, transparent 70%)" }} />
      </div>
      <div className="mx-auto w-full max-w-[1600px] px-5 pt-9 sm:px-9">
        <Skeleton className="mb-3 h-10 w-56" />
        <Skeleton className="mb-8 h-4 w-72" />
        <div className="mb-6 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-[20px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-[20px]" />
          <Skeleton className="h-72 rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-red/15 bg-red/[0.06] shadow-[0_8px_24px_rgba(220,38,38,0.08)]">
        <span className="text-[22px] text-red">⚠</span>
      </div>
      <div className="mb-1.5 text-[14px] font-semibold text-ink">Couldn't reach the server</div>
      <div className="text-[12.5px] leading-relaxed text-mute">{message}</div>
    </div>
  );
}

export function EmptyState({ icon = "◎", title, hint, actionLabel, onAction }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[rgba(15,23,42,0.12)] bg-white/40 px-6 py-11 text-center backdrop-blur-sm transition-colors duration-300 hover:border-accent/25 hover:bg-white/60">
      <div className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-accent/[0.06] text-2xl text-accent/70 shadow-sm">
        {icon}
      </div>
      <div className="text-[13.5px] font-semibold text-ink">{title}</div>
      {hint && <div className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-sub">{hint}</div>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-full bg-accent px-5 py-2.5 text-[12px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(37,99,235,0.4)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}