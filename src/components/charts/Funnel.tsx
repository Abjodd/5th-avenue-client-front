import { useEffect, useId, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "../../motion/reducedMotion";

export interface FunnelStage {
  stage: string;
  value: number;
  display: string;
  color: string;
}

/* Geometry, in viewBox units. The label row above is a CSS grid of the same
   number of equal columns, so a stage's caption sits exactly over its
   plateau — no absolute positioning to keep in sync. */
const W = 720;
const H = 190;
const CY = H / 2;
const PLATEAU = 0.18;  // half-width of a stage's flat run, as a share of its column
const MIN_H = 2.5;     // a stage with any value at all stays visible
const SHEEN_W = W * 0.4;  // width of the travelling highlight

/* Three nested ribbons instead of one: the outer washes read as the spread of
   the stream and the inner core carries the colour, which is what makes the
   shape look like flow rather than a stack of bars.

   Each also breathes — vertical swell on its own period, so the three drift
   out of phase and the outline never sits still (see .funnel-layer in
   styles/index.css). The outer washes carry most of the movement; the core
   moves least, because it sits under the figures and a number that visibly
   pulses reads as unstable data rather than as a living chart.

   The first pass used 2–5%, which on a band a few pixels tall was motion you
   could measure but not see. */
const LAYERS = [
  { scale: 1,    opacity: 0.2,  swell: 1.16, dur: "9s",   delay: "0s" },
  { scale: 0.64, opacity: 0.38, swell: 1.12, dur: "7s",   delay: "-2.5s" },
  { scale: 0.32, opacity: 0.95, swell: 1.06, dur: "5.5s", delay: "-1s" },
];

/** Closed ribbon through every stage: flat over each plateau, eased between
    them. `scale` shrinks it about the centreline for the nested layers. */
function ribbon(halves: number[], centres: number[], plateau: number, scale: number) {
  const h = (i: number) => halves[i] * scale;
  const edge = (i: number, side: 1 | -1) => CY + side * h(i);
  const last = halves.length - 1;

  // Top edge, left to right: lead-in, then plateau → curve → plateau …
  let d = `M 0 ${edge(0, -1)} L ${centres[0] + plateau} ${edge(0, -1)}`;
  for (let i = 1; i <= last; i++) {
    const x0 = centres[i - 1] + plateau, x1 = centres[i] - plateau, mid = (x0 + x1) / 2;
    d += ` C ${mid} ${edge(i - 1, -1)} ${mid} ${edge(i, -1)} ${x1} ${edge(i, -1)}`;
    d += ` L ${centres[i] + plateau} ${edge(i, -1)}`;
  }
  // Down the right face and back along the bottom edge, mirrored.
  d += ` L ${W} ${edge(last, -1)} L ${W} ${edge(last, 1)} L ${centres[last] + plateau} ${edge(last, 1)}`;
  for (let i = last; i > 0; i--) {
    const x0 = centres[i] - plateau, x1 = centres[i - 1] + plateau, mid = (x0 + x1) / 2;
    d += ` L ${x0} ${edge(i, 1)}`;
    d += ` C ${mid} ${edge(i, 1)} ${mid} ${edge(i - 1, 1)} ${x1} ${edge(i - 1, 1)}`;
  }
  return `${d} L 0 ${edge(0, 1)} Z`;
}

/**
 * Fluid funnel — one continuous stream whose width at each stage is that
 * stage's share of the largest one, tinted by a gradient that hands off from
 * each stage's colour to the next.
 *
 * Scaled to the LARGEST stage rather than to the first: views are measured
 * from the posts themselves and a reel that travels beyond its creator's
 * followers genuinely outruns reach, so the first stage is not always the
 * widest.
 */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  // Gradient and clip ids are document-global; scope them per instance so two
  // funnels on one page can't paint each other.
  const uid = useId().replace(/:/g, "");
  const [shown, setShown] = useState(prefersReducedMotion);

  // Effect, not rAF: the callback never fires while the tab is in the
  // background, which left the stream clipped to nothing until you focused it.
  useEffect(() => setShown(true), []);

  const peak = Math.max(...stages.map((s) => s.value), 1);
  const step = W / stages.length;
  const plateau = step * PLATEAU;
  const centres = stages.map((_, i) => (i + 0.5) * step);
  const halves = stages.map((s) =>
    s.value > 0 ? Math.max((s.value / peak) * (CY - 6), MIN_H) : 0,
  );
  // The widest ribbon, built once: it is both the outermost wash and the clip
  // the travelling sheen is cut to.
  const outline = ribbon(halves, centres, plateau, 1);

  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
        {/* No stage-to-stage ▲/▼ figure. The stages measure different things —
            reach is a follower base, views are counted from the posts — so the
            step between them was a percentage change between two units, and it
            painted the normal case (views outrunning reach) as a red drop or a
            green spike depending only on which way the mix fell. The ribbon
            already shows each stage's size relative to the largest. */}
        {stages.map((s) => (
          <div key={s.stage} className="min-w-0 text-center">
            <div className="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">{s.stage}</div>
            <div className="tnum mt-0.5 text-[19px] font-bold leading-none" style={{ color: s.color }}>{s.display}</div>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={stages.map((s) => `${s.stage} ${s.display}`).join(", ")}
        style={{
          clipPath: shown ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
          transition: "clip-path 900ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <defs>
          <linearGradient id={`flow-${uid}`} x1="0" y1="0" x2="1" y2="0">
            {stages.map((s, i) => (
              <stop key={s.stage} offset={`${(centres[i] / W) * 100}%`} stopColor={s.color} />
            ))}
          </linearGradient>
          {/* A soft band of light that travels the stream — the one cue that
              reads as flow rather than as a shape changing size. White works
              in both themes: it lifts the tinted ribbon either way. */}
          <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity={0} />
            <stop offset="50%" stopColor="#fff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <path d={outline} />
          </clipPath>
        </defs>

        {LAYERS.map((l) => (
          <path
            key={l.scale}
            className="funnel-layer"
            d={l.scale === 1 ? outline : ribbon(halves, centres, plateau, l.scale)}
            fill={`url(#flow-${uid})`}
            fillOpacity={l.opacity}
            style={{ "--funnel-swell": l.swell, "--funnel-dur": l.dur, animationDelay: l.delay } as CSSProperties}
          />
        ))}

        <g clipPath={`url(#clip-${uid})`}>
          <rect className="funnel-sheen" x={-SHEEN_W} y={0} width={SHEEN_W} height={H} fill={`url(#sheen-${uid})`} />
        </g>

        {/* Guides tie each caption to the point on the stream it describes. */}
        {centres.map((cx, i) => (
          <line
            key={stages[i].stage}
            x1={cx} x2={cx} y1={CY - halves[i] - 6} y2={CY + halves[i] + 6}
            stroke="var(--color-line-mid)" strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}
