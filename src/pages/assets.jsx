/**
 * src/pages/assets.jsx — the brand's campaign posts, browsed like a shelf.
 * (Filename stays `assets.jsx` to match the router's `/portal/assets` route
 * in routes.jsx.)
 *
 * No nav bar, no boxed frame around the grid — the cards sit directly on the
 * app's own ambient background so they read as floating, not as a widget
 * bolted onto someone else's page.
 *
 * ── The two card behaviours, and why the distinction is server-side ─────────
 * Every card renders its thumbnail and nothing else at rest: a shelf of a
 * dozen simultaneously-decoding videos is what makes a page like this stutter
 * on open, and it also makes scanning it loud. What hover does then depends on
 * `reel.kind`:
 *
 *   reel → the video fades in over the still and plays, muted and looping
 *   post → the still alone scales up; there is nothing to play
 *
 * `kind` is decided by the backend from Instagram's own `product_type`, not by
 * whether a video URL happens to be present — a feed video carries one too and
 * would otherwise autoplay here, contradicting the hint under the title. See
 * 5th-internal-back/portalReels.js.
 *
 * Under prefers-reduced-motion nothing autoplays; a reel behaves like a still
 * until it is opened, where the lightbox gives it real controls.
 *
 * Reels come from usePortalReels() (lib/usePortalData.js) — the same
 * client-scoped fetch lifecycle Campaigns/Overview/Settings use. toViewReel()
 * (components/reels/mapping.js) is the one place backend field names get
 * translated, so the card and lightbox below never have to know whether a
 * field is called `video_url`, `video`, or `video_versions[0].url`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Heart, MessageCircle, ExternalLink, X, Play, Eye } from "lucide-react";
import { AmbientBackground } from "../components/motion/Motion";
import { Section, PanelEmpty } from "../components/portal/Shell";
import { fmtNum } from "../lib/format";
import { usePortalReels } from "../lib/usePortalData";
import { toViewReel } from "../components/reels/mapping";

// Stable reference (module-level, not an inline arrow) — usePortalResource
// re-runs the fetch effect whenever `map` changes identity, so this must not
// be recreated on every render the way an inline `(d) => ...` would be.
const mapReels = (data) => (data.reels ?? data).map(toViewReel);

// One column definition, used by both the grid and its loading skeleton so the
// two can never drift and make the shelf jump as data lands. 300px min is a
// deliberate step up from the old 180: at 180 a 9:16 card stood ~320px tall and
// the caption had room for roughly four words a line.
const GRID_COLS = "repeat(auto-fill, minmax(300px, 1fr))";

/* ═══ CARD ═════════════════════════════════════════════════════════════════
 * Thumbnail at rest, always. A reel swaps in its video on hover; a still just
 * grows. Both share the frame, the scrim and the metadata row so the shelf
 * stays visually uniform and only the behaviour differs.
 */
function ReelCard({ reel, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  // Separate from `hovered` on purpose: the video element mounts on hover but
  // must stay transparent until it actually has frames, or the card flashes
  // black over a perfectly good thumbnail while the first bytes arrive.
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
      // Autoplay can still be refused (a backgrounded tab, an OS power mode).
      // Swallowing it leaves the thumbnail up, which is the correct fallback.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered]);

  const eng = (reel.likes ?? 0) + (reel.comments ?? 0);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.04, 0.4) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onOpen(reel)}
      aria-label={`${isReel ? "Reel" : "Post"} by ${reel.username || "creator"}${reel.caption ? ` — ${reel.caption.slice(0, 80)}` : ""}`}
      // "Floating": a real card with its own blur and shadow, not a tile inside
      // a boxed panel — the shadow is what sells it as sitting above the page
      // rather than embedded in it.
      className="group relative overflow-hidden rounded-[22px] border border-line bg-[--color-glass] text-left shadow-[0_16px_40px_rgba(25,22,17,0.14)] backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_32px_70px_rgba(25,22,17,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
      style={{ aspectRatio: "9 / 16" }}
    >
      {/* Media. The still is the base layer and never unmounts — the video
          fades in on top of it, so there is no gap where the card is empty. */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={reel.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            hovered ? "scale-[1.06]" : "scale-100"
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
      </div>

      {/* Legibility scrim for the caption block below. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />

      {/* One label for every card, reel and still alike. It marks the tile as a
          piece of the brand's content rather than announcing a format — the
          centre play glyph below already says which cards move, so spelling out
          "Reel" vs "Post" here only added a second, noisier signal for it. */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/90 backdrop-blur-sm">
        Content
      </div>

      {/* Centre play glyph, reels only, and only while idle — once the video is
          up it would sit on top of the thing it is advertising. */}
      {canPlay && !playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-black/40 text-white opacity-90 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <Play size={22} fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        {reel.username && (
          <div className="mb-1 text-[13px] font-semibold text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            @{reel.username}
          </div>
        )}
        {reel.caption && (
          <div className="mb-2 line-clamp-2 text-[12.5px] leading-snug text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            {reel.caption}
          </div>
        )}
        {(eng > 0 || reel.views != null) && (
          <div className="flex items-center gap-3.5 text-[11.5px] font-medium text-white/90">
            {reel.views != null && (
              <span className="inline-flex items-center gap-1">
                <Eye size={13} strokeWidth={2} /> {fmtNum(reel.views)}
              </span>
            )}
            {reel.likes != null && (
              <span className="inline-flex items-center gap-1">
                <Heart size={13} strokeWidth={2} /> {fmtNum(reel.likes)}
              </span>
            )}
            {reel.comments != null && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={13} strokeWidth={2} /> {fmtNum(reel.comments)}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ═══ LIGHTBOX — the full post, with a link back to Instagram ══════════════ */
function ReelLightbox({ reel, onClose }) {
  const isReel = reel.kind === "reel" && !!reel.video;

  // Esc closes. The dialog owns this rather than the page, so the listener is
  // bound only while something is actually open.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[480px] overflow-hidden rounded-[24px] border border-line bg-[--color-glass] shadow-[0_40px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X size={18} />
        </button>

        {/* A still opens as a still. Handing a <video> a null src renders a
            broken player, which is worse than the image the card already had. */}
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
            className="aspect-[9/16] w-full bg-black object-cover"
          />
        ) : (
          <img
            key={reel.id}
            src={reel.thumbnail}
            alt={reel.caption || "Post"}
            className="aspect-[9/16] w-full bg-black object-contain"
          />
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            {reel.username && <div className="truncate text-[13.5px] font-semibold text-ink">@{reel.username}</div>}
            {reel.campaign && <div className="mt-0.5 truncate text-[11px] text-mute">{reel.campaign}</div>}
            {reel.caption && <div className="mt-1 line-clamp-2 text-[11.5px] text-mute">{reel.caption}</div>}
          </div>
          {reel.permalink && (
            <a
              href={reel.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-well/70 px-3 py-1.5 text-[11px] font-semibold text-accent no-underline transition-colors hover:border-accent/30"
            >
              Open <ExternalLink size={12} />
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ PAGE ═══ */
export default function ReelsPage() {
  const { data: reels, error, retry } = usePortalReels(mapReels);
  const [openReel, setOpenReel] = useState(null);

  // Drives the subtitle. Counted rather than hardcoded to "reels" so the line
  // stays honest once a brand's shelf holds stills as well.
  const counts = useMemo(() => {
    if (!reels) return null;
    const r = reels.filter((x) => x.kind === "reel").length;
    return { reels: r, posts: reels.length - r };
  }, [reels]);

  const hint =
    counts && counts.posts > 0
      ? `${counts.reels} reel${counts.reels === 1 ? "" : "s"} and ${counts.posts} post${counts.posts === 1 ? "" : "s"} — hover a reel to preview it, click any card to open it on Instagram.`
      : "Hover a card to preview — click to watch and open on Instagram.";

  return (
    <div className="relative">
      <AmbientBackground variant="a" />

      <div className="mx-auto w-full max-w-[1600px] px-5 pb-20 pt-10 sm:px-9">
        <Section id="reels" eyebrow="Content" title="Reels" hint={hint}>
          {error ? (
            <div className="rounded-[16px] border border-line bg-[--color-glass] px-5 py-8 text-center shadow-sm backdrop-blur-md">
              <p className="text-[13px] text-mute">{error}</p>
              <button
                onClick={retry}
                className="mt-3 rounded-full border border-line bg-well/70 px-4 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent/30"
              >
                Retry
              </button>
            </div>
          ) : reels === null ? (
            <div className="grid gap-5" style={{ gridTemplateColumns: GRID_COLS }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[22px] border border-line bg-well/60"
                  style={{ aspectRatio: "9 / 16" }}
                />
              ))}
            </div>
          ) : reels.length === 0 ? (
            <PanelEmpty>No posts yet. They'll appear here once creators go live on Instagram.</PanelEmpty>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: GRID_COLS }}>
              {reels.map((reel, i) => (
                <ReelCard key={reel.id} reel={reel} index={i} onOpen={setOpenReel} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <AnimatePresence>
        {openReel && <ReelLightbox reel={openReel} onClose={() => setOpenReel(null)} />}
      </AnimatePresence>
    </div>
  );
}

/**
 * src/pages/assets.jsx — the brand's Instagram reels, browsed like a shelf.
 * (Filename stays `assets.jsx` to match the router's `/portal/assets` route
 * in routes.jsx — the page itself is reels-only for now.)
 *
 * No nav bar, no boxed frame around the grid — the cards sit directly on the
 * app's own ambient background so they read as floating, not as a widget
 * bolted onto someone else's page. At rest a card is just its thumbnail;
 * hovering swaps in the reel itself so scanning the shelf stays quiet, and a
 * click opens the full video in a lightbox with a link back to Instagram.
 *
 * Reels come from usePortalReels() (lib/usePortalData.js) — the same
 * client-scoped fetch lifecycle Campaigns/Overview/Settings use, so this page
 * no longer hand-rolls its own loading/error/retry state. toViewReel()
 * (components/reels/mapping.js) is the one place backend field names get
 * translated, so the card and lightbox below never have to know whether a
 * field is called `video_url`, `video`, or `video_versions[0].url`.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, MessageCircle, ExternalLink, X, Play } from "lucide-react";
import { AmbientBackground } from "../components/motion/Motion";
import { Section, PanelEmpty } from "../components/portal/Shell";
import { fmtNum } from "../lib/format";
import { usePortalReels } from "../lib/usePortalData";
import { toViewReel } from "../components/reels/mapping";

// Stable reference (module-level, not an inline arrow) — usePortalResource
// re-runs the fetch effect whenever `map` changes identity, so this must not
// be recreated on every render the way an inline `(d) => ...` would be.
const mapReels = (data) => (data.reels ?? data).map(toViewReel);

/* ═══ CARD — thumbnail at rest, the reel itself on hover ═══════════════════ */
function ReelCard({ reel, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
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

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.04, 0.4) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onOpen(reel)}
      // "Floating": a real card with its own blur and shadow, not a tile
      // inside a boxed panel — the shadow is what sells it as sitting above
      // the page rather than embedded in it.
      className="group relative overflow-hidden rounded-[20px] border border-line bg-[--color-glass] text-left shadow-[0_16px_40px_rgba(25,22,17,0.14)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(25,22,17,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
      style={{ aspectRatio: "9 / 15" }}
    >
      <div className="absolute inset-0">
        {hovered && reel.video ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={reel.video}
            muted
            loop
            playsInline
            poster={reel.thumbnail}
          />
        ) : (
          <img src={reel.thumbnail} alt={reel.caption || "Reel"} className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Play glyph — only when idle, so it doesn't sit over the playing video */}
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-0">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Play size={18} fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3.5">
        {reel.username && (
          <div className="mb-1 text-[11.5px] font-semibold text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            @{reel.username}
          </div>
        )}
        {reel.caption && (
          <div className="mb-1.5 line-clamp-2 text-[12px] leading-snug text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            {reel.caption}
          </div>
        )}
        {eng > 0 && (
          <div className="flex items-center gap-3 text-[11px] font-medium text-white/85">
            {reel.likes != null && (
              <span className="inline-flex items-center gap-1">
                <Heart size={12} strokeWidth={2} /> {fmtNum(reel.likes)}
              </span>
            )}
            {reel.comments != null && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={12} strokeWidth={2} /> {fmtNum(reel.comments)}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/* ═══ LIGHTBOX — full reel, controls, link back to Instagram ═══════════════ */
function ReelLightbox({ reel, onClose }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[22px] border border-line bg-[--color-glass] shadow-[0_40px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X size={18} />
        </button>

        <video
          key={reel.id}
          src={reel.video}
          poster={reel.thumbnail}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="aspect-[9/16] w-full bg-black object-cover"
        />

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {reel.username && <div className="truncate text-[13px] font-semibold text-ink">@{reel.username}</div>}
            {reel.caption && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-mute">{reel.caption}</div>}
          </div>
          {reel.permalink && (
            <a
              href={reel.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-well/70 px-3 py-1.5 text-[11px] font-semibold text-accent no-underline transition-colors hover:border-accent/30"
            >
              Open <ExternalLink size={12} />
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ PAGE ═══ */
export default function ReelsPage() {
  const { data: reels, error, retry } = usePortalReels(mapReels);
  const [openReel, setOpenReel] = useState(null);

  return (
    <div className="relative">
      <AmbientBackground variant="a" />

      <div className="mx-auto w-full max-w-[1600px] px-5 pb-16 pt-10 sm:px-9">
        <Section
          id="reels"
          eyebrow="Content"
          title="Reels"
          hint="Hover a card to preview — click to watch and open on Instagram."
        >
          {error ? (
            <div className="rounded-[16px] border border-line bg-[--color-glass] px-5 py-8 text-center shadow-sm backdrop-blur-md">
              <p className="text-[13px] text-mute">{error}</p>
              <button
                onClick={retry}
                className="mt-3 rounded-full border border-line bg-well/70 px-4 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent/30"
              >
                Retry
              </button>
            </div>
          ) : reels === null ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-[20px] border border-line bg-well/60"
                  style={{ aspectRatio: "9 / 15" }}
                />
              ))}
            </div>
          ) : reels.length === 0 ? (
            <PanelEmpty>No reels yet. They'll appear here once posts come in from Instagram.</PanelEmpty>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {reels.map((reel, i) => (
                <ReelCard key={reel.id} reel={reel} index={i} onOpen={setOpenReel} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <AnimatePresence>
        {openReel && <ReelLightbox reel={openReel} onClose={() => setOpenReel(null)} />}
      </AnimatePresence>
    </div>
  );
}