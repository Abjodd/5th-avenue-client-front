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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HelpCircle, TrendingUp, Radar, Mail, Heart, MessageCircle, Eye,
  ArrowUpRight, Camera, Sparkles, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Target, Wrench, Newspaper, FileText,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { Section, Panel, PanelEmpty } from "../components/portal/Shell";
import { AmbientBackground, Reveal, Stagger, StaggerItem, HoverLift } from "../components/motion/Motion";
import { usePortalTrending, usePortalQuestions, usePortalMarketWatch, usePortalNews, usePortalNewsletter } from "../lib/usePortalData";
import { PortalAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
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
            className="absolute left-0 top-4 z-[200] flex size-8 items-center justify-center rounded-full border border-line bg-glass text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
            style={{ top: CARD_H / 2 }}
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setActive((a) => (a + 1) % count)}
            aria-label="Next reel"
            className="absolute right-0 z-[200] flex size-8 items-center justify-center rounded-full border border-line bg-glass text-sub shadow-sm backdrop-blur-md transition-colors hover:text-accent"
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

/**
 * The Questions shelf's four prompts, each carrying its own identity — an
 * icon, a color and a numbered corner — so the panel reads as four distinct
 * quadrants at a glance instead of a single answered/unanswered list.
 *
 * Every className fragment below is spelled out in full (never built with
 * string interpolation like `text-${color}`): Tailwind's scanner matches
 * literal class text in the source, so a computed `text-${q.color}` would
 * silently fail to generate the utility at build time.
 */
const QUESTION_FIELDS = [
  {
    key: "whatWorked",
    label: "What Worked",
    icon: CheckCircle2,
    n: "01",
    tint: "bg-green/[0.055]",
    border: "border-green/25",
    chip: "bg-green/10 text-green",
    ghost: "text-green",
    bar: "bg-green",
  },
  {
    key: "whatDidntWork",
    label: "What Didn't Work",
    icon: XCircle,
    n: "02",
    tint: "bg-red/[0.055]",
    border: "border-red/25",
    chip: "bg-red/10 text-red",
    ghost: "text-red",
    bar: "bg-red",
  },
  {
    key: "nextActions",
    label: "Next Actions",
    icon: Target,
    n: "03",
    tint: "bg-accent/[0.055]",
    border: "border-accent/25",
    chip: "bg-accent/10 text-accent",
    ghost: "text-accent",
    bar: "bg-accent",
  },
  {
    key: "areasToImprove",
    label: "Areas to Improve",
    icon: Wrench,
    n: "04",
    tint: "bg-amber/[0.055]",
    border: "border-amber/25",
    chip: "bg-amber/10 text-amber",
    ghost: "text-amber",
    bar: "bg-amber",
  },
];

function QuestionsPanel() {
  const { data, error } = usePortalQuestions();
  if (error) return <PanelEmpty>Questions couldn't load right now — try again shortly.</PanelEmpty>;
  if (data == null) return <PanelEmpty>Loading…</PanelEmpty>;

  // All four prompts render as a fixed 2x2 grid of quadrants every time —
  // an unanswered one shows a placeholder rather than collapsing the grid,
  // so the layout never reflows as the team fills answers in one at a time.
  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {QUESTION_FIELDS.map((q) => {
        const answer = data[q.key];
        const Icon = q.icon;
        return (
          <StaggerItem key={q.key} className="h-full">
            <HoverLift className="h-full">
              <div
                className={`group relative flex h-full min-h-[172px] flex-col overflow-hidden rounded-[18px] border ${q.border} ${q.tint} p-5 transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(25,22,17,0.1)]`}
              >
                <span className={`absolute left-5 top-0 h-[3px] w-10 rounded-full ${q.bar}`} />
                <Icon
                  size={104}
                  strokeWidth={1.1}
                  className={`pointer-events-none absolute -bottom-6 -right-6 ${q.ghost} opacity-[0.07] transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-6`}
                />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${q.chip}`}>
                      <Icon size={16} strokeWidth={2.2} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink">{q.label}</span>
                  </div>
                  <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-mute">{q.n}</span>
                </div>
                <p className="relative mt-3.5 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {answer || <span className="italic text-mute">No answer yet — ask the team.</span>}
                </p>
              </div>
            </HoverLift>
          </StaggerItem>
        );
      })}
    </Stagger>
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

/**
 * The Market Watch shelf — a universal auto-fetched industry news grid (see
 * usePortalNews) leads, since that's the actual "what's happening out
 * there" signal; brand-scoped reels (see usePortalMarketWatch) follow as a
 * secondary rail below it. No manually-typed "our take" notes here anymore
 * — Market Watch is read-only curation plus auto-fetched news, full stop
 * (see MarketWatchEditor on the internal side, which dropped the matching
 * authoring UI).
 */
function NewsCard({ item }) {
  return (
    <HoverLift lift={-3} className="h-full">
      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-line bg-glass transition-shadow duration-300 hover:shadow-[0_16px_36px_-18px_rgba(25,22,17,0.3)] hover:border-accent/25"
      >
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-accent/10 to-accent/[0.03]">
          {item.image ? (
            <img
              src={item.image}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Newspaper size={26} strokeWidth={1.3} className="text-accent/25" />
            </div>
          )}
          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
            <ArrowUpRight size={12} strokeWidth={2.4} />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">{item.title}</span>
          {item.source && (
            <span className="mt-auto pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute">{item.source}</span>
          )}
        </div>
      </a>
    </HoverLift>
  );
}

function NewsGrid({ news, newsError }) {
  if (newsError) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
        Couldn't load the news feed right now.
      </div>
    );
  }
  if (news == null) {
    return (
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[16/10] animate-pulse rounded-[16px] bg-well" />
        ))}
      </div>
    );
  }
  if (!news.length) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
        Nothing here yet.
      </div>
    );
  }
  return (
    <Stagger className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
      {news.map((n) => (
        <StaggerItem key={n.link}>
          <NewsCard item={n} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * Market Watch's own reel card — deliberately NOT ReelCard's rotating
 * rainbow rim and cursor-tracked 3D tilt (that's Trending's social-feed
 * language, kept over there untouched). Market Watch reads as industry
 * coverage, so this borrows NewsCard's vocabulary instead: a plain
 * hairline border and the portal's one accent color rather than four
 * gradient pairs, and a quiet hover-lift rather than a tilt. The thumbnail
 * runs faintly desaturated at rest and returns to full color on hover — a
 * small "editorial" cue, not a loud one.
 */
function MarketWatchReelCard({ reel }) {
  const media = reel.media;
  const [hovered, setHovered] = useState(false);
  const stats = statList(media);
  const playable = media?.ok && (media.video || media.thumbnail);
  const showVideo = hovered && media?.ok && media.video;

  return (
    <HoverLift lift={-3} className="h-full w-full">
      <a
        href={reel.url}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative block h-full w-full overflow-hidden rounded-[16px] border border-line bg-black shadow-[0_10px_28px_-18px_rgba(25,22,17,0.35)] transition-[border-color,box-shadow] duration-300 hover:border-accent/30 hover:shadow-[0_18px_38px_-16px_rgba(25,22,17,0.4)]"
      >
        {playable ? (
          <>
            {media.thumbnail && (
              <img
                src={media.thumbnail}
                alt=""
                loading="lazy"
                draggable={false}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${
                  hovered ? "scale-105 grayscale-0" : "grayscale-[55%]"
                }`}
              />
            )}
            {showVideo && (
              <video
                src={media.video}
                muted
                loop
                autoPlay
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-accent/15 to-accent/[0.04] text-center">
            <Camera size={20} strokeWidth={1.6} className="text-accent/50" />
            <span className="px-5 text-[10px] font-semibold text-mute">No snapshot yet</span>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.35) 100%)" }}
        />

        <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-md">
          <Radar size={9} strokeWidth={2.4} />
          Watch
        </span>

        <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-black/35 text-white/90 opacity-0 backdrop-blur-md transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100">
          <ArrowUpRight size={12} strokeWidth={2.4} />
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
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
      </a>
    </HoverLift>
  );
}

/**
 * Market Watch's reel shelf — a horizontal, scroll-snapping filmstrip
 * rather than Trending's arc carousel. With news now leading the section,
 * reels read as a secondary rail rather than the main event, so a plain
 * scrollable row earns its keep without a carousel's moving parts; small
 * arrow buttons (same vocabulary as TrendingCarousel's) appear on hover
 * for anyone who'd rather click than drag/scroll.
 */
function MarketWatchReelRow({ reels }) {
  const scrollerRef = useRef(null);

  function scrollByViewport(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  return (
    <div className="group/row relative">
      <div
        ref={scrollerRef}
        className="flex gap-3.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x proximity" }}
      >
        {reels.map((reel) => (
          <div
            key={reel.id}
            className="aspect-[9/16] w-[168px] shrink-0 sm:w-[188px]"
            style={{ scrollSnapAlign: "start" }}
          >
            <MarketWatchReelCard reel={reel} />
          </div>
        ))}
      </div>

      {reels.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollByViewport(-1)}
            aria-label="Scroll reels left"
            className="absolute -left-3 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-glass text-sub opacity-0 shadow-sm backdrop-blur-md transition-all duration-200 hover:text-accent group-hover/row:opacity-100 sm:flex"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => scrollByViewport(1)}
            aria-label="Scroll reels right"
            className="absolute -right-3 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-glass text-sub opacity-0 shadow-sm backdrop-blur-md transition-all duration-200 hover:text-accent group-hover/row:opacity-100 sm:flex"
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </>
      )}
    </div>
  );
}

function MarketWatchFeed() {
  const { data: items, error } = usePortalMarketWatch();
  const { data: news, error: newsError } = usePortalNews();

  const reels = (items || []).filter((it) => it.kind === "reel");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mute">
          <Newspaper size={12} strokeWidth={2.2} className="text-accent" />
          Latest news
        </div>
        <NewsGrid news={news} newsError={!!newsError} />
      </div>

      <div>
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mute">
          <Radar size={12} strokeWidth={2.2} className="text-accent" />
          Reels
        </div>
        {error ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
            Couldn't load right now — try again shortly.
          </div>
        ) : items == null ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
            Loading…
          </div>
        ) : reels.length > 0 ? (
          <MarketWatchReelRow reels={reels} />
        ) : (
          <div className="flex min-h-[160px] items-center justify-center rounded-[16px] border border-dashed border-line-mid text-[12px] text-mute">
            No reels yet.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One row in the Insights → Newsletter history — a dated list rather than a
 * card grid, since a PDF has no natural thumbnail the way a news article's
 * og:image does; the date is what a returning reader scans for ("did this
 * month's newsletter come in yet?"), so it sits right under the title
 * rather than tucked away. Opens in a new tab, same as every other outbound
 * link in this file — the browser's own PDF viewer handles the rest.
 */
function NewsletterRow({ item, fileUrl }) {
  return (
    <HoverLift lift={-2}>
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center gap-3.5 rounded-[14px] border border-line bg-glass px-4 py-3.5 transition-colors duration-200 hover:border-accent/25 hover:bg-accent/[0.04]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent/10 text-accent">
          <FileText size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{item.title || "Newsletter.pdf"}</span>
          <span className="mt-0.5 block text-[10.5px] text-mute">
            {item.uploadedAt
              ? new Date(item.uploadedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
              : "—"}
          </span>
        </span>
        <ArrowUpRight size={13} strokeWidth={2.2} className="shrink-0 text-mute transition-colors duration-200 group-hover:text-accent" />
      </a>
    </HoverLift>
  );
}

/**
 * The Newsletter shelf — this brand's own dated history of PDFs the
 * internal team has uploaded (see usePortalNewsletter / PortalAPI.newsletter),
 * newest first. Brand-scoped like Market Watch, not universal like Trending:
 * each brand only ever sees what was uploaded for it. The brand scope has to
 * be threaded through here (rather than living only inside the hook) because
 * each row's file link carries it too — the backend's byte-serving route
 * re-checks it per request rather than trusting a bare id.
 */
function NewsletterFeed() {
  const { user } = useAuth();
  const scope = useMemo(
    () => ({ brandId: user?.brandId, clientName: user?.clientName }),
    [user?.brandId, user?.clientName],
  );
  const { data: items, error } = usePortalNewsletter();

  if (error) return <PanelEmpty>Newsletters couldn't load right now — try again shortly.</PanelEmpty>;
  if (items == null) return <PanelEmpty>Loading…</PanelEmpty>;
  if (!items.length) return <PanelEmpty>Nothing here yet.</PanelEmpty>;

  return (
    <Stagger className="flex flex-col gap-2.5">
      {items.map((it) => (
        <StaggerItem key={it.id}>
          <NewsletterRow item={it} fileUrl={PortalAPI.newsletterFileUrl(it.id, scope)} />
        </StaggerItem>
      ))}
    </Stagger>
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
              {s.id === "trending" ? <TrendingFeed /> : s.id === "questions" ? <QuestionsPanel /> : s.id === "market-watch" ? <MarketWatchFeed /> : s.id === "newsletter" ? <NewsletterFeed /> : <PanelEmpty>{s.empty}</PanelEmpty>}
            </Panel>
          </Section>
        ))}
      </div>
    </div>
  );
}
