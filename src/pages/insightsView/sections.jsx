// src/pages/insights/sections.jsx — the four Insights sections, redesigned
// against the page's own dark "watchroom" palette (see theme.js). Same data
// contracts as before (usePortalQuestions/Trending/MarketWatch/News/
// Newsletter, PortalAPI, useAuth) — every hook and field name here is
// unchanged from the previous Insights.jsx, only the chrome is new.
//
// Interaction survives from before where it earned its keep (the reel
// card's cursor-tracked 3D tilt, the carousel's arc math, the reel
// filmstrip's scroll-snap) — that machinery was already well-tuned and a
// rewrite would only risk it, not improve it. What's new is everything
// about how it *looks*, plus the GSAP scroll-batch reveal every card now
// enters on (see useScrollBatch in primitives.jsx) in place of the portal's
// shared Stagger/StaggerItem.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Radar, Heart, MessageCircle, Eye,
  ArrowUpRight, Camera, Sparkles, ChevronLeft, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Target, Wrench, Newspaper, FileText,
  Volume2, VolumeX,
} from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { HoverLift } from "../../components/motion/Motion";
import {
  usePortalTrending, usePortalQuestions, usePortalMarketWatch, usePortalNews, usePortalNewsletter,
} from "../../lib/usePortalData";
import { PortalAPI } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { fmtNum } from "../../lib/format";
import { GLASS_CARD, GLASS_CARD_SOFT, sectionById } from "./theme";
import { useScrollBatch } from "./primitives";

/* ── Shared bits ─────────────────────────────────────────────────────── */

function EmptyState({ children, tall = false }) {
  return (
    <div
      className={`flex ${tall ? "min-h-[160px]" : "min-h-[100px]"} items-center justify-center rounded-[16px] border border-dashed border-black/[0.16] px-5 py-8 text-center text-[12px] leading-relaxed text-black/45 dark:border-white/[0.14] dark:text-white/40`}
    >
      {children}
    </div>
  );
}

function SkeletonGrid({
  n = 4,
  className = "grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4",
  itemClassName = "aspect-[16/10] animate-pulse rounded-[16px] bg-black/[0.045] dark:bg-white/[0.04]",
}) {
  return (
    <div className={className}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={itemClassName} />
      ))}
    </div>
  );
}

function Kicker({ icon: Icon, children, accent }) {
  return (
    <div
      className="mb-4 flex items-center gap-2.5 font-serif text-[19px] font-bold italic tracking-[-0.01em] text-[#171410] sm:text-[23px] dark:text-white"
    >
      <Icon size={19} strokeWidth={2.2} style={{ color: accent }} />
      {children}
    </div>
  );
}

/* ── I. Questions ────────────────────────────────────────────────────── */

const QUESTION_FIELDS = [
  { key: "whatWorked", label: "What Worked", icon: CheckCircle2, n: "01" },
  { key: "whatDidntWork", label: "What Didn't Work", icon: XCircle, n: "02" },
  { key: "nextActions", label: "Next Actions", icon: Target, n: "03" },
  { key: "areasToImprove", label: "Areas to Improve", icon: Wrench, n: "04" },
];

export function QuestionsSection() {
  const { data, error } = usePortalQuestions();
  const ref = useRef(null);
  const theme = sectionById("questions");
  useScrollBatch(ref, "[data-reveal]", { y: 30, scale: 0.97 }, [data == null, !!error]);

  if (error) return <EmptyState>Questions couldn't load right now — try again shortly.</EmptyState>;
  if (data == null) {
    return (
      <SkeletonGrid
        n={4}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        itemClassName="min-h-[220px] animate-pulse rounded-[20px] bg-black/[0.045] dark:bg-white/[0.04]"
      />
    );
  }

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {QUESTION_FIELDS.map((q) => {
        const answer = data[q.key];
        const Icon = q.icon;
        return (
          <div key={q.key} data-reveal className="h-full">
            <div
              className={`${GLASS_CARD} group relative flex h-full min-h-[220px] flex-col overflow-hidden p-7 transition-[border-color,transform] duration-300 hover:-translate-y-1 sm:p-8`}
              style={{ borderColor: `${theme.accent}30` }}
            >
              <span className="absolute left-7 top-0 h-[3px] w-12 rounded-full sm:left-8" style={{ background: theme.accent }} />
              <Icon
                size={124}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-7 -right-7 opacity-[0.07] transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-6"
                style={{ color: theme.accent }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${theme.accent}1c`, color: theme.accent }}
                  >
                    <Icon size={19} strokeWidth={2.2} />
                  </span>
                  <span className="font-serif text-[19px] font-bold tracking-[-0.01em] text-[#171410] dark:text-white sm:text-[21px]">{q.label}</span>
                </div>
                <span className="font-mono text-[10.5px] font-semibold tracking-[0.1em] text-black/35 dark:text-white/30">{q.n}</span>
              </div>
              <p className="relative mt-5 flex-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-black/70 dark:text-white/70 sm:text-[15px]">
                {answer || <span className="italic text-black/40 dark:text-white/35">No answer yet — ask the team.</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── II. Trending ────────────────────────────────────────────────────── */

function statList(media) {
  return [
    media?.views != null && [Eye, fmtNum(media.views)],
    media?.likes != null && [Heart, fmtNum(media.likes)],
    media?.comments != null && [MessageCircle, fmtNum(media.comments)],
  ].filter(Boolean);
}

function ReelCard({ reel }) {
  const media = reel.media;
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(true);
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
  // Plain by default — thumbnail only, no badges, no text, no video. Hover
  // is what reveals everything (video playback included), per the "reels
  // play only when hovered" brief.
  const showVideo = hovered && media?.ok && media.video && !reduced;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      className="group relative h-full w-full"
    >
      <motion.a
        href={reel.url}
        target="_blank"
        rel="noreferrer"
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className="relative block h-full w-full [transform-style:preserve-3d]"
      >
      <div className="h-full w-full overflow-hidden rounded-[18px] border border-black/[0.08] bg-black shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] dark:border-white/[0.09]">
        <div className="relative h-full w-full overflow-hidden">
          {playable ? (
            <>
              {media.thumbnail && (
                <img src={media.thumbnail} alt="" loading="lazy" draggable={false}
                  className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${hovered ? "scale-105 grayscale-0 opacity-100" : "grayscale-[55%]"} ${showVideo ? "opacity-0" : "opacity-100"}`} />
              )}
              {showVideo && (
                <video src={media.video} muted={muted} loop autoPlay playsInline preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover" />
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-center">
              <Camera size={20} strokeWidth={1.6} className="text-white/40" />
              <span className="px-5 text-[10px] font-semibold text-white/40">No snapshot yet</span>
            </div>
          )}

          {/* Everything below is hover-revealed only — the card is plain at rest. */}
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.08) 38%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.4) 100%)" }}
          />

          <span className={`absolute left-2.5 top-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)] transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}>
            Reel
          </span>

          <span className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-all duration-200 ${hovered ? "translate-x-0.5 -translate-y-0.5 bg-black/60 opacity-100" : "opacity-0"}`}>
            <ArrowUpRight size={12} strokeWidth={2.4} />
          </span>

          <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-2.5 transition-all duration-300 ${hovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
            {media?.username && (
              <div className="truncate font-serif text-[13px] italic text-white">@{media.username}</div>
            )}
            {media?.caption && (
              <div className="mt-0.5 line-clamp-2 text-[9.5px] leading-snug text-white/70">
                {media.caption}
              </div>
            )}
            {stats.length > 0 && (
              <div className="mt-1.5 flex items-center gap-x-2.5 font-mono text-[10px] font-medium text-white">
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

      {/* Sibling of the anchor above, not a descendant of it — clicking it
          can never trigger the reel's own link navigation, however event
          propagation happens to behave. */}
      {showVideo && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMuted((m) => !m); }}
          aria-label={muted ? "Unmute this reel" : "Mute this reel"}
          className="absolute bottom-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100"
        >
          {muted ? <VolumeX size={13} strokeWidth={2.2} /> : <Volume2 size={13} strokeWidth={2.2} />}
        </button>
      )}
    </div>
  );
}

function GhostReelCard({ reel, onSelect }) {
  const media = reel.media;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label="Bring this reel to the front"
      className="block h-full w-full cursor-pointer overflow-hidden rounded-[18px] border border-black/[0.08] bg-black outline-none dark:border-white/[0.09]"
    >
      <div className="relative h-full w-full overflow-hidden">
        {media?.ok && media.thumbnail ? (
          <img src={media.thumbnail} alt="" loading="lazy" draggable={false}
            className="absolute inset-0 h-full w-full object-cover grayscale-[55%]" />
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
      </div>
    </button>
  );
}

function shortestOffset(i, active, count) {
  let d = i - active;
  const half = count / 2;
  while (d > half) d -= count;
  while (d <= -half) d += count;
  return d;
}

// Real totals across the visible reels, for the two floating readouts that
// fill the wide empty flanks either side of the carousel on large screens
// (the carousel itself is intentionally narrow so the arc has room to
// swing) — null when the data simply doesn't carry that stat, so the tile
// just doesn't render rather than showing a fake 0.
function aggregateReelStats(reels) {
  let views = 0, likes = 0, hasViews = false, hasLikes = false;
  for (const r of reels) {
    const m = r.media;
    if (m?.views != null) { views += m.views; hasViews = true; }
    if (m?.likes != null) { likes += m.likes; hasLikes = true; }
  }
  return { views: hasViews ? views : null, likes: hasLikes ? likes : null };
}

const MAX_VISIBLE_OFFSET = 3;
const AUTOPLAY_MS = 3200;
const CAROUSEL_THRESHOLD = 3;

function TrendingCarousel({ reels, glow, big }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = reels.length;
  // Bigger, edge-to-edge geometry once Our Insights is collapsed out of the
  // way — otherwise the same size this always used.
  const CARD_W = big ? 340 : 224;
  const CARD_H = Math.round(CARD_W * (16 / 9));
  const STEP_X = big ? 200 : 122;

  useEffect(() => {
    if (active >= count) setActive(0);
  }, [count, active]);

  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    const id = setInterval(() => setActive((a) => (a + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduced, paused, count]);

  return (
    <div className="relative">
      <div
        className={big ? "relative w-full" : "relative mx-auto"}
        style={{ height: CARD_H + 32, ...(big ? {} : { maxWidth: CARD_W + MAX_VISIBLE_OFFSET * STEP_X * 2 + 60 }) }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 560, height: 340, background: `radial-gradient(closest-side, ${glow}, transparent 72%)`, opacity: 0.7, filter: "blur(36px)" }}
      />
      {reels.map((reel, i) => {
        const offset = shortestOffset(i, active, count);
        const abs = Math.min(Math.abs(offset), MAX_VISIBLE_OFFSET);
        const isActive = i === active;
        const beyondView = Math.abs(offset) > MAX_VISIBLE_OFFSET;
        return (
          <motion.div
            key={reel.id}
            className="absolute top-4"
            style={{ width: CARD_W, height: CARD_H, left: "50%", marginLeft: -CARD_W / 2, zIndex: 100 - abs, pointerEvents: beyondView ? "none" : "auto" }}
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
            {isActive ? <ReelCard reel={reel} /> : <GhostReelCard reel={reel} onSelect={() => setActive(i)} />}
          </motion.div>
        );
      })}
        {count > 1 && (
          <>
            <button type="button" onClick={() => setActive((a) => (a - 1 + count) % count)} aria-label="Previous reel"
              className="absolute left-0 top-1/2 z-[200] flex -translate-y-1/2 items-center justify-center px-3 py-6 text-black/45 transition-colors hover:text-[#171410] dark:text-white/45 dark:hover:text-white">
              <ChevronLeft size={34} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => setActive((a) => (a + 1) % count)} aria-label="Next reel"
              className="absolute right-0 top-1/2 z-[200] flex -translate-y-1/2 items-center justify-center px-3 py-6 text-black/45 transition-colors hover:text-[#171410] dark:text-white/45 dark:hover:text-white">
              <ChevronRight size={34} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TrendingRow({ reels, big }) {
  return (
    <div className="flex flex-wrap gap-3.5">
      {reels.map((reel) => (
        <div key={reel.id} className={big ? "aspect-[9/16] w-[220px] sm:w-[260px]" : "aspect-[9/16] w-[168px] sm:w-[192px]"}>
          <ReelCard reel={reel} />
        </div>
      ))}
    </div>
  );
}

function TrendingStat({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[22px] font-bold text-[#171410] dark:text-white">{value}</span>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/35">{label}</span>
    </div>
  );
}

function InsightsTile({ notes, month, accent }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`${GLASS_CARD} relative flex w-full shrink-0 flex-col p-8 lg:w-[320px]`}
      style={{ borderColor: `${accent}28` }}
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        <MessageCircle size={17} strokeWidth={2.2} className="shrink-0" style={{ color: accent }} />
        <span
          className="text-[19px] font-bold italic tracking-[-0.01em] text-[#171410] dark:text-white"
          style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
        >
          Our Insights
        </span>
      </div>
      <p className="mb-7 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/35">
        For the month of {month}
      </p>
      {notes.length === 0 ? (
        <p className="text-[12.5px] italic leading-relaxed text-black/40 dark:text-white/35">Nothing here yet.</p>
      ) : (
        <ul className="flex max-h-[360px] flex-col overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.16)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/15">
          {notes.map((n, i) => (
            <motion.li
              key={n.id}
              data-reveal
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: reduced ? 0 : 0.09 * i, ease: "easeOut" }}
              className="flex gap-3 border-t border-black/[0.08] py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/[0.08]"
            >
              <span aria-hidden className="mt-[8px] size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
              <p
                className="text-[14.5px] italic leading-relaxed text-black/80 dark:text-white/[0.82]"
                style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
              >
                {n.text}
              </p>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

export function TrendingSection() {
  const { data: items, error } = usePortalTrending();
  const ref = useRef(null);
  const ready = items != null && items.length > 0;
  useScrollBatch(ref, "[data-reveal]", {}, [ready, !!error]);
  const theme = sectionById("trending");
  // Our Insights starts collapsed: the reels read edge-to-edge and bigger by
  // default, with the "Our Insights" button there to bring the notes panel
  // back whenever it's wanted.
  const [insightsOpen, setInsightsOpen] = useState(false);

  if (error) return <EmptyState>Trending couldn't load right now — try again shortly.</EmptyState>;
  if (items == null) return <SkeletonGrid n={4} />;
  if (!items.length) return <EmptyState>Nothing here yet.</EmptyState>;

  const reels = items.filter((it) => it.kind === "reel");
  const notes = items.filter((it) => it.kind === "note");
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  const stats = aggregateReelStats(reels);

  return (
    <div ref={ref} className="flex flex-col gap-5">
      <div className={`flex flex-col gap-5 ${insightsOpen ? "lg:flex-row lg:items-stretch" : ""}`}>
        <div className="min-w-0 lg:flex-1" data-reveal>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Kicker icon={Sparkles} accent={theme.accent}>Trending now</Kicker>
            <button
              type="button"
              onClick={() => setInsightsOpen((v) => !v)}
              aria-expanded={insightsOpen}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-black/[0.03] px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-black/60 transition-colors hover:border-black/30 hover:text-[#171410] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60 dark:hover:border-white/30 dark:hover:text-white"
            >
              <MessageCircle size={12} strokeWidth={2.2} />
              {insightsOpen ? "Hide Our Insights" : "Our Insights"}
              <ChevronDown size={12} strokeWidth={2.4} className={`transition-transform duration-200 ${insightsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {reels.length > 0 ? (
            reels.length > CAROUSEL_THRESHOLD
              ? <TrendingCarousel reels={reels} glow={theme.glow} big={!insightsOpen} />
              : <TrendingRow reels={reels} big={!insightsOpen} />
          ) : (
            <EmptyState tall>No reels yet.</EmptyState>
          )}
          {!insightsOpen && reels.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-10 border-t border-black/[0.08] pt-6 dark:border-white/[0.08]">
              <TrendingStat label="Reels" value={reels.length} />
              <TrendingStat label="Total views" value={stats.views != null ? fmtNum(stats.views) : "—"} />
              <TrendingStat label="Total likes" value={stats.likes != null ? fmtNum(stats.likes) : "—"} />
            </div>
          )}
        </div>
        {insightsOpen && (
          <div data-reveal>
            <InsightsTile notes={notes} month={month} accent={theme.accent} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── III. Market Watch (News → Our Watch → Reels) ───────────────────── */

function NewsCard({ item, accent }) {
  return (
    <HoverLift lift={-3} className="h-full">
      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className={`${GLASS_CARD_SOFT} group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow] duration-300 hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)]`}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}55`)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden" style={{ background: `linear-gradient(160deg, ${accent}22, transparent)` }}>
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Newspaper size={16} strokeWidth={1.3} style={{ color: `${accent}55` }} />
            </div>
          )}
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
            <ArrowUpRight size={9} strokeWidth={2.4} />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-2">
          <span className="line-clamp-2 text-[10.5px] font-medium leading-snug text-black/90 dark:text-white/90">{item.title}</span>
          {item.source && (
            <span className="mt-auto pt-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-black/40 dark:text-white/35">{item.source}</span>
          )}
        </div>
      </a>
    </HoverLift>
  );
}

const NEWS_SCROLL_CLASS =
  "max-h-[420px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15";

function NewsGrid({ news, newsError, accent }) {
  if (newsError) return <EmptyState>Couldn't load the news feed right now.</EmptyState>;
  if (news == null) {
    return (
      <SkeletonGrid
        n={6}
        className="grid grid-cols-3 gap-2.5"
        itemClassName="aspect-[4/3] animate-pulse rounded-[12px] bg-black/[0.045] dark:bg-white/[0.04]"
      />
    );
  }
  if (!news.length) return <EmptyState>Nothing here yet.</EmptyState>;
  return (
    <div className="relative">
      <div className={`grid grid-cols-2 gap-2.5 pb-1 pr-1 sm:grid-cols-3 xl:grid-cols-4 ${NEWS_SCROLL_CLASS}`}>
        {news.map((n) => (
          <div key={n.link} data-reveal>
            <NewsCard item={n} accent={accent} />
          </div>
        ))}
      </div>
      {news.length > 6 && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-9 rounded-b-[14px] bg-gradient-to-t from-[#faf6ec] to-transparent dark:from-[#07070b]" />
      )}
    </div>
  );
}

function MarketWatchReelCard({ reel }) {
  const media = reel.media;
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [muted, setMuted] = useState(true);
  const stats = statList(media);
  const playable = media?.ok && (media.video || media.thumbnail);
  // Plain at rest — hover is what plays the video and reveals everything else.
  const showVideo = hovered && media?.ok && media.video && !reduced;

  return (
    <HoverLift
      lift={-4}
      className="group relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.a
        href={reel.url}
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative block h-full w-full overflow-hidden rounded-[16px] border bg-black shadow-[0_14px_32px_-18px_rgba(0,0,0,0.7)] transition-[border-color,box-shadow] duration-300"
        style={{ borderColor: hovered ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.09)" }}
      >
        {playable ? (
          <>
            {media.thumbnail && (
              <img src={media.thumbnail} alt="" loading="lazy" draggable={false}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${hovered ? "scale-105 grayscale-0" : "grayscale-[60%]"} ${showVideo ? "opacity-0" : "opacity-100"}`} />
            )}
            {showVideo && (
              <video src={media.video} muted={muted} loop autoPlay playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-center">
            <Camera size={20} strokeWidth={1.6} className="text-white/35" />
            <span className="px-5 text-[10px] font-semibold text-white/40">No snapshot yet</span>
          </div>
        )}

        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.02) 55%, rgba(0,0,0,0.4) 100%)" }} />

        <span className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-all duration-200 ${hovered ? "translate-x-0.5 -translate-y-0.5 opacity-100" : "opacity-0"}`}>
          <ArrowUpRight size={12} strokeWidth={2.4} />
        </span>
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ${hovered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
          {media?.username && <div className="truncate font-serif text-[13px] italic text-white">@{media.username}</div>}
          {media?.caption && (
            <div className="mt-0.5 line-clamp-2 text-[9.5px] leading-snug text-white/70">{media.caption}</div>
          )}
          {stats.length > 0 && (
            <div className="mt-1.5 flex items-center gap-x-2.5 font-mono text-[10px] font-medium text-white">
              {stats.map(([Icon, value], i) => (
                <span key={i} className="inline-flex items-center gap-1"><Icon size={11} strokeWidth={2.2} /> {value}</span>
              ))}
            </div>
          )}
        </div>
      </motion.a>

      {/* Sibling of the anchor above, not a descendant of it — same fix as
          ReelCard's mute button, same reason. */}
      {showVideo && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMuted((m) => !m); }}
          aria-label={muted ? "Unmute this reel" : "Mute this reel"}
          className="absolute bottom-2.5 right-2.5 z-20 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100"
        >
          {muted ? <VolumeX size={13} strokeWidth={2.2} /> : <Volume2 size={13} strokeWidth={2.2} />}
        </button>
      )}
    </HoverLift>
  );
}

function MarketWatchReelRow({ reels }) {
  const scrollerRef = useRef(null);
  const pausedRef = useRef(false);
  const reduced = useReducedMotion();

  function scrollByViewport(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  // Always-drifting filmstrip: a slow constant scrollLeft nudge each frame,
  // bouncing direction at either end rather than jump-cutting back to the
  // start. Paused whenever the row is hovered (pausedRef, flipped straight
  // in the DOM handlers below so hovering never waits on a re-render) and
  // skipped entirely for prefers-reduced-motion or a one-card row.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || reduced || reels.length < 2) return;
    let raf;
    let dir = 1;
    const SPEED = 0.45; // px per frame — a slow, steady drift
    const step = () => {
      if (!pausedRef.current) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          let next = el.scrollLeft + dir * SPEED;
          if (next >= max) { next = max; dir = -1; }
          else if (next <= 0) { next = 0; dir = 1; }
          el.scrollLeft = next;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced, reels.length]);

  return (
    <div
      className="group/row relative"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div ref={scrollerRef} className="flex gap-3.5 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ scrollSnapType: "x proximity" }}>
        {reels.map((reel) => (
          <div key={reel.id} data-reveal className="aspect-[9/16] w-[196px] shrink-0 sm:w-[224px]" style={{ scrollSnapAlign: "start" }}>
            <MarketWatchReelCard reel={reel} />
          </div>
        ))}
      </div>
      {reels.length > 1 && (
        <>
          <button type="button" onClick={() => scrollByViewport(-1)} aria-label="Scroll reels left"
            className="absolute -left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center px-3 py-8 text-black/45 opacity-0 transition-all duration-200 hover:text-[#171410] group-hover/row:opacity-100 dark:text-white/50 dark:hover:text-white sm:flex">
            <ChevronLeft size={32} strokeWidth={2} />
          </button>
          <button type="button" onClick={() => scrollByViewport(1)} aria-label="Scroll reels right"
            className="absolute -right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center px-3 py-8 text-black/45 opacity-0 transition-all duration-200 hover:text-[#171410] group-hover/row:opacity-100 dark:text-white/50 dark:hover:text-white sm:flex">
            <ChevronRight size={32} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

function OurWatchNote({ note, accent, first }) {
  return (
    <article className={`group relative py-7 ${first ? "pt-0" : "border-t border-black/[0.08] dark:border-white/[0.08]"}`}>
      {note.createdAt && (
        <div className="mb-2.5 flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          <span className="size-1 rounded-full" style={{ background: accent }} />
          {new Date(note.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      )}
      <p className="max-w-2xl font-serif text-[16.5px] italic leading-relaxed text-black/85 transition-colors duration-300 group-hover:text-[#171410] dark:text-white/85 dark:group-hover:text-white">
        {note.text}
      </p>
    </article>
  );
}

function OurWatchList({ notes, accent }) {
  if (!notes.length) return <EmptyState>Nothing here yet.</EmptyState>;
  return (
    <div className="flex flex-col">
      {notes.map((n, i) => (
        <div key={n.id} data-reveal>
          <OurWatchNote note={n} accent={accent} first={i === 0} />
        </div>
      ))}
    </div>
  );
}

export function MarketWatchSection() {
  const { data: items, error } = usePortalMarketWatch();
  const { data: news, error: newsError } = usePortalNews();
  const ref = useRef(null);
  const theme = sectionById("market-watch");

  const notes = (items || []).filter((it) => it.kind === "note");
  const reels = (items || []).filter((it) => it.kind === "reel");

  useScrollBatch(ref, "[data-reveal]", {}, [news == null, items == null, !!error, !!newsError]);

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-11">
      <div data-reveal>
        <Kicker icon={Newspaper} accent={theme.accent}>Latest news</Kicker>
        <NewsGrid news={news} newsError={!!newsError} accent={theme.accent} />
      </div>
      <div data-reveal>
        <Kicker icon={Eye} accent={theme.accent}>Our watch</Kicker>
        {error ? <EmptyState>Couldn't load right now — try again shortly.</EmptyState>
          : items == null ? <EmptyState>Loading…</EmptyState>
          : notes.length <= 3 ? <OurWatchList notes={notes} accent={theme.accent} />
          : <div className={`pr-1 ${NEWS_SCROLL_CLASS}`}><OurWatchList notes={notes} accent={theme.accent} /></div>}
      </div>
      <div className="min-w-0">
        <Kicker icon={Radar} accent={theme.accent}>Reels</Kicker>
        {error ? <EmptyState tall>Couldn't load right now — try again shortly.</EmptyState>
          : items == null ? (
            <SkeletonGrid
              n={4}
              className="flex gap-3.5 overflow-hidden"
              itemClassName="aspect-[9/16] w-[168px] shrink-0 animate-pulse rounded-[16px] bg-black/[0.045] dark:bg-white/[0.04] sm:w-[188px]"
            />
          )
          : reels.length > 0 ? <MarketWatchReelRow reels={reels} />
          : <EmptyState tall>No reels yet.</EmptyState>}
      </div>
    </div>
  );
}

/* ── IV. Newsletter ──────────────────────────────────────────────────── */

function NewsletterRow({ item, fileUrl, accent }) {
  return (
    <HoverLift lift={-2}>
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className={`${GLASS_CARD_SOFT} group flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-200`}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${accent}55`)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: `${accent}22`, color: accent }}>
          <FileText size={16} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-black/90 dark:text-white/90">{item.title || "Newsletter.pdf"}</span>
          <span className="mt-0.5 block text-[10.5px] text-black/40 dark:text-white/35">
            {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : "—"}
          </span>
        </span>
        <ArrowUpRight size={13} strokeWidth={2.2} className="shrink-0 text-black/40 transition-colors duration-200 group-hover:text-[#171410] dark:text-white/35 dark:group-hover:text-white" />
      </a>
    </HoverLift>
  );
}

export function NewsletterSection() {
  const { user } = useAuth();
  const scope = useMemo(() => ({ brandId: user?.brandId, clientName: user?.clientName }), [user?.brandId, user?.clientName]);
  const { data: items, error } = usePortalNewsletter();
  const ref = useRef(null);
  const theme = sectionById("newsletter");
  useScrollBatch(ref, "[data-reveal]", { y: 20 }, [items == null, !!error]);

  if (error) return <EmptyState>Newsletters couldn't load right now — try again shortly.</EmptyState>;
  if (items == null) {
    return (
      <SkeletonGrid
        n={3}
        className="flex flex-col gap-2.5"
        itemClassName="h-[62px] animate-pulse rounded-[16px] bg-black/[0.045] dark:bg-white/[0.04]"
      />
    );
  }
  if (!items.length) return <EmptyState>Nothing here yet.</EmptyState>;

  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      {items.map((it) => (
        <div key={it.id} data-reveal>
          <NewsletterRow item={it} fileUrl={PortalAPI.newsletterFileUrl(it.id, scope)} accent={theme.accent} />
        </div>
      ))}
    </div>
  );
}
