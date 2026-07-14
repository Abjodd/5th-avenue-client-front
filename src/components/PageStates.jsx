// Whole-page and section states: loading skeleton, fetch error, empty data.

export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-well ${className}`} />
);

/* Full-page loading placeholder shared by all three pages */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-6 sm:px-7">
      <Skeleton className="mb-2 h-7 w-44" />
      <Skeleton className="mb-6 h-3.5 w-64" />
      <div className="mb-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="p-10 text-center">
      <div className="mb-1.5 text-[13px] font-medium text-red">Couldn't reach the server</div>
      <div className="text-[12px] text-mute">{message}</div>
    </div>
  );
}

export function EmptyState({ icon = "◎", title, hint, actionLabel, onAction }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-9 text-center">
      <div className="mb-2 text-2xl opacity-25">{icon}</div>
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      {hint && <div className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-sub">{hint}</div>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-3.5 rounded-md bg-accent px-4 py-2 text-[12px] font-semibold text-white">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
