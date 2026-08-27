/**
 * src/pages/assets.jsx — the brand's campaign posts, logged like a register.
 * (Filename stays `assets.jsx` to match the router's `/portal/assets` route
 * in routes.jsx.)
 *
 * ── Design concept: THE REGISTER ─────────────────────────────────────────
 * A campaign content register — an archive of record, not a media shelf.
 * The board, the mono labelling and the paper the file is printed on are
 * all in service of "this is a filed record," kept understated rather
 * than played for whimsy.
 *
 * The entries themselves carry no mount: each is shown at the shape it
 * was shot in, so the board reads as the work first and the record
 * second. Everything about an entry waits under the pointer — who made
 * it, what it said, how it did, when it went live — which is also when a
 * reel starts playing. Click opens the full file.
 *
 * `kind` is decided by the backend from Instagram's own `product_type`,
 * not by whether a video URL happens to be present — a feed video carries
 * one too and would otherwise autoplay here, contradicting the label the
 * entry is given. See 5th-internal-back/portalReels.js.
 *
 * Under prefers-reduced-motion, nothing swings and nothing autoplays; a
 * reel behaves like a still until it is opened, where the lightbox gives
 * it real controls.
 *
 * Reels come from usePortalReels() (lib/usePortalData.js) — the same
 * client-scoped fetch lifecycle Campaigns/Overview/Settings use. toViewReel()
 * (components/reels/mapping.js) is the one place backend field names get
 * translated, so the tile and lightbox below never have to know whether a
 * field is called `video_url`, `video`, or `video_versions[0].url`.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Heart, MessageCircle, ExternalLink, X, Eye, Calendar } from "lucide-react";
import { fmtNum, prettyDate } from "../lib/format";
import { usePortalReels } from "../lib/usePortalData";
import AnimatedNumber from "../components/AnimatedNumber";
import { toViewReel } from "../components/reels/mapping";

// Stable reference (module-level, not an inline arrow) — usePortalResource
// re-runs the fetch effect whenever `map` changes identity.
const mapReels = (data) => (data.reels ?? data).map(toViewReel);

const GRID_COLS = "repeat(auto-fill, minmax(230px, 1fr))";

/* ═══ TOKENS ═════════════════════════════════════════════════════════════
 * board  — the cork backing the whole page sits on
 * paper  — the stock the header chips and the opened file are printed on
 * ink    — text on paper
 * red    — the focus ring and the case stamp
 * slate  — the header's mono eyebrow
 */
const TOKENS = {
  board: "#f5efe5",
  boardFleck: "#e8dcc1",
  paper: "#fffdf9",
  paperEdge: "#d9cab0",
  ink: "#201d1a",
  mute: "#4f4a42",
  red: "#7a2e2a",
  slate: "#5c5347",
};

/* Loads the two type roles once. Fraunces (an editorial serif, not a
 * display poster face) carries the heading and each entry's byline —
 * restrained enough to read as a document, not a flyer. JetBrains Mono
 * handles every number and label, so stats read like a registry ledger. */
function FontFaces() {
  useEffect(() => {
    if (document.getElementById("wall-fonts")) return;
    const link = document.createElement("link");
    link.id = "wall-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
}

/* ═══ PLATFORM MARK ══════════════════════════════════════════════════════
 * Each platform's own badge, in its own colours — lucide dropped its brand
 * glyphs at v1, and these are a handful of paths against a second icon
 * dependency. Drawn filled rather than stroked: at badge size a solid mark
 * stays legible over whatever the frame happens to be, where an outline
 * disappears into a bright one.
 *
 * A platform with no mark renders nothing, which is the honest answer to
 * "we don't know where this ran" — better than badging it as Instagram
 * because that is what the shelf usually holds.
 */
const PLATFORM_MARKS = {
  // Instagram's gradient runs corner to corner, warm at the bottom-left.
  instagram: (gid) => (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="0.85" y2="0">
          <stop offset="0%" stopColor="#FFD65C" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="55%" stopColor="#D62976" />
          <stop offset="78%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.4" fill={`url(#${gid})`} />
      <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round">
        <rect x="5.7" y="5.7" width="12.6" height="12.6" rx="3.9" />
        <circle cx="12" cy="12" r="3.15" />
        <line x1="17.1" y1="6.9" x2="17.11" y2="6.9" strokeWidth="2.3" />
      </g>
    </>
  ),
  youtube: () => (
    <>
      <rect x="1.2" y="4.6" width="21.6" height="14.8" rx="4.4" fill="#FF0033" />
      <path d="M10 8.6v6.8l5.9-3.4z" fill="#fff" />
    </>
  ),
};

function PlatformMark({ platform, size = 17, ...rest }) {
  // Scoped per instance so many badges on one page can't collide on the
  // gradient's id — the whole reason this is a render fn and not a node.
  const gid = useId();
  const mark = PLATFORM_MARKS[platform];
  if (!mark) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      {mark(gid)}
    </svg>
  );
}

/* ═══ TILE ═══════════════════════════════════════════════════════════════
 * The entry at the shape it was shot in, with nothing mounted around it.
 * At rest it is only the frame and a platform badge — a wall of work
 * rather than a wall of index cards. Every fact about it (who made it,
 * what it said, how it did, when it went live) waits under the pointer,
 * which is also when a reel starts playing. Click opens the full file.
 */
function ReelTile({ reel, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);
  const reduced = useReducedMotion();

  const isReel = reel.kind === "reel" && !!reel.video;
  const canPlay = isReel && !reduced;

  useEffect(() => {
    if (!hovered) setPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    if (hovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered]);

  // Built as a list so the row lays itself out and a missing metric simply
  // isn't there, rather than three near-identical conditional blocks.
  const stats = [
    reel.views != null && [Eye, "views", fmtNum(reel.views)],
    reel.likes != null && [Heart, "likes", fmtNum(reel.likes)],
    reel.comments != null && [MessageCircle, "comments", fmtNum(reel.comments)],
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 26,
        delay: Math.min(index * 0.035, 0.4),
      }}
    >
      <motion.button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={() => onOpen(reel)}
        aria-label={`${isReel ? "Reel" : "Post"} by ${reel.username || "creator"}${
          reel.caption ? ` — ${reel.caption.slice(0, 80)}` : ""
        }`}
        animate={reduced ? {} : { y: hovered ? -6 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative block w-full overflow-hidden rounded-[14px] bg-black text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wall-red)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--wall-board)]"
        style={{
          "--wall-red": TOKENS.red,
          "--wall-board": TOKENS.board,
          aspectRatio: "9 / 16",
          boxShadow: hovered
            ? "0 26px 40px -12px rgba(0,0,0,0.55)"
            : "0 10px 18px -8px rgba(0,0,0,0.45)",
        }}
      >
        <img
          src={reel.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hovered ? "scale-[1.05]" : "scale-100"
          }`}
        />

        {canPlay && hovered && (
          <video
            ref={videoRef}
            src={reel.video}
            poster={reel.thumbnail}
            muted
            loop
            playsInline
            preload="none"
            onCanPlay={() => setPlaying(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              playing ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* The one mark on a resting frame: where the post ran. It stands in
            for the play glyph — on a shelf that is almost all reels, "this
            moves" was the fact the eye already had, and the hover row still
            names reel or still outright. */}
        <PlatformMark
          platform={reel.platform}
          className={`pointer-events-none absolute right-2.5 top-2.5 transition-opacity duration-200 ${
            hovered ? "opacity-0" : "opacity-100"
          }`}
          style={{ filter: "drop-shadow(0 1px 2.5px rgba(0,0,0,0.45))" }}
        />

        {/* Scrim — carries the text, so it arrives with it rather than
            dimming every frame on the board at rest. */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.6) 34%, rgba(0,0,0,0.14) 62%, rgba(0,0,0,0.5) 100%)",
          }}
        />

        {/* What it is, and when it went live */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 transition-all duration-200 ease-out ${
            hovered ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/85">
            {isReel ? "reel" : "still"}
          </span>
          {reel.takenAt && (
            <span className="flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-white/85">
              <Calendar size={10} strokeWidth={2.4} /> {prettyDate(reel.takenAt)}
            </span>
          )}
        </div>

        {/* Who made it, what it said, how it did */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {reel.username && (
            <div
              className="truncate text-[14px] font-medium text-white"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              @{reel.username}
            </div>
          )}
          {reel.caption && (
            <p
              className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-white/70"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {reel.caption}
            </p>
          )}
          {stats.length > 0 && (
            <div
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-medium text-white"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {stats.map(([Icon, label, value]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <Icon size={11} strokeWidth={2.2} /> {value}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ═══ LIGHTBOX — the file, pulled off the board ═════════════════════════ */
function Dossier({ reel, onClose }) {
  const isReel = reel.kind === "reel" && !!reel.video;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,7,3,0.82)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotate: -2, y: 18 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotate: 2, y: 18 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[3px]"
        style={{ background: TOKENS.paper, boxShadow: "0 50px 100px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Binder clip */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="h-5 w-14 rounded-full border-2 border-[#8b8f92] bg-[#c7cbce] shadow-[0_3px_6px_rgba(0,0,0,0.4)]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close and re-pin"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X size={18} />
        </button>

        {isReel ? (
          <video
            key={reel.id}
            src={reel.video}
            poster={reel.thumbnail}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="aspect-[9/16] max-h-[68vh] w-full bg-black object-contain"
          />
        ) : (
          <img
            key={reel.id}
            src={reel.thumbnail}
            alt={reel.caption || "Post"}
            className="aspect-[4/5] w-full bg-black object-contain"
          />
        )}

        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {reel.username && (
                <div
                  className="truncate text-[16px] font-medium"
                  style={{ fontFamily: "'Fraunces', serif", color: TOKENS.ink }}
                >
                  @{reel.username}
                </div>
              )}
              {reel.campaign && (
                <div
                  className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: TOKENS.mute }}
                >
                  {reel.campaign}
                </div>
              )}
            </div>
            <span
              className="shrink-0 rounded-[2px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: TOKENS.red, transform: "rotate(-2deg)" }}
            >
              {isReel ? "reel" : "still"}
            </span>
          </div>

          {reel.caption && (
            <p className="mb-3 text-[12.5px] leading-relaxed" style={{ fontFamily: "Inter, sans-serif", color: TOKENS.mute }}>
              {reel.caption}
            </p>
          )}

          {reel.permalink && (
            <a
              href={reel.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-[2px] border-2 border-dashed py-2 text-[11.5px] font-bold uppercase tracking-[0.1em] no-underline transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: TOKENS.red, borderColor: TOKENS.red }}
            >
              Open file on Instagram <ExternalLink size={13} />
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ PAGE ═══════════════════════════════════════════════════════════════ */
export default function ReelsPage() {
  const { data: reels, error, retry } = usePortalReels(mapReels);
  const [openReel, setOpenReel] = useState(null);

  const counts = useMemo(() => {
    if (!reels) return null;
    const r = reels.filter((x) => x.kind === "reel").length;
    return { reels: r, posts: reels.length - r };
  }, [reels]);

  // The header's count chips, in the shape the Regional Map's header uses.
  // A kind with nothing in it is dropped rather than shown as "0 posts".
  const chips = counts
    ? [["reel", counts.reels], ["post", counts.posts]].filter(([, n]) => n > 0)
    : [];

  return (
    <div
      className="relative min-h-full"
      style={{
        background: `radial-gradient(circle at 1px 1px, ${TOKENS.boardFleck} 1px, transparent 0) 0 0/22px 22px, ${TOKENS.board}`,
      }}
    >
      <FontFaces />

      {/* board vignette so the corners read as a physical, lit surface */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.55)" }}
      />

      <div className="relative mx-auto w-full max-w-[1600px] px-5 pb-24 pt-14 sm:px-9">
        {/* The Regional Map tab's header, part for part: mono eyebrow, serif
            italic headline, then a row of count chips. A bare headline is the
            one shape no other tab uses, and on a board this wide it read as an
            orphan.

            Typography is the portal's — `microlabel`, `font-serif` — so this
            page's heading is set the same as every other tab's. Only the
            colours are local: `text-ink`/`text-sub`/`border-line` follow the
            theme, and this board is always cream, so they would wash out in
            dark mode. TOKENS carries them instead. */}
        <header className="mb-10">
          <div className="microlabel mb-1.5 tracking-[0.2em]" style={{ color: TOKENS.slate }}>
            Content
          </div>
          <h1
            className="font-serif text-[clamp(30px,4vw,42px)] font-bold italic leading-[1.05] tracking-[-0.02em]"
            style={{ color: TOKENS.ink }}
          >
            Everything that went live
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: TOKENS.mute }}>
            {chips.map(([noun, n], i) => (
              <span
                key={noun}
                className="fi rounded-full border px-2.5 py-1 shadow-sm"
                style={{ borderColor: TOKENS.paperEdge, background: TOKENS.paper, animationDelay: `${i * 60}ms` }}
              >
                <b className="tnum font-semibold" style={{ color: TOKENS.ink }}>
                  <AnimatedNumber value={n} />
                </b>{" "}
                {noun}{n === 1 ? "" : "s"} on file
              </span>
            ))}
            <span>Hover an entry for its details — select one to open the full record.</span>
          </div>
        </header>

        {error ? (
          <div
            className="mx-auto max-w-[420px] rounded-[3px] px-6 py-9 text-center"
            style={{ background: TOKENS.paper, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
          >
            <div
              className="mx-auto mb-3 inline-block rounded-[2px] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: TOKENS.red }}
            >
              Register unavailable
            </div>
            <p className="mb-4 text-[13px]" style={{ fontFamily: "Inter, sans-serif", color: TOKENS.ink }}>
              {error}
            </p>
            <button
              onClick={retry}
              className="rounded-[2px] border px-4 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.1em] transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: TOKENS.ink, borderColor: TOKENS.ink }}
            >
              Retry
            </button>
          </div>
        ) : reels === null ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: GRID_COLS }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-[14px]"
                style={{ aspectRatio: "9 / 16", background: TOKENS.paperEdge }}
              />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <div
            className="mx-auto max-w-[420px] rounded-[3px] px-6 py-10 text-center"
            style={{ background: TOKENS.paper, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
          >
            <p className="text-[13.5px] leading-relaxed" style={{ fontFamily: "Inter, sans-serif", color: TOKENS.mute }}>
              No entries yet. New posts are logged automatically as creators publish to Instagram.
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: GRID_COLS }}>
            {reels.map((reel, i) => (
              <ReelTile key={reel.id} reel={reel} index={i} onOpen={setOpenReel} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>{openReel && <Dossier reel={openReel} onClose={() => setOpenReel(null)} />}</AnimatePresence>
    </div>
  );
}