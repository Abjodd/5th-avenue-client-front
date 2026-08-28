/**
 * src/pages/assets.jsx — the brand's campaign posts, logged like a register.
 * (Filename stays `assets.jsx` to match the router's `/portal/assets` route
 * in routes.jsx.)
 *
 * ── Design concept: THE REGISTER ─────────────────────────────────────────
 * A campaign content register — an archive of record, not a media shelf.
 * The page is set in the portal's own vocabulary (bg-page, the ambient
 * wash, `microlabel`/`font-serif`, glass panels), so it reads as the same
 * product as every other tab and follows the theme into dark mode. It used
 * to paint its own cream cork board from a local token table, which meant
 * the one tab in the portal that ignored the theme toggle entirely.
 *
 * The entries themselves carry no mount: each is shown at the shape it
 * was shot in, so the board reads as the work first and the record
 * second. Who made it, how it did and when it went live wait under the
 * pointer, which is also when a reel starts playing. Click opens the full
 * file, where the caption and the outbound link live.
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
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Heart, MessageCircle, ExternalLink, X, Eye, Calendar } from "lucide-react";
import { fmtNum, prettyDate } from "../lib/format";
import { usePortalReels } from "../lib/usePortalData";
import AnimatedNumber from "../components/AnimatedNumber";
import { AmbientBackground } from "../components/motion/Motion";
import { ErrorState, EmptyState } from "../components/PageStates";
import { toViewReel } from "../components/reels/mapping";

// Stable reference (module-level, not an inline arrow) — usePortalResource
// re-runs the fetch effect whenever `map` changes identity.
const mapReels = (data) => (data.reels ?? data).map(toViewReel);

const GRID_COLS = "repeat(auto-fill, minmax(230px, 1fr))";

/* ═══ PLATFORM MARK ══════════════════════════════════════════════════════
 * Each platform's own glyph, drawn as a white outline with no plate behind
 * it — lucide dropped its brand marks at v1, and these are a handful of
 * paths against a second icon dependency. The badge sits on the entry's own
 * frame, and a filled brand tile there read as a sticker applied to the
 * work; an outline in the frame's own light reads as a caption on it.
 *
 * A platform with no mark renders nothing, which is the honest answer to
 * "we don't know where this ran" — better than badging it as Instagram
 * because that is what the shelf usually holds.
 */
const PLATFORM_MARKS = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <line x1="17.2" y1="6.8" x2="17.21" y2="6.8" strokeWidth="2.6" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.2" y="4.8" width="19.6" height="14.4" rx="4.4" />
      <path d="M10.3 9.1v5.8l5-2.9z" strokeLinejoin="round" />
    </>
  ),
};

/* Where the post lives, for the record's outbound link. An unknown platform
   gets neutral wording rather than being called Instagram. */
const PLATFORM_LABELS = { instagram: "Instagram", youtube: "YouTube" };

function PlatformMark({ platform, size = 18, ...rest }) {
  const mark = PLATFORM_MARKS[platform];
  if (!mark) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
      {...rest}
    >
      {mark}
    </svg>
  );
}

/* The three figures a post reports, in the order they read. A metric with
   nothing on file is left out rather than shown as a zero it never measured.
   Shared by the tile and the file so the two can never list them differently. */
const statsOf = (reel) =>
  [
    reel.views != null && [Eye, "views", fmtNum(reel.views)],
    reel.likes != null && [Heart, "likes", fmtNum(reel.likes)],
    reel.comments != null && [MessageCircle, "comments", fmtNum(reel.comments)],
  ].filter(Boolean);

/* ═══ TILE ═══════════════════════════════════════════════════════════════
 * The entry at the shape it was shot in, with nothing mounted around it.
 * At rest it is only the frame and a platform badge — a wall of work
 * rather than a wall of index cards. Who made it, how it did and when it
 * went live wait under the pointer, which is also when a reel starts
 * playing. The caption is not among them: at tile size it clipped to two
 * lines of hashtags and buried the figures under it. It reads in full in
 * the file instead. Click opens that.
 */
function ReelTile({ reel, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);
  const reduced = useReducedMotion();

  const isReel = reel.kind === "reel" && !!reel.video;
  const canPlay = isReel && !reduced;
  const stats = statsOf(reel);

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
        className="relative block w-full overflow-hidden rounded-[14px] bg-black text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg]"
        style={{
          aspectRatio: "9 / 16",
          boxShadow: hovered
            ? "0 26px 40px -12px rgba(0,0,0,0.45)"
            : "0 10px 18px -8px rgba(0,0,0,0.35)",
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
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
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
          className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 font-mono transition-all duration-200 ease-out ${
            hovered ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
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

        {/* Who made it, and how it did */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {reel.username && (
            <div className="truncate font-serif text-[15px] italic text-white">@{reel.username}</div>
          )}
          {stats.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] font-medium text-white">
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

/* ═══ LIGHTBOX — the full record for one entry ══════════════════════════
 * The card is sized to the media's own aspect rather than to a fixed width:
 * a 9:16 reel inside a 440px card was letterboxed with a black bar down
 * each side, which is the shape of the card showing through, not of the
 * work. Everything the register knows about the entry follows underneath —
 * who, when, how it did, what it said, and the way back to the original.
 */
function Dossier({ reel, onClose }) {
  const isReel = reel.kind === "reel" && !!reel.video;
  const ratio = isReel ? 9 / 16 : 4 / 5;
  const stats = statsOf(reel);
  const source = PLATFORM_LABELS[reel.platform];

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const media = isReel ? (
    <video
      key={reel.id}
      src={reel.video}
      poster={reel.thumbnail}
      autoPlay
      muted
      loop
      playsInline
      controls
      className="w-full object-cover md:h-full md:w-auto"
      style={{ aspectRatio: ratio }}
    />
  ) : (
    <img
      key={reel.id}
      src={reel.thumbnail}
      alt={reel.caption || "Post"}
      className="w-full object-cover md:h-full md:w-auto"
      style={{ aspectRatio: ratio }}
    />
  );

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[6px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="glass-panel relative flex max-h-[92vh] w-[min(420px,92vw)] flex-col overflow-hidden rounded-[20px] md:w-auto md:max-w-[94vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          // Crosses to the left on the two-column layout: the card's top-right
          // corner is the record's there, and the badge already sits in it.
          className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:left-3 md:right-auto"
        >
          <X size={18} />
        </button>

        {/* Only the body scrolls — the close button sits on the shell above it,
            so a long caption can't carry it off the top of the card.

            Stacked on a phone, side by side from md up. Stacked, the card can
            only be as wide as its media, and the media only as tall as the
            space the record leaves it; on a short window those two limits
            compounded into a narrow strip down the middle of the screen.
            Beside it the record costs no height at all, so the media can take
            the window and the card is as wide as the two of them together. */}
        <div className="flex min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* Width-led stacked, height-led from md up: aspect-ratio derives
              whichever dimension isn't set, so the frame ends exactly where the
              work does and never letterboxes it either way. */}
          <div className="shrink-0 bg-black md:h-[min(78vh,720px)]">{media}</div>

          {/* The record beside the work, in the portal's own weights. Nothing
              here may shout over the media: the handle leads, the date and
              campaign are a quiet single line under it, and the figures read in
              the same icon row the tile uses rather than as three headline
              numbers of their own. */}
          <div className="flex flex-col gap-2.5 px-3.5 py-3 md:w-[300px] md:overflow-y-auto">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                {reel.username && (
                  <div className="truncate font-serif text-[15px] font-semibold italic text-ink">@{reel.username}</div>
                )}
                {/* One line, truncated. Ordinary muted text rather than a
                    microlabel: uppercased and letter-spaced it wrapped to two
                    lines and read louder than the handle above it. Date first
                    so the clip eats the campaign name, which reads as
                    truncated, rather than the date, which just reads wrong. */}
                <div className="mt-0.5 truncate text-[11px] text-mute">
                  {[reel.takenAt && prettyDate(reel.takenAt), reel.campaign].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-accent-muted px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-accent">
                {isReel ? "reel" : "still"}
              </span>
            </div>

            {stats.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-line py-2.5 font-mono text-[12px] font-medium text-ink">
                {stats.map(([Icon, label, value]) => (
                  <span key={label} className="inline-flex items-center gap-1.5" title={label}>
                    <Icon size={12} strokeWidth={2.2} className="text-mute" /> {value}
                  </span>
                ))}
              </div>
            )}

            {/* Clamped only while stacked, where a wall of hashtags was the
                tallest thing on the card. The column has the room, and scrolls. */}
            {reel.caption && (
              <p className="line-clamp-3 text-[12px] leading-relaxed text-sub md:line-clamp-none">{reel.caption}</p>
            )}

            {reel.permalink && (
              /* mt-auto takes the foot of the column, which outruns the record
                 it holds — the alternative was the button floating mid-panel
                 with dead space under it. */
              <a
                href={reel.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-accent py-2 text-[11.5px] font-semibold text-on-accent no-underline shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md md:mt-auto"
              >
                {source ? `Open on ${source}` : "Open original post"} <ExternalLink size={12} />
              </a>
            )}
          </div>
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
    <div className="relative min-h-screen w-full bg-page font-sans text-ink">
      <AmbientBackground variant="a" />

      <div className="relative mx-auto w-full max-w-[1600px] px-5 pb-24 pt-14 sm:px-9">
        {/* The Regional Map tab's header, part for part: mono eyebrow, serif
            italic headline, then a row of count chips. A bare headline is the
            one shape no other tab uses, and on a board this wide it read as an
            orphan. */}
        <header className="mb-10">
          <div className="microlabel mb-1.5 tracking-[0.2em]">Content</div>
          <h1 className="font-serif text-[clamp(30px,4vw,42px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">
            Everything that went live
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-sub">
            {chips.map(([noun, n], i) => (
              <span
                key={noun}
                className="fi rounded-full border border-line bg-[--color-glass] px-2.5 py-1 shadow-sm backdrop-blur-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <b className="tnum text-ink">
                  <AnimatedNumber value={n} />
                </b>{" "}
                {noun}{n === 1 ? "" : "s"} on file
              </span>
            ))}
            <span className="text-mute">Hover an entry for its details — select one to open the full record.</span>
          </div>
        </header>

        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : reels === null ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: GRID_COLS }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-[14px] bg-well" style={{ aspectRatio: "9 / 16" }} />
            ))}
          </div>
        ) : reels.length === 0 ? (
          <EmptyState
            icon="▤"
            title="Nothing on file yet"
            hint="New posts are logged here automatically as creators publish them."
          />
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
