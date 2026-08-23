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