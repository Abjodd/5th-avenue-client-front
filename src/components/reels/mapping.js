/**
 * src/components/reels/mapping.js — backend reel → what the shelf renders.
 *
 * The one place field names get translated, so ReelCard and ReelLightbox in
 * pages/assets.jsx never have to know whether the video arrived as `video`,
 * `video_url` or `video_versions[0].url`. That is not defensive padding: the
 * portal reads /api/portal/reels, which already normalises HikerAPI's media
 * object, but the same raw object shows up in the internal app's tracking
 * screens, and a reel pasted from there should render here without a second
 * mapper. Accepting both shapes costs a few `??` chains and removes the class
 * of bug where the page silently shows black tiles because one key moved.
 *
 * Mirrors components/campaigns/mapping.js — same role, same reason: view code
 * stays ignorant of the wire format.
 */
import { reelPosterUrl } from "../../lib/api";


/** First finite number among the candidates. A real 0 wins over a later value;
 *  only null/undefined mean "not reported", which the card reads as "hide the
 *  stat" rather than "this reel got zero likes". */
function num(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Progressive MP4 from a raw `video_versions[]`. Type 101 is the one that
 *  plays in a plain <video>; the rest are adaptive renditions at identical
 *  dimensions, so picking by size would choose arbitrarily among equals. */
function rawVideo(versions) {
  if (!Array.isArray(versions) || !versions.length) return null;
  return (versions.find((v) => v?.type === 101) || versions[0])?.url || null;
}

/** Where the post lives, off whatever the row already carries — a
 *  `platform` string from the creator roster, or the permalink itself.
 *  Instagram is the only source feeding the reel cache today (see
 *  5th-internal-back/portalReels.js), so deriving it here means the day a
 *  YouTube link reaches the shelf the tile is already right, with no schema
 *  change and no extra field on the wire.
 *
 *  Recognised only, never assumed: the roster also carries Snapchat (see
 *  campaigns/mapping.js PROFILE_URL), and defaulting the unrecognised case
 *  to Instagram would badge those posts with the wrong platform's logo.
 *  null means "we don't know", which the tile renders as no badge. */
function platformOf(s) {
  const v = String(s ?? "");
  if (/youtube|youtu\.be/i.test(v)) return "youtube";
  if (/instagram/i.test(v)) return "instagram";
  return null;
}

/** Poster frame from a raw `image_versions2`. */
function rawThumb(iv2) {
  return iv2?.candidates?.[0]?.url || iv2?.additional_candidates?.first_frame?.url || null;
}

/**
 * One reel, in the shape the card and lightbox read.
 *
 * `id` falls back through code and permalink because it is the React key and
 * the lightbox's `key` on <video> — a duplicate or undefined id there makes two
 * cards share one player, which looks like the wrong reel opening on click.
 */
export function toViewReel(r = {}) {
  const code = r.code ?? r.shortcode ?? null;

  // The page links out with this; a reel with no permalink just hides the
  // "Open" button (see ReelLightbox) rather than rendering a dead anchor.
  // Hoisted because `platform` is read off it too — a raw media object
  // carries only `code`, so reading `r.permalink` directly would miss the
  // Instagram link this rebuilds and leave the tile unbadged.
  const permalink =
    r.permalink ?? r.postUrl ?? (code ? `https://www.instagram.com/reel/${code}/` : null);

  // What the card does on hover hangs entirely off this. Our own route sends
  // `kind`; a raw media object is classified here on the same rule the backend
  // uses — product_type "clips", not merely "has a video", because a feed video
  // has one too and must not autoplay on a shelf that promises only reels do.
  const video = r.video ?? r.video_url ?? rawVideo(r.video_versions);
  const kind = r.kind ?? (r.product_type === "clips" && video ? "reel" : "post");
  const isReel = kind === "reel";

  return {
    kind,
    id: String(r.id ?? r.pk ?? code ?? r.permalink ?? ""),
    permalink,
    username: r.username ?? r.user?.username ?? r.handle ?? null,
    // Raw captions arrive as an object with the text one level down.
    caption: r.caption?.text ?? (typeof r.caption === "string" ? r.caption : null),
    // Null on a still, so the card has nothing to swap in even if something
    // downstream mistakes it for a reel.
    video: isReel ? video : null,
    // Our own copy first, then the signed link, then a raw media object's own.
    // The order is the point: `r.thumbnail` is an Instagram CDN URL whose
    // signature expires ~106h after it was issued, so preferring it would keep
    // the shelf on the clock the poster route exists to remove. A row with no
    // stored poster yet falls through to it and still renders.
    //
    // A carousel's cover lives on its first child, not on the parent.
    thumbnail:
      reelPosterUrl(r) ??
      r.thumbnail ??
      r.thumbnail_url ??
      rawThumb(r.image_versions2) ??
      rawThumb(r.carousel_media?.[0]?.image_versions2),
    likes: num(r.likes, r.like_count),
    comments: num(r.comments, r.comment_count),
    views: num(r.views, r.play_count, r.ig_play_count, r.view_count),
    forwards: num(r.forwards, r.reshare_count, r.share_count),
    duration: num(r.duration, r.video_duration),
    // Already ISO from our own route; a raw object carries unix seconds.
    takenAt: r.takenAt ?? (r.taken_at ? new Date(r.taken_at * 1000).toISOString() : null),
    slides: num(r.slides) ?? (Array.isArray(r.carousel_media) ? r.carousel_media.length : null),
    campaign: r.campaign ?? null,
    // Badged on the resting tile, so the shelf says where each entry ran.
    platform: platformOf(r.platform ?? permalink),
  };
}
