// src/pages/insightsView/audienceVoice.jsx — Insights → Audience Voice.
//
// What real people said in the comments on the brand's campaign posts (the
// same posts as the Content tab), read by AI and laid out as a briefing in
// ONE fixed-height box that scrolls on its own, so the rest of the Insights
// page stays short. A sticky bar on top jumps between the parts and shows how
// far through you are:
//
//   Overview  — headline, summary, net sentiment, the sentiment split, the
//               conversation over time, and four small-chart tiles.
//   Topics    — ranked bars; pick one to read its real comments.
//   Buying    — buying signals (top 5 positive/neutral buying comments,
//               rotating cards) next to the questions people ask.
//   Concerns  — the negative comments worth reading.
//   Love & ideas, and the post-by-post table (scrolls on its own, sticky
//   header — it's also the charts' table view).
//
// Everything is read from the stored analysis (GET /api/portal/comment-
// insights) — opening this page never fetches or analyses anything. Every
// quote is a real comment, verbatim (the backend attaches the text; the AI
// only ever points at comment numbers — see commentInsights.js).
//
// Colour: sentiment is a diverging pair (blue = positive, red = negative,
// gray midpoint = neutral), validated for colour-vision deficiency in both
// themes; single-series charts use the blue alone. Colour is never the only
// cue — segments carry their share, legends name the parts, pills carry an
// icon + word, and every chart mark has a hover/focus tooltip.
//
// Performance: this section paints a lot of cards, so they are flat (no
// backdrop blur, no filter animations, small shadows), there are no
// scroll-linked GSAP reveals inside the box, scroll position is tracked with
// refs (no re-render per scroll frame), and the rotating cards pause whenever
// they're off screen.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import {
  ThumbsUp, ThumbsDown, Minus, Shuffle, MessagesSquare, Heart, ShoppingBag, CircleHelp,
  Lightbulb, Sparkles, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown, Quote as QuoteIcon, Megaphone, TrendingUp,
} from "lucide-react";
import { usePortalCommentInsights } from "../../lib/usePortalData";
import { reelPosterUrl } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import { fmtNum, prettyDate } from "../../lib/format";
import AnimatedNumber from "../../components/AnimatedNumber";
import { MONO_LABEL } from "./theme";

/* ── Palette ─────────────────────────────────────────────────────────── */
const SENT = {
  light: { positive: "#3d73c9", neutral: "#b3aea4", negative: "#d04e4e", track: "rgba(61,115,201,0.14)", grid: "rgba(23,20,16,0.08)", negSoft: "rgba(208,78,78,0.07)" },
  dark: { positive: "#5e8fe0", neutral: "#565660", negative: "#e06a6a", track: "rgba(94,143,224,0.18)", grid: "rgba(255,255,255,0.08)", negSoft: "rgba(224,106,106,0.08)" },
};
const SENT_LABEL = { positive: "Positive", neutral: "Neutral", negative: "Negative", mixed: "Mixed" };
const SENT_ICON = { positive: ThumbsUp, negative: ThumbsDown, neutral: Minus, mixed: Shuffle };
const PARTS = ["positive", "neutral", "negative"];

// Flat cards — deliberately no backdrop-filter or big blurred shadows: they
// were the main cost when scrolling this page.
const CARD = "rounded-[20px] border border-black/[0.07] bg-[#fffdf9] shadow-[0_1px_2px_rgba(30,24,12,0.04),0_10px_24px_-18px_rgba(30,24,12,0.25)] dark:border-white/[0.08] dark:bg-[#14141b] dark:shadow-none";
const CARD_SOFT = "rounded-[16px] border border-black/[0.07] bg-[#fffdf9] dark:border-white/[0.08] dark:bg-[#14141b]";

function usePalette() {
  const { resolved } = useTheme();
  return SENT[resolved === "dark" ? "dark" : "light"];
}
const shortDate = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const plural = (n, w) => `${fmtNum(n)} ${w}${n === 1 ? "" : "s"}`;

/* ── Shared bits ─────────────────────────────────────────────────────── */

function Empty({ children }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-[20px] border border-dashed border-black/[0.16] px-6 py-10 text-center text-[13.5px] leading-relaxed text-black/50 dark:border-white/[0.14] dark:text-white/45">
      {children}
    </div>
  );
}

function Label({ children, className = "" }) {
  return <div className={`${MONO_LABEL} text-black/45 dark:text-white/40 ${className}`}>{children}</div>;
}

function CardTitle({ icon: Icon, children, aside, tone }) {
  const pal = usePalette();
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black/70 dark:bg-white/[0.07] dark:text-white/75"
        style={tone ? { color: pal[tone] } : undefined}>
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <span className="font-serif text-[22px] font-bold tracking-[-0.01em] text-[#171410] dark:text-white">{children}</span>
      {aside && <span className="ml-auto text-right">{aside}</span>}
    </div>
  );
}

function SentimentPill({ sentiment, small = false, label }) {
  const pal = usePalette();
  const Icon = SENT_ICON[sentiment] || Shuffle;
  const color = sentiment === "mixed" ? null : pal[sentiment];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.1] ${small ? "px-2 py-[2px] text-[10.5px]" : "px-2.5 py-[3px] text-[11px]"} font-semibold text-black/70 dark:border-white/[0.12] dark:text-white/70`}>
      <Icon size={small ? 11 : 12} strokeWidth={2.4} style={color ? { color } : undefined} />
      {label || SENT_LABEL[sentiment] || "Mixed"}
    </span>
  );
}

function Byline({ q, handle }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-black/45 dark:text-white/40">
      {q.user && <span className="font-medium text-black/60 dark:text-white/60">@{q.user}</span>}
      {q.likes > 0 && <span className="inline-flex items-center gap-1"><Heart size={11} strokeWidth={2.4} /> {fmtNum(q.likes)}</span>}
      {handle && <span>on @{String(handle).replace(/^@/, "")}'s post</span>}
      {q.postUrl && (
        <a href={q.postUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 hover:text-black/75 dark:hover:text-white/75">
          View post <ArrowUpRight size={11} />
        </a>
      )}
    </div>
  );
}

function QuoteLine({ q }) {
  if (!q) return null;
  return (
    <figure className="border-t border-black/[0.06] py-3 first:border-t-0 first:pt-0 dark:border-white/[0.07]">
      <blockquote className="text-[14px] leading-relaxed text-black/75 dark:text-white/75">“{q.text}”</blockquote>
      <Byline q={q} />
    </figure>
  );
}

/** Small floating tooltip for chart marks. */
function Tip({ x, children, below = false }) {
  return (
    <div className={`pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#171410] px-3 py-2 text-[11.5px] leading-snug text-white shadow-lg dark:bg-white dark:text-[#171410] ${below ? "top-full mt-2" : "-top-2 -translate-y-full"}`}
      style={{ left: `${Math.min(88, Math.max(12, x))}%` }}>
      {children}
    </div>
  );
}

/** Bar that grows in once when it first scrolls into view (transform only — cheap). */
function GrowBar({ value, color, className = "h-2", delay = 0, opacity = 1 }) {
  const pal = usePalette();
  return (
    <div className={`${className} w-full overflow-hidden rounded-full`} style={{ background: pal.track }}>
      <motion.div className="h-full origin-left rounded-full" style={{ background: color || pal.positive, width: `${Math.max(0, Math.min(100, value))}%`, opacity }}
        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay, ease: "easeOut" }} />
    </div>
  );
}

/* ── Charts ──────────────────────────────────────────────────────────── */

/** The whole split into positive / neutral / negative — tall segmented bar. */
function SentimentBar({ counts, pct }) {
  const pal = usePalette();
  const [hover, setHover] = useState(null);
  const total = PARTS.reduce((s, k) => s + (counts?.[k] || 0), 0);
  if (!total) return null;
  let left = 0;
  return (
    <div>
      <div className="relative">
        {hover && <Tip x={hover.mid} below><b>{SENT_LABEL[hover.key]}</b> · {fmtNum(counts[hover.key])} comments · {pct[hover.key]}%</Tip>}
        <div role="img" aria-label={`Comment sentiment: ${PARTS.map((k) => `${SENT_LABEL[k]} ${pct[k]}%`).join(", ")}`} className="flex h-7 w-full gap-[2px]">
          {PARTS.map((k) => {
            const share = (counts[k] || 0) / total;
            if (!share) return null;
            const at = left; left += share * 100;
            const ink = k === "neutral" ? "text-[#171410] dark:text-white/90" : "text-white";
            return (
              <button key={k} type="button"
                onMouseEnter={() => setHover({ key: k, mid: at + (share * 100) / 2 })} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ key: k, mid: at + (share * 100) / 2 })} onBlur={() => setHover(null)}
                aria-label={`${SENT_LABEL[k]}: ${counts[k]} comments, ${pct[k]}%`}
                className={`flex h-full items-center rounded-[4px] px-2 text-[12px] font-semibold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 ${ink}`}
                style={{ width: `${share * 100}%`, background: pal[k] }}>
                {share >= 0.09 ? `${Math.round(pct[k])}%` : ""}
              </button>
            );
          })}
        </div>
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const pal = usePalette();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-black/60 dark:text-white/55">
      {PARTS.map((k) => (
        <span key={k} className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: pal[k] }} />{SENT_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

/** Comments over time, stacked by sentiment — small column chart. */
function ConversationChart({ timeline, unit }) {
  const pal = usePalette();
  const [hover, setHover] = useState(null);
  const data = timeline || [];
  if (data.length < 2) {
    return <div className="flex h-[150px] items-center justify-center text-[12px] text-black/40 dark:text-white/35">Not enough days of comments to chart yet.</div>;
  }
  const H = 150;
  const max = Math.max(...data.map((d) => d.positive + d.neutral + d.negative), 1);
  const gap = data.length > 40 ? 1 : 2;
  const peak = data.reduce((b, d, i) => (d.positive + d.neutral + d.negative > (data[b].positive + data[b].neutral + data[b].negative) ? i : b), 0);
  return (
    <div>
      <div className="relative" style={{ height: H }}>
        {hover != null && (() => {
          const d = data[hover];
          return (
            <Tip x={((hover + 0.5) / data.length) * 100}>
              <div className="font-semibold">{unit === "week" ? `Week of ${shortDate(d.date)}` : shortDate(d.date)} · {d.positive + d.neutral + d.negative}</div>
              {PARTS.map((k) => <div key={k}>{SENT_LABEL[k]}: {d[k]}</div>)}
            </Tip>
          );
        })()}
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${f * 100}%`, borderColor: pal.grid }} />
        ))}
        <div className="absolute inset-0 flex items-end" style={{ gap }}>
          {data.map((d, i) => {
            const tot = d.positive + d.neutral + d.negative;
            const top = PARTS.filter((x) => d[x]).at(-1);
            return (
              <div key={d.date} className="relative flex h-full flex-1 cursor-default flex-col justify-end outline-none"
                tabIndex={0} aria-label={`${shortDate(d.date)}: ${d.positive} positive, ${d.neutral} neutral, ${d.negative} negative`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <div className="flex w-full flex-col-reverse gap-[2px]" style={{ height: `${(tot / max) * 100}%`, opacity: hover == null || hover === i ? 1 : 0.4, transition: "opacity .15s" }}>
                  {PARTS.map((k) => d[k] ? <div key={k} style={{ flexGrow: d[k], background: pal[k] }} className={k === top ? "rounded-t-[4px]" : ""} /> : null)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-black/40 dark:text-white/35">
        <span>{shortDate(data[0].date)}</span>
        <span>Busiest: {unit === "week" ? `week of ${shortDate(data[peak].date)}` : shortDate(data[peak].date)}</span>
        <span>{shortDate(data.at(-1).date)}</span>
      </div>
    </div>
  );
}

/** Tiny line + area, one hue, with a hover point. */
function Sparkline({ values }) {
  const pal = usePalette();
  const [hover, setHover] = useState(null);
  if (!values || values.length < 2) return <div className="h-10" />;
  const W = 200, H = 40, max = Math.max(...values.map((v) => v.y), 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - (v.y / max) * (H - 6)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  return (
    <div className="relative mt-3">
      {hover != null && <Tip x={(hover / (values.length - 1)) * 100}>{values[hover].label}: <b>{values[hover].y}</b></Tip>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 w-full overflow-visible"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1))); }}
        onMouseLeave={() => setHover(null)} role="img" aria-label="Comments over time">
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={pal.track} />
        <path d={line} fill="none" stroke={pal.positive} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4" fill={pal.positive} stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

function Tile({ label, icon: Icon, value, format, suffix = "", sub, children }) {
  return (
    <div className={`${CARD_SOFT} flex flex-col p-5`}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-black/[0.04] text-black/45 dark:bg-white/[0.06] dark:text-white/45"><Icon size={14} /></span>
      </div>
      <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em] text-[#171410] dark:text-white">
        <AnimatedNumber value={value} format={format || ((v) => fmtNum(Math.round(v)))} />{suffix}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-black/45 dark:text-white/40">{sub}</div>}
      <div className="mt-auto pt-3">{children}</div>
    </div>
  );
}

/* ── Topics: ranked bars + the selected topic's comments ─────────────── */

function Themes({ themes }) {
  const pal = usePalette();
  const [active, setActive] = useState(0);
  const max = Math.max(...themes.map((t) => t.count), 1);
  const cur = themes[Math.min(active, themes.length - 1)];
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]`}>
      <div className="p-6 sm:p-8">
        <CardTitle icon={MessagesSquare} aside={<span className="text-[12px] text-black/45 dark:text-white/40">hover or tap a topic</span>}>What people talk about</CardTitle>
        <ul className="space-y-1" role="listbox" aria-label="Topics">
          {themes.map((t, i) => {
            const on = i === active;
            return (
              <li key={t.name}>
                <button type="button" role="option" aria-selected={on} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${on ? "bg-black/[0.05] dark:bg-white/[0.07]" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[14px] ${on ? "font-semibold text-[#171410] dark:text-white" : "font-medium text-black/70 dark:text-white/70"}`}>{t.name}</span>
                    <SentimentPill sentiment={t.sentiment} small />
                    <span className="ml-auto text-[12px] tabular-nums text-black/50 dark:text-white/45">{fmtNum(t.count)}</span>
                  </div>
                  <div className="mt-2"><GrowBar value={(t.count / max) * 100} delay={i * 0.05} opacity={on ? 1 : 0.55} /></div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-black/[0.06] bg-black/[0.018] p-6 sm:p-8 lg:border-l lg:border-t-0 dark:border-white/[0.07] dark:bg-white/[0.02]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={cur.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <div className="flex items-start gap-3">
              <h4 className="font-serif text-[26px] italic leading-tight text-[#171410] dark:text-white">{cur.name}</h4>
              <span className="mt-1.5"><SentimentPill sentiment={cur.sentiment} /></span>
            </div>
            {cur.description && <p className="mt-2 text-[14px] leading-relaxed text-black/60 dark:text-white/60">{cur.description}</p>}
            <div className="mt-1 text-[11.5px] text-black/40 dark:text-white/35">
              {plural(cur.count, "comment")}{cur.posts > 1 ? ` across ${cur.posts} posts` : ""}
            </div>
            <div className="mt-5">{(cur.quotes || []).map((q, i) => <QuoteLine key={i} q={q} />)}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Buying signals: top 5, rotating cards ───────────────────────────── */
// Only positive or neutral buying comments ("where can I get this?", "just
// ordered mine") — price complaints are filtered out by the backend and show
// up under Concerns instead.

const TONE = {
  positive: { label: "Wants it", sentiment: "positive" },
  neutral: { label: "Asking", sentiment: "neutral" },
};

function BuyingCarousel({ quotes, pct, count }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = quotes.length;
  // Rotate only while it's actually on screen and not being read.
  useEffect(() => {
    if (reduced || paused || !inView || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 4500);
    return () => clearInterval(t);
  }, [reduced, paused, inView, n]);
  const go = (d) => setI((x) => (x + d + n) % n);
  return (
    <div ref={ref} className={`${CARD} relative flex h-full flex-col overflow-hidden p-6 sm:p-8`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
      <CardTitle icon={ShoppingBag} tone="positive"
        aside={<span className="text-[12px] text-black/45 dark:text-white/40">{plural(count, "comment")} · {pct}%</span>}>Buying signals</CardTitle>
      <p className="-mt-2 mb-5 text-[13px] text-black/50 dark:text-white/45">The most-liked comments from people who want it — asking where to get it, or saying they've ordered.</p>

      {/* the stack: the current card in front, the next two peeking behind */}
      <div className="relative h-[232px] sm:h-[212px]" aria-roledescription="carousel" aria-label="Buying-signal comments">
        {quotes.map((q, k) => {
          const pos = (k - i + n) % n; // 0 = front
          if (pos > 2) return null;
          const tone = TONE[q.tone] || TONE.neutral;
          return (
            <motion.figure key={k}
              aria-hidden={pos !== 0}
              initial={false}
              animate={{ y: pos * 12, scale: 1 - pos * 0.04, opacity: pos === 0 ? 1 : 0.6 - pos * 0.18 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
              className="absolute inset-x-0 top-0 flex h-[188px] flex-col rounded-[18px] border border-black/[0.08] bg-[#fffdf9] p-6 shadow-[0_10px_24px_-16px_rgba(30,24,12,0.35)] dark:border-white/[0.1] dark:bg-[#1a1a22] dark:shadow-none"
              style={{ transformOrigin: "50% 0%", zIndex: 10 - pos }}>
              <div className="flex items-center justify-between">
                <QuoteIcon size={22} className="shrink-0 text-black/15 dark:text-white/15" />
                <SentimentPill sentiment={tone.sentiment} label={tone.label} small />
              </div>
              <blockquote className="mt-2 line-clamp-3 flex-1 font-serif text-[21px] italic leading-snug text-[#171410] dark:text-white">{q.text}</blockquote>
              <Byline q={q} handle={q.handle} />
            </motion.figure>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous comment" className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.1] text-black/60 hover:bg-black/[0.04] dark:border-white/[0.12] dark:text-white/60 dark:hover:bg-white/[0.06]"><ChevronLeft size={15} /></button>
        <div className="flex gap-1.5">
          {quotes.map((_, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={`Comment ${k + 1}`}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-[#171410] dark:bg-white" : "w-1.5 bg-black/20 dark:bg-white/25"}`} />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next comment" className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.1] text-black/60 hover:bg-black/[0.04] dark:border-white/[0.12] dark:text-white/60 dark:hover:bg-white/[0.06]"><ChevronRight size={15} /></button>
        <span className="ml-auto text-[11px] tabular-nums text-black/40 dark:text-white/35">{i + 1} / {n}</span>
      </div>
    </div>
  );
}

/* ── Questions ───────────────────────────────────────────────────────── */

function Questions({ questions }) {
  const max = Math.max(...questions.map((q) => q.count), 1);
  // Few questions → show more real examples of each, so the card isn't half empty.
  const perQ = questions.length <= 1 ? 4 : questions.length <= 3 ? 2 : 1;
  return (
    <div className={`${CARD} h-full p-6 sm:p-8`}>
      <CardTitle icon={CircleHelp} aside={<span className="text-[12px] text-black/45 dark:text-white/40">{plural(questions.length, "question")}</span>}>Questions people ask</CardTitle>
      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={q.question} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
            <span className="font-mono text-[12px] font-semibold text-black/30 dark:text-white/30">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[15px] font-medium leading-snug text-[#171410] dark:text-white">{q.question}</span>
                <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-black/45 dark:text-white/40">asked {q.count}×</span>
              </div>
              <div className="mt-2" title={`Asked ${q.count} times`}><GrowBar className="h-1.5" value={(q.count / max) * 100} delay={i * 0.06} /></div>
              <div className="mt-1">
                {(q.quotes || []).slice(0, perQ).map((c, k) => (
                  <p key={k} className="mt-2 border-l-2 border-black/[0.08] pl-3 text-[13px] leading-relaxed text-black/55 dark:border-white/[0.1] dark:text-white/55">
                    “{c.text}” <span className="text-black/35 dark:text-white/30">— @{c.user}</span>
                  </p>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Concerns ────────────────────────────────────────────────────────── */

function NegativeWall({ comments, concerns, negativePct, negativeCount }) {
  const pal = usePalette();
  const [all, setAll] = useState(false);
  const shown = all ? comments : comments.slice(0, 4);
  return (
    <div className={`${CARD} p-6 sm:p-8`}>
      <CardTitle icon={ThumbsDown} tone="negative"
        aside={<span className="text-[12px] text-black/45 dark:text-white/40">{plural(negativeCount, "negative comment")} · {Math.round(negativePct)}%</span>}>
        Where it didn't land
      </CardTitle>
      {concerns?.length > 0 && (
        <div className="-mt-1 mb-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12px] text-black/45 dark:text-white/40">Main concerns:</span>
          {concerns.map((c) => (
            <span key={c} className="rounded-full border px-3 py-1 text-[12px] font-medium text-black/70 dark:text-white/70"
              style={{ borderColor: pal.negative, background: pal.negSoft }}>{c}</span>
          ))}
        </div>
      )}
      {comments.length === 0
        ? <p className="text-[13.5px] italic text-black/45 dark:text-white/40">No real negative comments came up — good news.</p>
        : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {shown.map((q, k) => (
              <figure key={`${q.postUrl}-${k}`}
                className="relative overflow-hidden rounded-[16px] border border-black/[0.07] p-5 pl-6 dark:border-white/[0.08]"
                style={{ background: pal.negSoft }}>
                <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-full" style={{ background: pal.negative }} />
                <blockquote className="text-[14px] leading-relaxed text-black/80 dark:text-white/80">“{q.text}”</blockquote>
                <Byline q={q} handle={q.handle} />
              </figure>
            ))}
          </div>
        )}
      {comments.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)}
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-black/[0.1] px-3.5 py-1.5 text-[12.5px] font-medium text-black/65 hover:bg-black/[0.03] dark:border-white/[0.12] dark:text-white/65 dark:hover:bg-white/[0.05]">
          {all ? "Show fewer" : `Show all ${comments.length}`}
          <ChevronDown size={13} className={all ? "rotate-180" : ""} />
        </button>
      )}
    </div>
  );
}

function ListCard({ icon: Icon, title, items, quotes, emptyText, tone }) {
  const hasAny = (items && items.length) || (quotes && quotes.length);
  return (
    <div className={`${CARD} flex h-full flex-col p-6 sm:p-8`}>
      <CardTitle icon={Icon} tone={tone}>{title}</CardTitle>
      {!hasAny && <p className="text-[13px] italic text-black/40 dark:text-white/35">{emptyText}</p>}
      {items?.length > 0 && (
        <ul className="mb-4 space-y-2">
          {items.map((t) => (
            <li key={t} className="flex gap-2.5 text-[14.5px] leading-relaxed text-black/75 dark:text-white/75">
              <span className="mt-[10px] size-1.5 shrink-0 rounded-full bg-black/30 dark:bg-white/30" />{t}
            </li>
          ))}
        </ul>
      )}
      {quotes?.length > 0 && <div className="mt-auto">{quotes.slice(0, 2).map((q, i) => <QuoteLine key={i} q={q} />)}</div>}
    </div>
  );
}

/* ── Post by post (also the charts' table view) ──────────────────────── */

function MiniBar({ counts }) {
  const pal = usePalette();
  const total = PARTS.reduce((s, k) => s + (counts?.[k] || 0), 0);
  if (!total) return <span className="text-[11px] text-black/35 dark:text-white/30">—</span>;
  const t = PARTS.map((k) => `${SENT_LABEL[k]} ${counts[k]}`).join(" · ");
  return (
    <div title={t} aria-label={t} role="img" className="flex h-2 w-full min-w-[90px] gap-[2px]">
      {PARTS.map((k) => (counts[k] ? <span key={k} className="h-full rounded-full" style={{ width: `${(counts[k] / total) * 100}%`, background: pal[k] }} /> : null))}
    </div>
  );
}

function PostTable({ posts: allPosts }) {
  const [campaign, setCampaign] = useState("all");
  const campaigns = useMemo(() => [...new Set(allPosts.map((p) => p.campaign).filter(Boolean))], [allPosts]);
  const posts = allPosts.filter((p) => campaign === "all" || p.campaign === campaign);
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-6 sm:px-8">
        <span className="font-serif text-[22px] font-bold text-[#171410] dark:text-white">Post by post</span>
        <span className="text-[12px] text-black/45 dark:text-white/40">{plural(posts.length, "post")}</span>
        {campaigns.length > 1 && (
          <div className="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Filter by campaign">
            {["all", ...campaigns].map((c) => (
              <button key={c} type="button" onClick={() => setCampaign(c)}
                className={`rounded-full border px-3 py-1 text-[11.5px] transition-colors ${campaign === c
                  ? "border-[#171410] bg-[#171410] text-white dark:border-white dark:bg-white dark:text-[#171410]"
                  : "border-black/[0.12] text-black/60 hover:text-black/85 dark:border-white/[0.14] dark:text-white/55 dark:hover:text-white"}`}>
                {c === "all" ? "All campaigns" : c}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* scrolls on its own (both ways on small screens); the header stays put */}
      <div className="av-scroll max-h-[400px] overflow-auto overscroll-contain border-t border-black/[0.07] dark:border-white/[0.08]">
        <table className="w-full min-w-[780px] text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#fbf8f1] dark:bg-[#181820]">
            <tr className="shadow-[inset_0_-1px_0_rgba(0,0,0,0.07)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]">
              {["Post", "Comments read", "Positive", "Neutral", "Negative", "Sentiment", "What people said"].map((h) => (
                <th key={h} className={`${MONO_LABEL} px-4 py-3 font-semibold text-black/40 first:pl-6 dark:text-white/35 sm:first:pl-8`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => {
              const poster = reelPosterUrl({ code: p.code, hasPoster: p.hasPoster, posterUpdatedAt: p.posterUpdatedAt });
              const c = p.counts || {};
              const n = (c.positive || 0) + (c.neutral || 0) + (c.negative || 0);
              const share = (k) => (n ? `${Math.round(((c[k] || 0) / n) * 100)}%` : "—");
              return (
                <tr key={p.postUrl} className="border-b border-black/[0.05] align-top transition-colors last:border-b-0 hover:bg-black/[0.02] dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
                  <td className="py-3.5 pl-6 pr-4 sm:pl-8">
                    <a href={p.postUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3">
                      <span className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-black/[0.06] dark:bg-white/[0.06]">
                        {poster && <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-black/80 dark:text-white/80">{p.handle ? `@${String(p.handle).replace(/^@/, "")}` : "Post"}</span>
                        <span className="block text-[11.5px] text-black/40 dark:text-white/35">{p.campaign || ""}{p.takenAt ? ` · ${prettyDate(p.takenAt)}` : ""}</span>
                      </span>
                    </a>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-black/70 dark:text-white/70">
                    {p.status === "ready" ? fmtNum(p.analysed) : "—"}
                    {p.totalComments != null && p.status === "ready" && p.totalComments > p.analysed ? <span className="text-black/35 dark:text-white/30"> of {fmtNum(p.totalComments)}</span> : null}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-black/70 dark:text-white/70">{share("positive")}</td>
                  <td className="px-4 py-3.5 tabular-nums text-black/70 dark:text-white/70">{share("neutral")}</td>
                  <td className="px-4 py-3.5 tabular-nums text-black/70 dark:text-white/70">{share("negative")}</td>
                  <td className="w-[150px] px-4 py-[22px]"><MiniBar counts={p.counts} /></td>
                  <td className="max-w-[340px] px-4 py-3.5 pr-6 text-black/60 dark:text-white/60">
                    {p.status === "ready" ? (p.summary || "—")
                      : p.status === "no-comments" ? <span className="italic text-black/40 dark:text-white/35">No comments yet</span>
                      : <span className="italic text-black/40 dark:text-white/35">Not read yet — included in the next update</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── The scroll box: sticky jump bar + progress, scroll tracked by refs ── */

const SCROLL_CSS = `
  .av-scroll { scrollbar-width: thin; scrollbar-color: rgba(23,20,16,0.22) transparent; }
  .av-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .av-scroll::-webkit-scrollbar-thumb { background: rgba(23,20,16,0.2); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
  [data-theme="dark"] .av-scroll { scrollbar-color: rgba(255,255,255,0.2) transparent; }
  [data-theme="dark"] .av-scroll::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.18); }
`;

function useBoxScroll(parts) {
  const scrollRef = useRef(null);
  const barRef = useRef(null);
  const fadeRef = useRef(null);
  const [active, setActive] = useState(parts[0]?.id);
  const raf = useRef(0);

  const measure = useCallback(() => {
    raf.current = 0;
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? el.scrollTop / max : 1;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    if (fadeRef.current) fadeRef.current.style.opacity = max - el.scrollTop > 24 ? "1" : "0";
    // the part whose top has passed the top of the box (last one at the very end)
    const top = el.getBoundingClientRect().top;
    let cur = parts[0]?.id;
    for (const s of parts) {
      const node = el.querySelector(`[data-av="${s.id}"]`);
      if (node && node.getBoundingClientRect().top - top <= 96) cur = s.id;
    }
    if (max - el.scrollTop < 4) cur = parts.at(-1)?.id;
    setActive(cur); // React skips the render when it hasn't changed
  }, [parts]);

  const onScroll = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(measure); }, [measure]);
  useEffect(() => { measure(); return () => cancelAnimationFrame(raf.current); }, [measure]);

  const jump = useCallback((id) => {
    const el = scrollRef.current;
    const node = el?.querySelector(`[data-av="${id}"]`);
    if (!el || !node) return;
    const y = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  }, []);

  return { scrollRef, barRef, fadeRef, active, onScroll, jump };
}

function JumpBar({ parts, active, onJump, barRef, updated }) {
  return (
    <div className="relative z-10 border-b border-black/[0.07] bg-[#f6f2e9] dark:border-white/[0.08] dark:bg-[#0f0f15]">
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
        <nav aria-label="Audience Voice parts" className="av-scroll -my-1 flex min-w-0 flex-1 gap-1 overflow-x-auto py-1">
          {parts.map((s) => {
            const on = s.id === active;
            return (
              <button key={s.id} type="button" onClick={() => onJump(s.id)} aria-current={on ? "true" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${on
                  ? "bg-[#171410] text-white dark:bg-white dark:text-[#171410]"
                  : "text-black/55 hover:bg-black/[0.05] hover:text-black/85 dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white"}`}>
                {s.label}
              </button>
            );
          })}
        </nav>
        {updated && <span className="hidden shrink-0 text-[11.5px] text-black/40 dark:text-white/35 md:block">Updated {updated}</span>}
      </div>
      {/* how far through the box you are */}
      <div aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[2px] overflow-hidden">
        <div ref={barRef} className="h-full origin-left bg-[#3d73c9] dark:bg-[#5e8fe0]" style={{ transform: "scaleX(0)" }} />
      </div>
    </div>
  );
}

/* ── The section ─────────────────────────────────────────────────────── */

export function AudienceVoiceSection() {
  const { data, error } = usePortalCommentInsights();
  const insight = data?.insight || null;
  const ready = !!(insight && insight.totals?.comments);

  const parts = useMemo(() => {
    if (!ready) return [];
    const list = [{ id: "overview", label: "Overview" }];
    if (insight.themes?.length) list.push({ id: "topics", label: "Topics" });
    if (insight.purchaseQuotes?.length || insight.questions?.length) list.push({ id: "buying", label: "Buying & questions" });
    list.push({ id: "concerns", label: "Concerns" }, { id: "love", label: "Love & ideas" }, { id: "posts", label: "Posts" });
    return list;
  }, [ready, insight]);
  const box = useBoxScroll(parts);

  if (error) return <Empty>Audience Voice couldn't load right now — try again shortly.</Empty>;
  if (data == null) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-h-[300px] animate-pulse rounded-[20px] bg-black/[0.045] lg:col-span-2 dark:bg-white/[0.04]" />
        <div className="min-h-[300px] animate-pulse rounded-[20px] bg-black/[0.045] dark:bg-white/[0.04]" />
      </div>
    );
  }
  if (!ready) {
    return (
      <Empty>
        {data.status === "running"
          ? "Your campaign comments are being read right now — check back in a few minutes."
          : insight && insight.totals?.posts
            ? "No comments to read on your campaign posts yet. Once people start commenting, what they say will be summarised here."
            : "Once your campaign posts are live, Fifth Avenue reads every comment on them and summarises what your audience is saying — right here. It updates every week."}
      </Empty>
    );
  }

  const t = insight.totals;
  const pct = insight.sentimentPct || {};
  const net = Math.round((pct.positive || 0) - (pct.negative || 0));
  const counts = { positive: t.positive, neutral: t.neutral, negative: t.negative };
  const timeline = insight.timeline || [];
  const spark = timeline.map((d) => ({ y: d.positive + d.neutral + d.negative, label: shortDate(d.date) }));
  const real = Math.max(1, t.comments - (t.spam || 0));
  const negatives = insight.negativeComments?.length ? insight.negativeComments : insight.topNegative || [];
  const buying = (insight.purchaseQuotes || []).filter((q) => q.tone !== "negative").slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#f6f2e9] dark:border-white/[0.08] dark:bg-[#0f0f15]">
      <style>{SCROLL_CSS}</style>
      <JumpBar parts={parts} active={box.active} onJump={box.jump} barRef={box.barRef} updated={data.generatedAt ? prettyDate(data.generatedAt) : null} />

      <div ref={box.scrollRef} onScroll={box.onScroll} tabIndex={0} aria-label="Audience Voice — scroll for more"
        className="av-scroll relative max-h-[max(440px,calc(100svh_-_260px))] sm:max-h-[max(560px,calc(100vh_-_190px))] space-y-5 overflow-y-auto p-3 outline-none sm:p-5">

        {/* Overview · pulse */}
        <div data-av="overview" className={`${CARD} relative overflow-hidden`}>
          <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 size-[380px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(94,143,224,0.16), transparent 62%)" }} />
          <div className="relative grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="flex flex-col">
              <Label>Audience pulse</Label>
              <h3 className="mt-3 font-serif text-[30px] italic leading-[1.12] tracking-[-0.01em] text-[#171410] dark:text-white sm:text-[38px]">
                {insight.headline || "What your audience is saying"}
              </h3>
              {insight.summary && <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-black/65 dark:text-white/65">{insight.summary}</p>}
              <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <div className="text-[52px] font-semibold leading-none tracking-[-0.03em] text-[#171410] dark:text-white">
                    {net > 0 ? "+" : ""}<AnimatedNumber value={net} format={(v) => String(Math.round(v))} />
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-black/50 dark:text-white/45">
                    <TrendingUp size={13} /> Net sentiment <span className="text-black/35 dark:text-white/30">(positive % − negative %)</span>
                  </div>
                </div>
                <div className="text-[13px] leading-relaxed text-black/55 dark:text-white/50">
                  <b className="font-semibold text-[#171410] dark:text-white">{Math.round(pct.positive || 0)}%</b> of {fmtNum(real)} comments were positive,
                  <br className="hidden sm:block" /> <b className="font-semibold text-[#171410] dark:text-white">{Math.round(pct.negative || 0)}%</b> negative.
                </div>
              </div>
              <div className="mt-6"><SentimentBar counts={counts} pct={pct} /></div>
            </div>
            <div className="flex flex-col rounded-[18px] border border-black/[0.06] bg-black/[0.015] p-5 dark:border-white/[0.07] dark:bg-white/[0.02]">
              <Label className="mb-8">Conversation over time</Label>
              <div className="mt-auto"><ConversationChart timeline={timeline} unit={insight.timelineUnit} /></div>
            </div>
          </div>
          <div className="relative border-t border-black/[0.06] px-6 py-3 text-[11.5px] text-black/40 dark:border-white/[0.07] dark:text-white/35 sm:px-8">
            Based on {plural(t.comments, "comment")} across {plural(t.analysedPosts, "post")}
            {t.spam ? ` · ${fmtNum(t.spam)} spam or bot comments left out` : ""}
            {insight.period ? ` · comments from ${prettyDate(insight.period.from)} to ${prettyDate(insight.period.to)}` : ""}
          </div>
        </div>

        {/* Overview · tiles with small charts */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Comments read" icon={MessagesSquare} value={t.comments} sub={`${t.analysedPosts} of ${plural(t.posts, "post")}`}>
            <Sparkline values={spark} />
          </Tile>
          <Tile label="Buying signals" icon={ShoppingBag} value={insight.purchaseIntentPct || 0} format={(v) => v.toFixed(1)} suffix="%"
            sub={`${plural(t.purchaseIntent, "comment")} asking where to buy, or saying they ordered`}>
            <GrowBar value={insight.purchaseIntentPct || 0} />
          </Tile>
          <Tile label="Questions asked" icon={CircleHelp} value={t.questions} sub={plural(insight.questions?.length || 0, "different question")}>
            <GrowBar value={(t.questions / real) * 100} />
          </Tile>
          <Tile label="Brand mentions" icon={Megaphone} value={t.brandMentions || 0} sub={`${((t.brandMentions || 0) / real * 100).toFixed(1)}% of comments name the brand or product`}>
            <GrowBar value={((t.brandMentions || 0) / real) * 100} />
          </Tile>
        </div>

        {insight.themes?.length > 0 && <div data-av="topics"><Themes themes={insight.themes} /></div>}

        {(buying.length > 0 || insight.questions?.length > 0) && (
          <div data-av="buying" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {buying.length > 0
              ? <BuyingCarousel quotes={buying} pct={insight.purchaseIntentPct || 0} count={t.purchaseIntent} />
              : <ListCard icon={ShoppingBag} title="Buying signals" emptyText="No one has asked where to buy yet." tone="positive" />}
            {insight.questions?.length > 0
              ? <Questions questions={insight.questions} />
              : <ListCard icon={CircleHelp} title="Questions people ask" emptyText="No questions came up." />}
          </div>
        )}

        <div data-av="concerns">
          <NegativeWall comments={negatives} concerns={insight.concerns} negativePct={pct.negative || 0} negativeCount={t.negative || 0} />
        </div>

        <div data-av="love" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ListCard icon={Sparkles} title="What they love" items={insight.praise} quotes={insight.topPositive} emptyText="Nothing stood out yet." tone="positive" />
          <ListCard icon={Lightbulb} title="Worth acting on" items={insight.recommendations} emptyText="No suggestions this time." />
        </div>

        <div data-av="posts"><PostTable posts={insight.posts || []} /></div>

        <p className="pb-1 text-center text-[11px] text-black/35 dark:text-white/30">
          Up to 100 comments per post are read. Quotes are real comments, unedited. Updated weekly.
        </p>
      </div>

      {/* "there's more below" — fades out at the end of the box */}
      <div ref={box.fadeRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center pb-2 transition-opacity duration-200"
        style={{ background: "linear-gradient(to top, var(--av-fade, rgba(246,242,233,0.95)), transparent)" }}>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#171410]/80 px-2.5 py-1 text-[10.5px] font-medium text-white dark:bg-white/85 dark:text-[#171410]">
          Scroll for more <ChevronDown size={12} />
        </span>
      </div>
      <style>{`[data-theme="dark"] { --av-fade: rgba(15,15,21,0.95); }`}</style>
    </motion.div>
  );
}
