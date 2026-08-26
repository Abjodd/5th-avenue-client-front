import { cx } from "../../lib/cx";

export interface PodiumItem {
  name: string;
  /** ranking measure (e.g. reach) */
  value: number;
  display: string;
  sub?: string;
  badge?: string;
}

interface PodiumProps {
  items: PodiumItem[];
  className?: string;
}

const RANK_COLOR = ["var(--accent)", "var(--viz-purple)", "var(--viz-amber)"];
const ORDER = [1, 0, 2]; // render 2nd, 1st, 3rd for a centred podium
const HEIGHT = [0.66, 1, 0.5]; // relative block heights by podium position

/** Top-3 ranked "podium" + a slim list for the rest. Block heights are honest
    (scaled to the #1 value). */
export function Podium({ items, className }: PodiumProps) {
  const top = items.slice(0, 3);
  const rest = items.slice(3);
  const peak = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className={cx("flex flex-col", className)}>
      <div className="flex items-end justify-center gap-3">
        {/* Keyed by SLOT, not by rank. The two branches below used different
            key expressions over the one array — `slot` for an empty plinth and
            `rank` for a filled one — and ORDER puts rank 1 in slot 0, so a
            podium holding a single campaign emitted key 0 twice and React
            dropped one of the children. Slot is the array index, so it is
            unique by construction. */}
        {ORDER.map((rank, slot) => {
          const it = top[rank];
          if (!it) return <div key={slot} className="flex-1" />;
          const h = HEIGHT[slot];
          return (
            <div key={slot} className="flex flex-1 flex-col items-center">
              <span className="mb-1 max-w-full truncate text-center text-caption font-medium text-ink" title={it.name}>
                {it.name}
              </span>
              <span className="tnum text-caption text-ink-2">{it.display}</span>
              {it.sub && <span className="tnum text-[10px] text-ink-3">{it.sub}</span>}
              <div
                className="mt-2 flex w-full items-start justify-center rounded-t-md pt-2"
                style={{ height: `${72 * h + 20}px`, background: `color-mix(in oklab, ${RANK_COLOR[rank]} 22%, var(--card))`, borderTop: `2px solid ${RANK_COLOR[rank]}` }}
              >
                <span
                  className="tnum flex h-6 w-6 items-center justify-center rounded-full text-caption font-semibold text-on-accent"
                  style={{ background: RANK_COLOR[rank] }}
                >
                  {rank + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
          {rest.map((it, i) => (
            <div key={it.name} className="flex items-center gap-2.5">
              <span className="tnum w-4 shrink-0 text-caption text-ink-3">{i + 4}</span>
              <span className="min-w-0 flex-1 truncate text-caption text-ink-2">{it.name}</span>
              <div className="hidden h-1 w-20 overflow-hidden rounded-full bg-well sm:block">
                <div className="h-full rounded-full bg-ink-3/50" style={{ width: `${(it.value / peak) * 100}%` }} />
              </div>
              <span className="tnum shrink-0 text-caption text-ink">{it.display}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
