/**
 * src/pages/Insights.jsx — the portal's Insights tab.
 *
 * A separate read from Overview: not the account's own numbers, but what's
 * worth asking about them, what's trending, what the wider market is doing,
 * and Fifth Avenue's own newsletter. Follows the same Section/Panel
 * vocabulary as every other portal page (see components/portal/Shell) so a
 * section here costs nothing to promote to a full page later.
 *
 * Trending is the one live section: the internal team curates it by hand on
 * the Founder Summary page (Instagram links + short typed notes, the same
 * TrendingItem collection) and this reads it straight through — read-only,
 * same as everything else in the portal. See usePortalTrending / PortalAPI.
 * Reels render as a 3D circular carousel (TrendingReelRing) — one reel
 * facing the camera at a time, the rest arced away around an invisible ring,
 * shrinking, darkening and blurring with distance the way a real depth-of-
 * field carousel would. Notes collect into one bulleted InsightsTile below
 * it. The other three sections stay scaffolds until there's a brief for
 * what goes in them.
 */
import { useEffect, useState } from "react";
import {
  HelpCircle, TrendingUp, Radar, Mail, Heart, MessageCircle, Eye,
  ExternalLink, Camera, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Section, Panel, PanelEmpty } from "../components/portal/Shell";
import { AmbientBackground } from "../components/motion/Motion";
import { Reveal } from "../components/motion/Motion";
import { usePortalTrending } from "../lib/usePortalData";
import { useReducedMotion } from "motion/react";
import { fmtNum } from "../lib/format";

const SECTIONS = [
  {
    id: "questions",
    title: "Questions",
    hint: "Questions worth asking about the account right now.",
    icon: HelpCircle,
    empty: "Nothing here yet.",
  },
  {
    id: "trending",
    title: "Trending",
    hint: "What's moving across the roster and the wider platforms.",
    icon: TrendingUp,
    empty: "Nothing here yet.",
  },
  {
    id: "market-watch",
    title: "Market Watch",
    hint: "Signals from outside the account — category and competitor moves.",
    icon: Radar,
    empty: "Nothing here yet.",
  },
  {
    id: "newsletter",
    title: "Newsletter",
    hint: "The latest from Fifth Avenue.",
    icon: Mail,
    empty: "Nothing here yet.",
  },
];

// The ring's geometry, in px — tuned so the front card reads as a proper
// vertical reel (9:16) at a size worth watching, with enough radius that
// neighbouring cards visibly curve away rather than just sitting flush
// beside it.
const RING = { radius: 320, cardW: 168 };
const CARD_H = Math.round(RING.cardW * (16 / 9));

// Degrees between adjacent slots on the ring, FIXED rather than derived from
// 360 / reels.length. Deriving it from count reads fine at the 10-14 cards
// the reference design assumes, but this shelf is hand-curated and often
// holds two or three reels — at 360/3 = 120deg apart, the side cards sit
// past 90deg from the camera and a flat card rotated that far in real 3D
// is foreshortened to a near-invisible sliver (exactly the "empty ring"
// look this replaced). A fixed step keeps every count looking like the same
// carousel: few reels form a tight, clearly-readable arc; many reels wrap
// further round toward the back, same as the reference.
const ANGLE_STEP = 30;

/** Index-space distance from `i` to `active`, wrapped the short way around a
 *  ring of `count` slots — e.g. with 3 reels, the last one is one step
 *  *behind* the first rather than two steps ahead, so the fan stays tight
 *  and symmetric instead of one card swinging around the long way. */
function shortestOffset(i, active, count) {
  let d = i - active;
  const half = count / 2;
  while (d > half) d -= count;
  while (d <= -half) d += count;
  return d;
}

/**
 * One position on the ring. `focused` is the card currently facing the
 * camera dead-on — only that one plays video, shows its stats/caption and
 * links out on click; every other position is a plain poster thumbnail (the
 * flat, minimal card you pointed at) that exists mainly to be clicked back
 * to front. Camera-badge top-right on every card either way, matching the
 * screenshot's resting state.
 */
function TrendingReelCard({ reel, focused }) {
  const media = reel.media;
  const reduced = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  const now = Date.now();
  const videoLive =
    focused && media?.ok && media.video && !videoFailed && !reduced &&
    (!media.videoExpiresAt || Date.parse(media.videoExpiresAt) > now);
  const posterLive = media?.ok && media.thumbnail;

  const stats = [
    media?.views != null && [Eye, fmtNum(media.views)],
    media?.likes != null && [Heart, fmtNum(media.likes)],
    media?.comments != null && [MessageCircle, fmtNum(media.comments)],
  ].filter(Boolean);

  if (!media?.ok || (!videoLive && !posterLive)) {
    // Nothing playable came back for this link (not yet fetched, or the
    // fetch failed) — still a card on the ring, not a blank hole in it, so
    // it carries the same glass treatment and badge as a playing one.
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-[16px] border border-white/10 text-center backdrop-blur-md"
        style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))" }}
      >
        <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md">
          <Camera size={12} strokeWidth={2} />
        </div>
        <ExternalLink size={18} strokeWidth={1.8} className="text-white/50" />
        {focused && <span className="px-3 text-[10.5px] font-semibold text-white/70">Open on Instagram</span>}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black shadow-[0_18px_46px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
      {posterLive && (
        <img src={media.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      )}
      {videoLive && (
        <video
          src={media.video}
          poster={media.thumbnail || undefined}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Glassy Instagram badge, every card — the resting-state marker from
          the reference shot. */}
      <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md">
        <Camera size={12} strokeWidth={2} />
      </div>

      {focused && (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.02) 58%, rgba(0,0,0,0.35) 100%)",
            }}
          />
          {stats.length > 0 && (
            <div className="pointer-events-none absolute bottom-16 right-2.5 flex flex-col items-center gap-3">
              {stats.map(([Icon, value], i) => (
                <span key={i} className="flex flex-col items-center gap-0.5 text-white [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.5))]">
                  <Icon size={16} strokeWidth={2} />
                  <span className="text-[10px] font-semibold">{value}</span>
                </span>
              ))}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 pr-8">
            <div className="min-w-0">
              {media.username && <div className="truncate text-[12px] font-semibold text-white">@{media.username}</div>}
              {media.caption && <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/80">{media.caption}</div>}
            </div>
          </div>
          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute bottom-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/30"
            aria-label="Open on Instagram"
          >
            <ExternalLink size={12} strokeWidth={2.2} />
          </a>
        </>
      )}
    </div>
  );
}

/**
 * The circular carousel itself. Every reel sits ANGLE_STEP degrees apart
 * (see above — fixed, not 360 / count); `rotateY` turns a card to its slot
 * and `translateZ`, applied after the rotation, pushes it straight out
 * along that now-rotated local axis — the standard CSS 3D-ring technique,
 * and why every card ends up already facing outward from the centre rather
 * than needing a second rotation to correct it. `active` is which slot
 * currently sits at 0deg (dead centre, facing the camera); everything else
 * is styled off its angular distance from that — closer to 0deg reads
 * larger, brighter and sharper, closer to 180deg (directly behind the front
 * card) reads small, dark and soft. Auto-advances slowly, pauses on
 * hover/focus, and sits still under prefers-reduced-motion.
 */
function TrendingReelRing({ reels }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = reels.length;

  useEffect(() => {
    if (reduced || paused || count < 2) return;
    const t = setInterval(() => setActive((a) => (a + 1) % count), 4200);
    return () => clearInterval(t);
  }, [reduced, paused, count]);

  useEffect(() => {
    // A reel removed/added elsewhere shouldn't leave `active` pointing past
    // the end of a now-shorter list.
    if (active >= count) setActive(0);
  }, [count, active]);

  if (count === 0) return null;

  return (
    <div
      className="relative mx-auto w-full select-none"
      style={{ height: CARD_H + 110, maxWidth: RING.radius * 2 + RING.cardW + 40 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Soft ambient glow centred behind the whole ring — the "futuristic"
          cast light the reference expects, not just a flat black stage. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: RING.radius * 2,
          height: RING.radius * 1.5,
          background: "radial-gradient(closest-side, var(--accent-muted), transparent 70%)",
          opacity: 0.35,
          filter: "blur(30px)",
        }}
      />

      {/* Glowing ring track beneath the cards — the "invisible axis" cue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: RING.radius * 1.9,
          height: 30,
          background: "radial-gradient(closest-side, var(--accent-muted), transparent 75%)",
          filter: "blur(5px)",
        }}
      />

      <div className="absolute inset-0" style={{ perspective: 1500 }}>
        <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
          {reels.map((reel, i) => {
            const offset = shortestOffset(i, active, count);
            const angle = offset * ANGLE_STEP;
            const closeness = (Math.cos((angle * Math.PI) / 180) + 1) / 2; // 0 back → 1 front
            const focused = i === active;
            return (
              <div
                key={reel.id}
                role="button"
                tabIndex={0}
                aria-current={focused}
                aria-label={focused ? "Open this reel on Instagram" : "Bring this reel to the front"}
                onClick={() => { if (!focused) setActive(i); }}
                onKeyDown={(e) => { if (!focused && (e.key === "Enter" || e.key === " ")) setActive(i); }}
                className="absolute left-1/2 top-[40%] cursor-pointer outline-none"
                style={{
                  width: RING.cardW,
                  height: CARD_H,
                  marginLeft: -RING.cardW / 2,
                  marginTop: -CARD_H / 2,
                  transform: `rotateY(${angle}deg) translateZ(${RING.radius}px) scale(${0.62 + 0.5 * closeness})`,
                  zIndex: Math.round(closeness * 1000),
                  opacity: 0.32 + 0.68 * closeness,
                  filter: `brightness(${0.42 + 0.58 * closeness}) blur(${(1 - closeness) * 2}px)`,
                  transition: reduced ? "none" : "transform 0.75s cubic-bezier(0.22,1,0.36,1), filter 0.75s ease, opacity 0.75s ease",
                }}
              >
                <TrendingReelCard reel={reel} focused={focused} />
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive((a) => (a - 1 + count) % count)}
            aria-label="Previous reel"
            className="absolute left-0 top-[40%] z-[1001] flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-[--color-glass] text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setActive((a) => (a + 1) % count)}
            aria-label="Next reel"
            className="absolute right-0 top-[40%] z-[1001] flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-[--color-glass] text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </>
      )}
    </div>
  );
}

/** Every typed insight, as one running list — points, not cards, so several
 *  short notes read together at a glance instead of stacking into a wall of
 *  bubbles. */
function InsightsTile({ notes }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-[16px] border border-accent/15 bg-accent/[0.05] p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <MessageCircle size={14} className="text-accent" strokeWidth={2.3} />
        <span className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-accent">Insights</span>
      </div>
      {notes.length === 0 ? (
        <p className="text-[12px] italic leading-relaxed text-mute">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendingFeed() {
  const { data: items, error } = usePortalTrending();

  if (error) return <PanelEmpty>Trending couldn't load right now — try again shortly.</PanelEmpty>;
  if (items == null) return <PanelEmpty>Loading…</PanelEmpty>;
  if (!items.length) return <PanelEmpty>Nothing here yet.</PanelEmpty>;

  const reels = items.filter((it) => it.kind === "reel");
  const notes = items.filter((it) => it.kind === "note");

  return (
    <div className="flex flex-col gap-8">
      {reels.length > 0 ? (
        // Dark stage for the carousel — the ring's depth cues (brightness,
        // blur, the glow track) all read against a dark ground the way the
        // reference does; the surrounding page stays its usual paper tone.
        // A radial vignette rather than flat black so the stage still reads
        // as a designed surface on wide screens, where the ring itself only
        // fills the middle of it.
        <div
          className="relative overflow-hidden rounded-[20px] px-4 py-10 sm:px-8"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 38%, #17171c 0%, #0d0d10 55%, #08080a 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "42px 42px",
            }}
          />
          <TrendingReelRing reels={reels} />
        </div>
      ) : (
        <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
          No reels yet.
        </div>
      )}
      <InsightsTile notes={notes} />
    </div>
  );
}

export default function Insights() {
  return (
    <div className="relative min-h-screen">
      <AmbientBackground variant="a" />
      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-16 pt-12 sm:px-9">
        <Reveal>
          <div className="microlabel mb-1.5 tracking-[0.2em]">Insights</div>
          <h1 className="font-serif text-[clamp(28px,4vw,40px)] font-bold italic leading-[1.1] tracking-[-0.02em] text-ink">
            Beyond the account
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-sub">
            Questions worth asking, what's trending, what the wider market is doing, and Fifth Avenue's own newsletter.
          </p>
        </Reveal>

        {SECTIONS.map((s) => (
          <Section key={s.id} id={s.id} eyebrow="Insights" title={s.title} hint={s.hint}>
            <Panel reveal className="px-6 py-5">
              <div className="mb-4 flex items-center gap-2">
                <s.icon size={16} className="text-mute" strokeWidth={1.9} />
                <span className="text-[13px] font-semibold text-ink">{s.title}</span>
              </div>
              {s.id === "trending" ? <TrendingFeed /> : <PanelEmpty>{s.empty}</PanelEmpty>}
            </Panel>
          </Section>
        ))}
      </div>
    </div>
  );
}
