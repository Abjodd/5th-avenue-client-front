// src/pages/insightsView/motifs.jsx — the page's background illustration: a
// tiled constellation of simple influencer-marketing iconography (like,
// comment, play, hashtag, camera, trendline, star, verified badge) drawn as
// plain line art, original to this file — generic geometric symbols, not a
// reproduction of any icon library's or artist's actual glyphs or a real
// logo. Rendered as one SVG <pattern> so it tiles seamlessly to cover the
// fixed ambient layer at any viewport size, and colored with `currentColor`
// so AmbientField can recolor it to the active section's accent with a
// plain CSS transition on the wrapping <svg> — no per-icon JS needed.
const TILE = 480;

const ICONS = {
  heart: (
    <path d="M12 21c0 0-8-5.5-8-11.3C4 6.9 6.2 4.7 9 4.7c1.4 0 2.5.7 3 1.7.5-1 1.6-1.7 3-1.7 2.8 0 5 2.2 5 5C20 15.5 12 21 12 21z" />
  ),
  comment: (
    <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6.5 3.5-6.5 3.5z" fill="currentColor" stroke="none" />
    </>
  ),
  hashtag: (
    <>
      <line x1="9" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="15" y2="20" />
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="3" y1="15" x2="19" y2="15" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.2" />
      <path d="M8.2 7 9.6 4.6h4.8L15.8 7" />
      <circle cx="12" cy="13.6" r="3.8" />
    </>
  ),
  trend: (
    <>
      <polyline points="3,18 9,11 13,15 21,5" />
      <polyline points="15,5 21,5 21,11" />
    </>
  ),
  star: (
    <path d="M12 3l2.5 6.5 7 .5-5.3 4.3L18 21l-6-3.7L6 21l1.8-6.7L2.5 10l7-.5z" />
  ),
  badge: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.6 2.6 5.4-6" />
    </>
  ),
};

// Placements within one TILE×TILE tile — hand-arranged, not random, so the
// repeat reads as a deliberate scatter rather than visibly-looping noise.
const PLACEMENTS = [
  { icon: "heart", x: 46, y: 64, r: -10, s: 1.15 },
  { icon: "comment", x: 232, y: 46, r: 6, s: 0.95 },
  { icon: "play", x: 392, y: 128, r: 0, s: 1.2 },
  { icon: "hashtag", x: 128, y: 196, r: 14, s: 0.85 },
  { icon: "camera", x: 330, y: 256, r: -6, s: 1.05 },
  { icon: "trend", x: 54, y: 332, r: 0, s: 1.1 },
  { icon: "star", x: 268, y: 392, r: 18, s: 0.9 },
  { icon: "badge", x: 430, y: 350, r: 0, s: 0.95 },
  { icon: "hashtag", x: 400, y: 40, r: -18, s: 0.6 },
  { icon: "heart", x: 180, y: 440, r: 22, s: 0.7 },
  { icon: "star", x: 20, y: 220, r: -25, s: 0.55 },
  { icon: "comment", x: 300, y: 420, r: -8, s: 0.65 },
];

export function InfluencerMotifPattern({ patternId = "iw-motifs" }) {
  return (
    <defs>
      <pattern id={patternId} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
        <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {PLACEMENTS.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`}>
              {ICONS[p.icon]}
            </g>
          ))}
        </g>
      </pattern>
    </defs>
  );
}
