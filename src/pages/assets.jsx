/**
 * src/pages/assets.jsx — the brand's campaign posts, logged like a register.
 * (Filename stays `assets.jsx` to match the router's `/portal/assets` route
 * in routes.jsx.)
 *
 * ── Design concept: THE REGISTER ─────────────────────────────────────────
 * A campaign content register — an archive of record, not a media shelf.
 * Every post is filed to the board, and *how* it's filed tells you what it
 * is before you ever hover it:
 *
 *   reel → held by a pin, top and center — it's active, it plays.
 *   post → held by a filing tab — it's static, it doesn't.
 *
 * That single material choice replaces the old "REEL / STILL" corner
 * badge as the primary signal (a small mono tag still exists for anyone
 * who can't read the metaphor, or is on a screen reader). The tilt, the
 * paper stock, the entry number are all in service of "this is a filed
 * record," kept understated rather than played for whimsy.
 *
 * Hover/focus squares a card up off its pin/tab, a restrained few degrees
 * of motion standing in for the old scale-and-glow — enough to read as
 * physical, not enough to feel like a toy. Click opens the full record.
 *
 * `kind` is decided by the backend from Instagram's own `product_type`,
 * not by whether a video URL happens to be present — a feed video carries
 * one too and would otherwise autoplay here, contradicting the pin it's
 * stuck with. See 5th-internal-back/portalReels.js.
 *
 * Under prefers-reduced-motion, nothing swings and nothing autoplays; a
 * reel behaves like a still until it is opened, where the lightbox gives
 * it real controls.
 *
 * Reels come from usePortalReels() (lib/usePortalData.js) — the same
 * client-scoped fetch lifecycle Campaigns/Overview/Settings use. toViewReel()
 * (components/reels/mapping.js) is the one place backend field names get
 * translated, so the card and lightbox below never have to know whether a
 * field is called `video_url`, `video`, or `video_versions[0].url`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Heart, MessageCircle, ExternalLink, X, Play, Eye, Pin } from "lucide-react";
import { fmtNum } from "../lib/format";
import { usePortalReels } from "../lib/usePortalData";
import { toViewReel } from "../components/reels/mapping";

// Stable reference (module-level, not an inline arrow) — usePortalResource
// re-runs the fetch effect whenever `map` changes identity.
const mapReels = (data) => (data.reels ?? data).map(toViewReel);

const GRID_COLS = "repeat(auto-fill, minmax(272px, 1fr))";

/* ═══ TOKENS ═════════════════════════════════════════════════════════════
 * board  — the cork backing the whole page sits on
 * paper  — the index-card stock every post is printed on
 * ink    — text on paper
 * red    — pushpins, the rec tally, the case stamp
 * ochre / teal — the two washi-tape colors, alternated by id so the board
 *                doesn't read as one flat color of tape
 */
const TOKENS = {
  board: "#f5efe5",
  boardFleck: "#e8dcc1",
  paper: "#fffdf9",
  paperEdge: "#d9cab0",
  ink: "#201d1a",
  mute: "#4f4a42",
  red: "#7a2e2a",
  navy: "#33475b",
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

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const tapeSideFor = (id) => (hashStr(id + "s") % 2 === 0 ? TOKENS.navy : TOKENS.slate);

/* ═══ CARD ═══════════════════════════════════════════════════════════════ */
function PinnedCard({ reel, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);
  const reduced = useReducedMotion();

  const isReel = reel.kind === "reel" && !!reel.video;
  const canPlay = isReel && !reduced;

  const tilt = 0;
  const lift = 0;
  const tapeColor = tapeSideFor(reel.id);
  const tapeAngle = 0;

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

  const eng = (reel.likes ?? 0) + (reel.comments ?? 0);
  const fileNo = `No. ${String(index + 1).padStart(3, "0")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -28, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 26,
        delay: Math.min(index * 0.035, 0.4),
      }}
      className="relative"
      style={{ transformOrigin: "50% -6px" }}
    >
      {/* Pin — reels only. The mark that says "this one is active." */}
      {isReel && (
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
          <span
            className="block size-3.5 rounded-full shadow-[0_2px_0_rgba(0,0,0,0.35),0_3px_5px_rgba(0,0,0,0.4)] ring-2 ring-black/10"
            style={{ background: `radial-gradient(circle at 35% 30%, #c56e69, ${TOKENS.red} 65%)` }}
          />
        </div>
      )}

      {/* Filing tab — stills only. Held in place, not pinned; nothing to play. */}
      {!isReel && (
        <div
          className="pointer-events-none absolute -top-2 left-1/2 z-20 h-5 w-16 -translate-x-1/2 opacity-95 shadow-[0_2px_4px_rgba(0,0,0,0.22)]"
          style={{
            background: tapeColor,
            transform: `translateX(-50%) rotate(${tapeAngle}deg)`,
          }}
        />
      )}

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
        animate={
          reduced
            ? {}
            : {
                rotate: 0,
                y: hovered ? -5 : 0,
                scale: hovered ? 1.02 : 1,
              }
        }
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="group relative block w-full rounded-[3px] p-2.5 pb-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wall-red)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--wall-board)]"
        style={{
          "--wall-red": TOKENS.red,
          "--wall-board": TOKENS.board,
          background: TOKENS.paper,
          boxShadow: hovered
            ? `0 26px 40px -12px rgba(0,0,0,0.55), 0 2px 0 ${TOKENS.paperEdge}`
            : `0 10px 18px -8px rgba(0,0,0,0.45), 0 2px 0 ${TOKENS.paperEdge}`,
        }}
      >
        {/* Photo/tape well */}
        <div className="relative overflow-hidden rounded-[2px] bg-black" style={{ aspectRatio: "4 / 5" }}>
          <img
            src={reel.thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              hovered ? "scale-[1.07]" : "scale-100"
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

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

          {/* Kind tag — the plain-language echo of the pin/tab signal */}
          <div
            className="pointer-events-none absolute left-2 top-2 rounded-[2px] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/90"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,0.48)" }}
          >
            {isReel ? "reel" : "still"}
          </div>

          {/* Entry number — the register's own indexing, not a step count */}
          <div
            className="pointer-events-none absolute bottom-2 right-2 text-[9.5px] font-medium tracking-[0.08em] text-white/70"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {fileNo}
          </div>

          {canPlay && !playing && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white/95 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                <Play size={18} fill="currentColor" strokeWidth={0} />
              </span>
            </div>
          )}
        </div>

        {/* The paper margin below the photo — a real polaroid strip */}
        <div className="px-1 pt-3">
          {reel.username && (
            <div
              className="mb-1 truncate text-[14px] font-medium"
              style={{ fontFamily: "'Fraunces', serif", color: TOKENS.ink }}
            >
              @{reel.username}
            </div>
          )}
          {reel.caption && (
            <div
              className="mb-2 line-clamp-2 text-[11.5px] leading-snug"
              style={{ fontFamily: "Inter, sans-serif", color: TOKENS.mute }}
            >
              {reel.caption}
            </div>
          )}
          {(eng > 0 || reel.views != null) && (
            <div
              className="flex items-center gap-3 text-[10.5px] font-medium"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: TOKENS.ink }}
            >
              {reel.views != null && (
                <span className="inline-flex items-center gap-1">
                  <Eye size={11} strokeWidth={2.2} /> {fmtNum(reel.views)}
                </span>
              )}
              {reel.likes != null && (
                <span className="inline-flex items-center gap-1">
                  <Heart size={11} strokeWidth={2.2} /> {fmtNum(reel.likes)}
                </span>
              )}
              {reel.comments != null && (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={11} strokeWidth={2.2} /> {fmtNum(reel.comments)}
                </span>
              )}
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
            className="aspect-[4/5] w-full bg-black object-cover"
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

  const hint =
    counts && counts.posts > 0
      ? `${counts.reels} reel${counts.reels === 1 ? "" : "s"} and ${counts.posts} post${
          counts.posts === 1 ? "" : "s"
        } on file. Hover an entry to preview it, select one to open the full record.`
      : "Hover an entry to preview it — select one to open the full record.";

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
        <div className="mb-10">
          {/* <div
            className="mb-4 inline-block rounded-[2px] border px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em]"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: TOKENS.red,
              borderColor: TOKENS.red,
            }}
          >
            Campaign content 
          </div> */}
          <h1
            className="text-[44px] leading-[1.05] sm:text-[58px]"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: "#545252" }}
          >
            CONTENT
          </h1>
          {/* <p className="mt-3 max-w-[520px] text-[13.5px] leading-relaxed" style={{ fontFamily: "Inter, sans-serif", color: "#c9bca0" }}>
            {hint}
          </p> */}
        </div>

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
          <div className="grid gap-8" style={{ gridTemplateColumns: GRID_COLS }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-[3px]"
                style={{
                  aspectRatio: "4 / 5",
                  background: TOKENS.paperEdge,
                  transform: "rotate(0deg)",
                }}
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
          <div className="grid gap-x-6 gap-y-10" style={{ gridTemplateColumns: GRID_COLS }}>
            {reels.map((reel, i) => (
              <PinnedCard key={reel.id} reel={reel} index={i} onOpen={setOpenReel} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>{openReel && <Dossier reel={openReel} onClose={() => setOpenReel(null)} />}</AnimatePresence>
    </div>
  );
}