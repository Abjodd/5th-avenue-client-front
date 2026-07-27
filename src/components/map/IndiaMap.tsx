import { useMemo, useState } from "react";
import { MAP_PATHS } from "../../lib/marketing/data/map-paths";
import { STATES_META, STATE_DATA, centroid } from "../../lib/marketing/data/map-data";
import { cx } from "../../lib/cx";

export interface IndiaMapProps {
  /** Returns a CSS color for a state id (density ramp, region color, etc.). */
  colorFor?: (stateId: string) => string;
  /** Baseline fill opacity for states with no explicit color. */
  onHoverState?: (stateId: string | null) => void;
  onSelectState?: (stateId: string) => void;
  selected?: string | null;
  /** Dim states that aren't hovered/selected. */
  dimUnfocused?: boolean;
  /** Draw a small count bubble at active-state centroids. */
  showBubbles?: boolean;
  showLabels?: boolean;
  className?: string;
  /** Reveal states with a scroll/mount stagger via CSS custom prop delay. */
  animateIn?: boolean;
  /** Stroke color for state outlines (default = the page background). */
  outline?: string;
  /** Stroke width for state outlines. */
  outlineWidth?: number;
}

const VIEWBOX = "0 0 480 560";

/** Shared inline India map. Renders the ported 35-state PATHS; consumers
    control coloring, hover and selection. Used by the landing NetworkMap
    and the portal RegionalMap. */
export function IndiaMap({
  colorFor,
  onHoverState,
  onSelectState,
  selected,
  dimUnfocused,
  showBubbles,
  showLabels,
  className,
  animateIn,
  outline = "var(--bg)",
  outlineWidth = 0.6,
}: IndiaMapProps) {
  const [hover, setHover] = useState<string | null>(null);

  const centroids = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const id of Object.keys(MAP_PATHS)) out[id] = centroid(MAP_PATHS[id]);
    return out;
  }, []);

  const ids = Object.keys(MAP_PATHS);
  const maxCr = Math.max(...ids.map((id) => STATE_DATA[id]?.cr ?? 0), 1);

  const setH = (id: string | null) => {
    setHover(id);
    onHoverState?.(id);
  };

  return (
    <svg viewBox={VIEWBOX} className={cx("w-full", className)} role="img" aria-label="Map of India">
      {ids.map((id, i) => {
        const meta = STATES_META[id];
        // Telangana matches Andhra's colour via mirrored STATE_DATA + shared
        // region (not via aliasing), so it stays independently selectable.
        const data = STATE_DATA[id];
        const active = (data?.cr ?? 0) > 0;
        const isFocus = hover === id || selected === id;
        const fill = colorFor
          ? colorFor(id)
          : active
            ? "var(--accent)"
            : "var(--hover)";
        const baseOpacity = colorFor
          ? 1
          : active
            ? 0.25 + 0.6 * ((data?.cr ?? 0) / maxCr)
            : 0.5;
        const opacity = isFocus
          ? 1
          : dimUnfocused && (hover || selected)
            ? baseOpacity * 0.4
            : baseOpacity;
        return (
          <path
            key={id}
            d={MAP_PATHS[id]}
            fill={fill}
            fillOpacity={opacity}
            stroke={outline}
            strokeWidth={outlineWidth}
            className={cx(
              "transition-[fill-opacity,transform] duration-200",
              (onSelectState || onHoverState) && "cursor-pointer",
              animateIn && "fa-map-state",
            )}
            style={animateIn ? { animationDelay: `${i * 12}ms` } : undefined}
            onMouseEnter={() => setH(id)}
            onMouseLeave={() => setH(null)}
            onClick={() => onSelectState?.(id)}
            aria-label={meta?.name}
          />
        );
      })}

      {showBubbles &&
        ids
          .filter((id) => (STATE_DATA[id]?.c ?? 0) > 0)
          .map((id) => {
            const [cx0, cy0] = centroids[id];
            const count = STATE_DATA[id].c;
            return (
              <g key={`b-${id}`} className="pointer-events-none">
                <circle cx={cx0} cy={cy0} r={8} fill="var(--modal-bg)" stroke="var(--border-strong)" strokeWidth={0.75} />
                <text x={cx0} y={cy0 + 3} textAnchor="middle" className="fill-[var(--text)]" fontSize={9} fontWeight={600}>
                  {count}
                </text>
              </g>
            );
          })}

      {showLabels &&
        ids
          .filter((id) => (STATE_DATA[id]?.cr ?? 0) > 0)
          .map((id) => {
            const [cx0, cy0] = centroids[id];
            return (
              <text
                key={`l-${id}`}
                x={cx0}
                y={cy0 - 12}
                textAnchor="middle"
                className="pointer-events-none fill-[var(--text-2)] font-mono"
                fontSize={7}
              >
                {id.toUpperCase()}
              </text>
            );
          })}
    </svg>
  );
}
