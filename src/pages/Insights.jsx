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
 * same as everything else in the portal, from `reel.media`: a snapshot
 * HikerAPI captured once, at save time (see fetchReelSnapshot on the
 * backend), never fetched again here. See usePortalTrending / PortalAPI.
 *
 * Laid out as two columns: reels on the left, the month's Insights as a
 * standing tile on the right (stacking on narrow screens, reels first). A
 * handful of reels sit as a plain row of ReelCards; past CAROUSEL_THRESHOLD
 * they switch to TrendingCarousel — one reel up front at full size, the
 * rest fanned out behind it in a shallow 2D arc (offset, scaled down,
 * faded, blurred), clickable back to the front. That's deliberately NOT
 * the earlier 3D rotateY ring: a card rotated in real 3D space
 * foreshortens hard past ~60°, which is what turned a handful of reels into
 * near-invisible slivers on a black stage before. Faking the depth with
 * plain 2D transforms (translate/rotate/scale/blur) keeps every card
 * facing the viewer full-on no matter how far back it sits, while still
 * reading as "receding into the background." The other three sections
 * stay scaffolds until there's a brief for what goes in them.
 */
import { useEffect, useRef, useState } from "react";
import {
  HelpCircle, TrendingUp, Radar, Mail, Heart, MessageCircle, Eye,
  ArrowUpRight, Camera, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { Section, Panel, PanelEmpty } from "../components/portal/Shell";
import { AmbientBackground, Reveal } from "../components/motion/Motion";
import { usePortalTrending } from "../lib/usePortalData";
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

// Each card is dealt one of these on a fixed rotation (index % length) — not
// a per-brand or per-mood choice, just a way to stop a row of reels from
// reading as identical grey tiles. Used as a card's gradient rim and,
// softened way down, as its hover glow.
const RIMS = [
  ["#f59e0b", "#fb7185"], // amber → rose
  ["#6366f1", "#22d3ee"], // indigo → cyan
  ["#10b981", "#a3e635"], // emerald → lime
  ["#a855f7", "#ec4899"], // violet → pink
];

// More reels than this and the shelf switches from a plain row to the arc
// carousel — a row of five-plus 9:16 cards stops fitting the (now narrower,
// left-column) space as individually-readable cards, where a carousel keeps
// one full-size and lets the rest recede.
const CAROUSEL_THRESHOLD = 3;

/** A reel's stat row — views/likes/comments, the icon-then-number shape used
 *  everywhere else media stats show up in the portal (see assets.jsx). */
function statList(media) {
  return [
    media?.views != null && [Eye, fmtNum(media.views)],
    media?.likes != null && [Heart, fmtNum(media.likes)],
    media?.comments != null && [MessageCircle, fmtNum(media.comments)],
  ].filter(Boolean);
}

/**
 * One reel, as a card — full detail, meant to be looked at. A two-color
 * gradient rim (see RIMS), a cursor-tracked 3D tilt so it leans into the
 * pointer, a matching glow behind it on hover, video preview on hover, and
 * caption/stats tucked under a scrim until hover pulls them up (the same
 * reveal language assets.jsx uses for a reel tile).
 *
 * Sized by its parent — this renders at h-full w-full and leaves the
 * aspect ratio and box size to whoever places it, since it's used two ways:
 * a plain aspect-[9/16] cell in the row, and a fixed-px wrapper the
 * carousel animates.
 *
 * The tilt runs on motion values (rx/ry → springX/springY), not React
 * state, so the pointer can move every frame without a re-render.
 */
function ReelCard({ reel, rim }) {
  const media = reel.media;
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef(null);

  const rx = useMotionValue(0.5);
  const ry = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(ry, [0, 1], [10, -10]), { stiffness: 300, damping: 24 });
  const rotateY = useSpring(useTransform(rx, [0, 1], [-10, 10]), { stiffness: 300, damping: 24 });

  function handleMove(e) {
    if (reduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    rx.set((e.clientX - rect.left) / rect.width);
    ry.set((e.clientY - rect.top) / rect.height);
  }
  function handleLeave() {
    setHovered(false);
    rx.set(0.5);
    ry.set(0.5);
  }

  const stats = statList(media);
  const playable = media?.ok && (media.video || media.thumbnail);
  const showVideo = hovered && media?.ok && media.video && !reduced;

  return (
    <motion.a
      ref={cardRef}
      href={reel.url}
      target="_blank"
      rel="noreferrer"
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="group relative block h-full w-full [transform-style:preserve-3d]"
    >
      {/* Glow — the rim's own colors, blurred out behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2.5 -z-10 rounded-[26px] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: `linear-gradient(135deg, ${rim[0]}, ${rim[1]})` }}
      />

      {/* Gradient rim — a padding wrapper rather than a CSS border, so the
          two colors blend across the edge instead of banding. */}
      <div
        className="h-full w-full rounded-[20px] p-[2px] shadow-[0_10px_28px_-14px_rgba(25,22,17,0.4)]"
        style={{ background: `linear-gradient(150deg, ${rim[0]}, ${rim[1]})` }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-black">
          {playable ? (
            <>
              {media.thumbnail && (
                <img src={media.thumbnail} alt="" loading="lazy" draggable={false}
                  className="absolute inset-0 h-full w-full object-cover" />
              )}
              {showVideo && (
                <video src={media.video} muted loop autoPlay playsInline preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover" />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
              style={{ background: `linear-gradient(160deg, ${rim[0]}33, ${rim[1]}33)` }}>
              <Camera size={20} strokeWidth={1.6} className="text-white/70" />
              <span className="px-5 text-[10px] font-semibold text-white/70">No snapshot yet</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 38%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.4) 100%)" }} />

          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-[#22d3ee]" />
            Reel
          </span>

          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-black/55">
            <ArrowUpRight size={12} strokeWidth={2.4} />
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
            {media?.username && (
              <div className="truncate font-serif text-[13px] italic text-white">@{media.username}</div>
            )}
            {media?.caption && (
              <div className="mt-0.5 line-clamp-1 text-[9.5px] leading-snug text-white/75 transition-all duration-300 group-hover:line-clamp-2">
                {media.caption}
              </div>
            )}
            {stats.length > 0 && (
              <div
                className={`flex items-center gap-x-2.5 font-mono text-[10px] font-medium text-white transition-all duration-300 ease-out ${
                  hovered ? "mt-1.5 max-h-6 opacity-100" : "mt-0 max-h-0 opacity-0"
                }`}
                style={{ overflow: "hidden" }}
              >
                {stats.map(([Icon, value], i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <Icon size={11} strokeWidth={2.2} /> {value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.a>
  );
}

/**
 * A background card in the carousel — poster only, no tilt, no caption,
 * deliberately plain since it's meant to read as depth-of-field backdrop
 * rather than something to study. Click brings it to the front, where it
 * becomes a full ReelCard.
 */
function GhostReelCard({ reel, rim, onSelect }) {
  const media = reel.media;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label="Bring this reel to the front"
      className="block h-full w-full cursor-pointer overflow-hidden rounded-[18px] p-[2px] outline-none"
      style={{ background: `linear-gradient(150deg, ${rim[0]}, ${rim[1]})` }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[16px] bg-black">
        {media?.ok && media.thumbnail ? (
          <img src={media.thumbnail} alt="" loading="lazy" draggable={false}
            className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${rim[0]}44, ${rim[1]}44)` }} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/15" />
      </div>
    </button>
  );
}

/** Index-space distance from `i` to `active`, wrapped the short way around
 *  a ring of `count` slots, so the fan stays a tight, symmetric arc instead
 *  of one card swinging the long way round. */
function shortestOffset(i, active, count) {
  let d = i - active;
  const half = count / 2;
  while (d > half) d -= count;
  while (d <= -half) d += count;
  return d;
}

const CARD_W = 224;
const CARD_H = Math.round(CARD_W * (16 / 9));
const STEP_X = 122;
const MAX_VISIBLE_OFFSET = 3;
const AUTOPLAY_MS = 3200;

/**
 * Many reels, one up front and the rest fanned out behind it in a shallow
 * arc — the "circular carousel" read without the 3D-rotation failure mode
 * (see the file header). `offset` is each card's short-way-round distance
 * from `active`; everything about its position (x/y/rotate/scale/opacity/
 * blur) is a function of that one number, so the whole fan moves as one
 * consistent shape as `active` changes rather than being hand-tuned per
 * card.
 */
function TrendingCarousel({ reels }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = reels.length;

  useEffect(() => {
    if (active >= count) setActive(0);
  }, [count, active]);

  // Auto-advance one slot at a time on a fixed interval, paused while the
  // pointer is over the carousel (hovering to look at a card, or reaching
  // for the arrows) and skipped entirely for reduced motion or a single reel.
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduced, paused, count]);

  return (
    <div
      className="relative mx-auto"
      style={{ height: CARD_H + 32, maxWidth: CARD_W + MAX_VISIBLE_OFFSET * STEP_X * 2 + 60 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 560, height: 340, background: "radial-gradient(closest-side, var(--accent-muted), transparent 72%)", opacity: 0.6, filter: "blur(36px)" }}
      />

      {reels.map((reel, i) => {
        const offset = shortestOffset(i, active, count);
        const abs = Math.min(Math.abs(offset), MAX_VISIBLE_OFFSET);
        const isActive = i === active;
        const beyondView = Math.abs(offset) > MAX_VISIBLE_OFFSET;
        const rim = RIMS[i % RIMS.length];

        return (
          <motion.div
            key={reel.id}
            className="absolute top-4"
            style={{
              width: CARD_W,
              height: CARD_H,
              left: "50%",
              marginLeft: -CARD_W / 2,
              zIndex: 100 - abs,
              pointerEvents: beyondView ? "none" : "auto",
            }}
            animate={{
              x: reduced ? 0 : offset * STEP_X,
              y: reduced ? 0 : abs * 12,
              rotate: reduced ? 0 : offset * 5,
              scale: 1 - abs * 0.13,
              opacity: beyondView ? 0 : 1 - abs * 0.24,
              filter: `blur(${abs * 1.4}px)`,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            {isActive ? (
              <ReelCard reel={reel} rim={rim} />
            ) : (
              <GhostReelCard reel={reel} rim={rim} onSelect={() => setActive(i)} />
            )}
          </motion.div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive((a) => (a - 1 + count) % count)}
            aria-label="Previous reel"
            className="absolute left-0 top-4 z-[200] flex size-8 items-center justify-center rounded-full border border-line bg-[--color-glass] text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
            style={{ top: CARD_H / 2 }}
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setActive((a) => (a + 1) % count)}
            aria-label="Next reel"
            className="absolute right-0 z-[200] flex size-8 items-center justify-center rounded-full border border-line bg-[--color-glass] text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
            style={{ top: CARD_H / 2 }}
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </>
      )}
    </div>
  );
}

/** A handful of reels: a plain wrapping row of full ReelCards, no carousel
 *  machinery needed until there are enough to actually crowd the column. */
function TrendingRow({ reels }) {
  return (
    <div className="flex flex-wrap gap-3.5">
      {reels.map((reel, i) => (
        <div key={reel.id} className="aspect-[9/16] w-[168px] sm:w-[192px]">
          <ReelCard reel={reel} rim={RIMS[i % RIMS.length]} />
        </div>
      ))}
    </div>
  );
}

function TrendingShowcase({ reels }) {
  return reels.length > CAROUSEL_THRESHOLD
    ? <TrendingCarousel reels={reels} />
    : <TrendingRow reels={reels} />;
}

/**
 * The month's standing note tile — the right-hand column. Redesigned as a
 * small stack of numbered insight rows rather than a plain bullet list, so
 * it reads as considered editorial instead of a leftover sidebar: an
 * oversized, very faint serif quote mark bleeds off the top-right corner as
 * the tile's one decorative flourish, and each row fades/slides in with a
 * short stagger the first time it scrolls into view, then lifts slightly
 * and lights its number badge on hover. All motion is skipped for
 * useReducedMotion, same as everywhere else in this file.
 */
function InsightsTile({ notes, month }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-[20px] border border-accent/15 bg-gradient-to-b from-accent/[0.07] to-accent/[0.02] p-5 lg:w-[300px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-6 select-none font-serif text-[110px] italic leading-none text-accent/[0.07]"
      >
        &rdquo;
      </span>

      <div className="relative mb-1 flex items-center gap-1.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent/15">
          <MessageCircle size={11} className="text-accent" strokeWidth={2.4} />
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent">Our Insights</span>
      </div>
      <h3 className="relative mb-5 font-serif text-[20px] font-semibold italic leading-snug text-ink">
        Our insights for the month of {month}
      </h3>

      {notes.length === 0 ? (
        <p className="relative text-[12px] italic leading-relaxed text-mute">Nothing here yet.</p>
      ) : (
        <ul className="relative flex flex-col gap-2.5">
          {notes.map((n, i) => (
            <motion.li
              key={n.id}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: reduced ? 0 : i * 0.08, ease: "easeOut" }}
              whileHover={reduced ? undefined : { x: 3 }}
              className="group flex items-start gap-3 rounded-[12px] border border-transparent px-2.5 py-2 text-[12.5px] leading-relaxed text-ink transition-colors duration-200 hover:border-accent/15 hover:bg-accent/[0.06]"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[9.5px] font-bold text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="pt-0.5">{n.text}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function TrendingFeed() {
  const { data: items, error } = usePortalTrending();

  if (error) return <PanelEmpty>Trending couldn't load right now — try again shortly.</PanelEmpty>;
  if (items == null) return <PanelEmpty>Loading…</PanelEmpty>;
  if (!items.length) return <PanelEmpty>Nothing here yet.</PanelEmpty>;

  const reels = items.filter((it) => it.kind === "reel");
  const notes = items.filter((it) => it.kind === "note");
  const month = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      <div className="min-w-0 lg:flex-1">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mute">
          <Sparkles size={12} strokeWidth={2.2} className="text-accent" />
          Trending now
        </div>
        {reels.length > 0 ? (
          <TrendingShowcase reels={reels} />
        ) : (
          <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
            No reels yet.
          </div>
        )}
      </div>
      <InsightsTile notes={notes} month={month} />
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
