import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Play,
  Layers,
  Heart,
  Camera,
  Image as ImageIcon,
  Film,
  type LucideIcon,
} from "lucide-react";
import { gsap, ScrollTrigger, useGSAP } from "../../motion/gsap";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { Icon } from "../../components/primitives/Icon";
import { FALogo } from "../../components/primitives/FALogo";
import { cx } from "../../lib/cx";
import { CrayonCursor } from "./creatives/CrayonCursor";
import { JoinBox } from "./creatives/JoinBox";
import { ComingSoonOverlay } from "./ComingSoonOverlay";

/* ──────────────────────────────────────────────────────────────────────────
   Seeded helpers — deterministic so the paint flood is identical every mount.
   ──────────────────────────────────────────────────────────────────────── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Organic closed blob path (Catmull-Rom through jittered radial points). */
function blobPath(cx0: number, cy0: number, r: number, rng: () => number, pts = 11, jitter = 0.42) {
  const P: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (1 - jitter + rng() * jitter * 2);
    P.push([cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr]);
  }
  const n = P.length;
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

/* ══════════════════════════════════════════════════════════════════════════
   1 — CREATIVE hero, the balloon film rebuilt in code. Three beats, exactly
   like the rendered video: the thin wordmark inflates into glossy pink
   balloon letters (variable weight + fat round stroke + specular gloss),
   wobbles as it fills, then POPS — droplets scatter and a pink paint flood
   swallows the screen. The inflate is scrubbed; the pop itself is a
   time-based timeline fired when scroll crosses the threshold, so the burst
   is always snappy (and un-pops if you scroll back).
   ══════════════════════════════════════════════════════════════════════════ */
const BUBBLE_PINK = "#f2a9cf";
const BUBBLE_DEEP = "#e08fc0";
const BUBBLE_DARK = "#cf7cab"; // darker rim pink (knots)
const BUBBLE_LIGHT = "#f9d2e5";

const LETTERS = "CREATIVE".split("");
const POP_AT = 0.7;

const FLOOD = (() => {
  const rng = mulberry32(41);
  return {
    base: blobPath(500, 500, 430, rng, 14, 0.16),
    dark: blobPath(525, 565, 295, rng, 12, 0.3),
    light: blobPath(430, 400, 175, rng, 10, 0.34),
  };
})();

const DROPS = (() => {
  const rng = mulberry32(97);
  return Array.from({ length: 16 }, () => ({
    x: 500 + (rng() - 0.5) * 520,
    y: 500 + (rng() - 0.5) * 240,
    r: 5 + rng() * 13,
    dx: (rng() - 0.5) * 780,
    dy: (rng() - 0.5) * 680 - 130,
  }));
})();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function CreativeHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<SVGGElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current, stage = stageRef.current;
      if (!section || !stage) return;
      const positions = Array.from(stage.querySelectorAll<SVGGElement>(".fa-pos"));
      const pops = Array.from(stage.querySelectorAll<SVGGElement>(".fa-pop"));
      const thins = Array.from(stage.querySelectorAll<SVGTextElement>(".fa-lthin"));
      const bodies = Array.from(stage.querySelectorAll<SVGTextElement>(".fa-lbody"));
      const shades = Array.from(stage.querySelectorAll<SVGTextElement>(".fa-lsh"));
      const knots = Array.from(stage.querySelectorAll<SVGPathElement>(".fa-knot"));
      const flood = section.querySelector<SVGGElement>(".fa-flood");
      const drops = Array.from(section.querySelectorAll<SVGCircleElement>(".fa-drop"));
      if (!flood || positions.length !== LETTERS.length) return;

      gsap.set(flood, { svgOrigin: "500 500", scale: 0.0001 });

      // canvas measures per-weight advances so tracking animates with the
      // variable weight and letters never drift apart or collide
      const jellies = Array.from(stage.querySelectorAll<SVGGElement>(".fa-jelly"));

      const mctx = document.createElement("canvas").getContext("2d");
      const advances = (wght: number) => {
        if (mctx) mctx.font = `${Math.round(wght)} 160px "Jost Variable", "Century Gothic", sans-serif`;
        return LETTERS.map((ch) => {
          const w = mctx ? mctx.measureText(ch).width : 0;
          return w > 4 ? w : 99;
        });
      };

      let curInflate = 0; // read by the jelly ticker
      const apply = (p: number) => {
        const inflate = clamp01((p - 0.12) / 0.5);
        curInflate = inflate;
        const wght = 220 + 680 * clamp01(p / 0.55);
        const gap = 12 - 16 * clamp01(p / 0.6); // ends at −4: balloons kiss
        const fatN = 22 * inflate;
        const fat = fatN.toFixed(1);
        const advs = advances(wght);
        // the round stroke fattens each glyph, so it joins the layout
        const step = advs.map((a) => a + fatN * 0.55);
        const total = step.reduce((a, b) => a + b, 0) + gap * (LETTERS.length - 1);
        const thinOp = (1 - clamp01((p - 0.05) / 0.24)).toFixed(2);
        const bodyOp = clamp01((p - 0.14) / 0.3);
        const knotOp = clamp01((inflate - 0.55) * 2.4).toFixed(2);
        const fvs = `'wght' ${Math.round(wght)}`;

        let x = 500 - total / 2;
        for (let i = 0; i < LETTERS.length; i++) {
          const cx = x + step[i] / 2;
          x += step[i] + gap;
          positions[i].setAttribute("transform", `translate(${cx.toFixed(1)} 165)`);
          thins[i].style.fontVariationSettings = fvs;
          thins[i].setAttribute("opacity", thinOp);
          for (const el of [bodies[i], shades[i]]) {
            el.style.fontVariationSettings = fvs;
            el.setAttribute("stroke-width", fat);
          }
          bodies[i].setAttribute("opacity", bodyOp.toFixed(2));
          shades[i].setAttribute("opacity", (bodyOp * 0.75).toFixed(2));
          knots[i].setAttribute("opacity", knotOp);
        }
        stage.style.transform = `scale(${(1 + 0.08 * inflate).toFixed(3)}) rotate(${(-5 * clamp01(p / 0.7)).toFixed(2)}deg)`;
        if (cueRef.current) cueRef.current.style.opacity = Math.max(0, 1 - p * 14).toFixed(2);
      };

      if (prefersReducedMotion()) {
        // static, mid-inflate artwork — no pin, no pop
        apply(0.62);
        document.fonts?.ready.then(() => apply(0.62));
        return;
      }

      apply(0);
      // re-layout once the display font has actually loaded
      document.fonts?.ready.then(() => apply(0));

      // balloons never sit still — a time-based jelly wobble, scaled by how
      // inflated the word currently is, keeps them alive between scrolls
      let jellyIdle = true;
      const tick = () => {
        const a = curInflate;
        if (a < 0.01) {
          if (!jellyIdle) {
            jellyIdle = true;
            for (const j of jellies) j.removeAttribute("transform");
          }
          return;
        }
        jellyIdle = false;
        const t = gsap.ticker.time;
        for (let i = 0; i < jellies.length; i++) {
          const sx = 1 + 0.045 * a * Math.sin(t * 3.1 + i * 1.3);
          const sy = 1 - 0.045 * a * Math.sin(t * 3.1 + i * 1.3);
          const rot = 2.2 * a * Math.sin(t * 1.6 + i * 0.95);
          const dy = 4.5 * a * Math.sin(t * 2.2 + i * 1.15);
          jellies[i].setAttribute(
            "transform",
            `translate(0 ${dy.toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`,
          );
        }
      };
      gsap.ticker.add(tick);

      // the POP — balloons burst, droplets scatter, paint floods the screen
      const popTl = gsap.timeline({ paused: true });
      popTl
        .to(pops, {
          scale: 1.32,
          opacity: 0,
          duration: 0.16,
          ease: "power2.in",
          transformOrigin: "center",
          stagger: { each: 0.022, from: "center" },
        }, 0)
        .fromTo(drops, { x: 0, y: 0, scale: 1, opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.004 }, 0.05)
        .to(drops, {
          x: (i: number) => DROPS[i].dx,
          y: (i: number) => DROPS[i].dy,
          scale: 0.35,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.004,
        }, 0.08)
        .to(drops, { opacity: 0, duration: 0.3, stagger: 0.004 }, 0.5)
        .fromTo(flood, { svgOrigin: "500 500", scale: 0.001 }, { scale: 3.6, duration: 0.75, ease: "power3.out" }, 0.1);

      let popped = false;
      const prox = { t: 0 };
      gsap.to(prox, {
        t: 1,
        ease: "none",
        onUpdate: () => {
          apply(prox.t);
          if (prox.t >= POP_AT && !popped) {
            popped = true;
            popTl.timeScale(1).play();
          } else if (prox.t < POP_AT - 0.02 && popped) {
            popped = false;
            popTl.timeScale(1.6).reverse();
          }
        },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=250%",
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
        },
      });

      return () => gsap.ticker.remove(tick);
    },
    { scope: sectionRef },
  );

  const textProps = {
    x: 0,
    y: 0,
    textAnchor: "middle" as const,
    dominantBaseline: "central" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    paintOrder: "stroke" as const,
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "160px",
      fontVariationSettings: "'wght' 220",
    } as CSSProperties,
  };

  return (
    <section ref={sectionRef} className="relative flex min-h-[100svh] items-center overflow-hidden">
      <div className="relative mx-auto w-full max-w-[1400px] px-6">
        <p className="mb-6 text-center font-mono text-eyebrow uppercase tracking-[0.24em] text-ink-3">
          Fifth Avenue — Creative Studio
        </p>
        <svg viewBox="0 0 1000 320" className="w-full overflow-visible" role="img" aria-label="Creative">
          <defs>
            <linearGradient id="fa-creative-grad" x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0" stopColor="var(--viz-pink)" />
              <stop offset="0.35" stopColor="var(--viz-orange)" />
              <stop offset="0.68" stopColor="var(--viz-amber)" />
              <stop offset="1" stopColor="var(--viz-purple)" />
            </linearGradient>
            {/* balloon skin fill — lit top-left, deepening toward the edge */}
            <radialGradient id="fa-balloon-skin" cx="0.38" cy="0.28" r="0.9">
              <stop offset="0" stopColor="#fbc9e0" />
              <stop offset="0.5" stopColor={BUBBLE_PINK} />
              <stop offset="1" stopColor="#dd8bba" />
            </radialGradient>
            {/* balloon volume — broad sheen + hot highlight + bottom bounce
                light + edge darkening (alpha minus eroded core = curvature) */}
            <filter id="fa-balloon" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
              <feSpecularLighting in="blur" surfaceScale="9" specularConstant="0.5" specularExponent="9" lightingColor="#ffdcee" result="sheen">
                <feDistantLight azimuth="235" elevation="42" />
              </feSpecularLighting>
              <feSpecularLighting in="blur" surfaceScale="9" specularConstant="1" specularExponent="60" lightingColor="#ffffff" result="hot">
                <feDistantLight azimuth="235" elevation="48" />
              </feSpecularLighting>
              <feSpecularLighting in="blur" surfaceScale="9" specularConstant="0.32" specularExponent="13" lightingColor="#ff9ed0" result="rim">
                <feDistantLight azimuth="55" elevation="28" />
              </feSpecularLighting>
              <feComposite in="sheen" in2="SourceAlpha" operator="in" result="sheenIn" />
              <feComposite in="hot" in2="SourceAlpha" operator="in" result="hotIn" />
              <feComposite in="rim" in2="SourceAlpha" operator="in" result="rimIn" />
              <feMorphology in="SourceAlpha" operator="erode" radius="7" result="core" />
              <feGaussianBlur in="core" stdDeviation="8" result="coreBlur" />
              <feFlood floodColor="#b95f95" floodOpacity="0.5" result="darkPink" />
              <feComposite in="darkPink" in2="SourceAlpha" operator="in" result="darkAll" />
              <feComposite in="darkAll" in2="coreBlur" operator="out" result="edgeShade" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="edgeShade" />
                <feMergeNode in="sheenIn" />
                <feMergeNode in="rimIn" />
                <feMergeNode in="hotIn" />
              </feMerge>
            </filter>
          </defs>
          <g ref={stageRef} style={{ transformOrigin: "center", transformBox: "fill-box" } as CSSProperties}>
            {LETTERS.map((ch, i) => (
              <g key={i} className="fa-pos">
                <g className="fa-pop" style={{ filter: "drop-shadow(0 16px 16px rgba(5,3,13,0.38))" }}>
                  {/* jelly layer — continuous time-based squash & wobble */}
                  <g className="fa-jelly">
                    {/* darker under-shading, offset like the film's soft rim */}
                    <text {...textProps} x={6} y={9} className="fa-lsh" fill={BUBBLE_DEEP} stroke={BUBBLE_DEEP} strokeWidth="0" opacity="0">
                      {ch}
                    </text>
                    {/* the balloon body — fat round stroke kills the straight lines */}
                    <text {...textProps} className="fa-lbody" fill="url(#fa-balloon-skin)" stroke="url(#fa-balloon-skin)" strokeWidth="0" opacity="0" filter="url(#fa-balloon)">
                      {ch}
                    </text>
                    {/* balloon knot under every other letter */}
                    <path className="fa-knot" d="M-7 82 Q0 97 7 82 Q0 89 -7 82" fill={BUBBLE_DARK} opacity="0" visibility={i % 2 ? "visible" : "hidden"} />
                    {/* the thin wordmark it starts as */}
                    <text {...textProps} className="fa-lthin" fill="url(#fa-creative-grad)">
                      {ch}
                    </text>
                  </g>
                </g>
              </g>
            ))}
          </g>
        </svg>
        <div ref={cueRef} className="mt-12 flex justify-center">
          <span className="fa-scroll-cue flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ink-3">
            <Icon icon={ArrowRight} size={16} className="rotate-90" />
          </span>
        </div>
      </div>

      {/* the paint flood + droplets — fullscreen, unleashed by the pop */}
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {/* hidden via gsap.set (transform ATTRIBUTE) — an inline CSS transform
            here would override gsap's SVG attribute writes and pin it shut */}
        <g className="fa-flood">
          <path d={FLOOD.base} fill={BUBBLE_PINK} />
          <path d={FLOOD.dark} fill={BUBBLE_DEEP} opacity={0.55} />
          <path d={FLOOD.light} fill={BUBBLE_LIGHT} opacity={0.5} />
        </g>
        <g>
          {DROPS.map((d, i) => (
            <circle key={i} className="fa-drop" cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? BUBBLE_PINK : BUBBLE_DEEP} opacity="0" />
          ))}
        </g>
      </svg>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2 — Spiral gallery. Three counter-rotating rings of posts/reels, tops
   facing the centre, orbiting the V/A logo — the door to the portfolio.
   The outermost ring bleeds past the viewport (desktop) and a nudot-style
   vignette melts the edges into the page background.
   ══════════════════════════════════════════════════════════════════════════ */
interface SpinCard {
  format: string;
  metric: string;
  grad: [string, string];
  glyph: LucideIcon;
}
const SPIN_CARDS: SpinCard[] = [
  { format: "Reel", metric: "2.4M", grad: ["var(--viz-purple)", "var(--viz-blue)"], glyph: Play },
  { format: "Post", metric: "8.1% ER", grad: ["var(--viz-orange)", "var(--viz-pink)"], glyph: ImageIcon },
  { format: "Story", metric: "640K", grad: ["var(--viz-teal)", "var(--viz-green)"], glyph: Camera },
  { format: "Short", metric: "1.9M", grad: ["var(--viz-pink)", "var(--viz-purple)"], glyph: Film },
  { format: "Carousel", metric: "12 slides", grad: ["var(--viz-amber)", "var(--viz-orange)"], glyph: Layers },
  { format: "Reel", metric: "3.3M", grad: ["var(--viz-blue)", "var(--viz-teal)"], glyph: Play },
  { format: "Post", metric: "9.4% ER", grad: ["var(--viz-green)", "var(--viz-teal)"], glyph: Heart },
  { format: "Story", metric: "410K", grad: ["var(--viz-purple)", "var(--viz-pink)"], glyph: Camera },
  { format: "Short", metric: "5.6M", grad: ["var(--viz-orange)", "var(--viz-amber)"], glyph: Film },
  { format: "Reel", metric: "1.2M", grad: ["var(--viz-pink)", "var(--viz-orange)"], glyph: Play },
  { format: "Carousel", metric: "7 slides", grad: ["var(--viz-teal)", "var(--viz-blue)"], glyph: Layers },
  { format: "Post", metric: "6.8% ER", grad: ["var(--viz-blue)", "var(--viz-purple)"], glyph: ImageIcon },
  { format: "Short", metric: "980K", grad: ["var(--viz-amber)", "var(--viz-pink)"], glyph: Film },
  { format: "Story", metric: "1.1M", grad: ["var(--viz-green)", "var(--viz-amber)"], glyph: Camera },
];
/** Third ring — bleeds past the section edge on desktop. */
const BLEED_CARDS: SpinCard[] = [
  { format: "Reel", metric: "4.7M", grad: ["var(--viz-teal)", "var(--viz-purple)"], glyph: Play },
  { format: "Post", metric: "7.2% ER", grad: ["var(--viz-pink)", "var(--viz-amber)"], glyph: ImageIcon },
  { format: "Short", metric: "2.8M", grad: ["var(--viz-purple)", "var(--viz-orange)"], glyph: Film },
  { format: "Story", metric: "890K", grad: ["var(--viz-blue)", "var(--viz-green)"], glyph: Camera },
  { format: "Carousel", metric: "9 slides", grad: ["var(--viz-orange)", "var(--viz-teal)"], glyph: Layers },
  { format: "Reel", metric: "6.1M", grad: ["var(--viz-amber)", "var(--viz-purple)"], glyph: Play },
  { format: "Post", metric: "11.3% ER", grad: ["var(--viz-green)", "var(--viz-pink)"], glyph: Heart },
  { format: "Short", metric: "1.5M", grad: ["var(--viz-pink)", "var(--viz-blue)"], glyph: Film },
  { format: "Story", metric: "720K", grad: ["var(--viz-teal)", "var(--viz-amber)"], glyph: Camera },
  { format: "Reel", metric: "3.9M", grad: ["var(--viz-orange)", "var(--viz-purple)"], glyph: Play },
];

function OrbitCard({ card, size }: { card: SpinCard; size: number }) {
  return (
    <div
      className="group/card relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 shadow-lg transition-transform duration-300 hover:z-20 hover:scale-[1.14]"
      style={{ width: size, height: size * 1.4, background: `linear-gradient(150deg, ${card.grad[0]}, ${card.grad[1]})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white backdrop-blur-sm">
        {card.format}
      </span>
      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-transform duration-300 group-hover/card:scale-110">
        <Icon icon={card.glyph} size={12} />
      </span>
      <span className="tnum absolute bottom-2.5 left-2.5 text-caption font-medium text-white">{card.metric}</span>
    </div>
  );
}

function SpiralGallery({ onLogo }: { onLogo: () => void }) {
  const reduce = prefersReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const outer = SPIN_CARDS.slice(0, 9);
  const inner = SPIN_CARDS.slice(9);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const bleedSize = Math.max(56, Math.round(w * 0.15));
  const outerSize = Math.max(48, Math.round(w * 0.125));
  const innerSize = Math.max(40, Math.round(w * 0.098));
  const logoSize = Math.min(150, Math.max(88, Math.round(w * 0.17)));

  // tops face the centre: rotate each card to its position angle − 90°
  const ringCards = (cards: SpinCard[], radius: number, size: number) =>
    cards.map((card, i) => {
      const a = (i / cards.length) * Math.PI * 2;
      const left = 50 + Math.cos(a) * radius;
      const top = 50 + Math.sin(a) * radius;
      const deg = (a * 180) / Math.PI - 90;
      return (
        <div
          key={i}
          className="absolute"
          style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%,-50%) rotate(${deg.toFixed(1)}deg)` }}
        >
          <OrbitCard card={card} size={size} />
        </div>
      );
    });

  return (
    <section className="relative overflow-hidden px-6 py-20 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <div ref={boxRef} className="relative mx-auto aspect-square w-full max-w-[880px]">
          {/* bleed ring — desktop only, spills past the section edge */}
          <div
            className={cx("absolute -inset-[16%] hidden lg:block", !reduce && "fa-spin")}
            style={{ ["--spin-dur" as string]: "96s" } as CSSProperties}
          >
            {ringCards(BLEED_CARDS, 47, bleedSize)}
          </div>
          {/* outer ring */}
          <div className={cx("absolute inset-0", !reduce && "fa-spin")} style={{ ["--spin-dur" as string]: "64s" } as CSSProperties}>
            {ringCards(outer, 46, outerSize)}
          </div>
          {/* inner ring — opposite direction */}
          <div className={cx("absolute inset-[21%]", !reduce && "fa-spin-rev")} style={{ ["--spin-dur" as string]: "46s" } as CSSProperties}>
            {ringCards(inner, 41, innerSize)}
          </div>

          {/* the logo — door to the portfolio */}
          <button
            onClick={onLogo}
            aria-label="Open the portfolio"
            title="Portfolio"
            className="group absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <FALogo
              aria-hidden
              className={cx(
                "fa-logo-shadow relative text-ink transition-transform duration-300 group-hover:scale-110",
                !reduce && "fa-bob",
              )}
              style={{ width: logoSize, height: logoSize }}
            />
          </button>
        </div>
      </div>

      {/* nudot-style vignette — the rings melt into the page background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse 46% 46% at 50% 50%, transparent 42%, var(--bg) 96%)" }}
      />
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page — video hero → spiral (logo = portfolio door) → jack-in-the-box CTA
   when the reader hits the end.
   ══════════════════════════════════════════════════════════════════════════ */
export default function CreativesPage() {
  const navigate = useNavigate();
  const [boxOpen, setBoxOpen] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sentinelRef.current) return;
    // the footer sits below this sentinel, so "top bottom" would fire while
    // the spiral is still centre-screen — wait until the sentinel climbs
    // well into the viewport, i.e. the reader has really finished the page
    const st = ScrollTrigger.create({
      trigger: sentinelRef.current,
      start: "top 45%",
      once: true,
      onEnter: () => setBoxOpen(true),
    });
    return () => st.kill();
  });

  return (
    <div className="fa-crayon">
      <CrayonCursor />
      <CreativeHero />
      <SpiralGallery onLogo={() => navigate("/portfolio")} />
      <div ref={sentinelRef} className="h-px" aria-hidden />
      {/* once the coming-soon blur is up, don't let the Join takeover cover it */}
      <JoinBox open={boxOpen && !blurred} onClose={() => setBoxOpen(false)} />
      <ComingSoonOverlay
        title="Creatives"
        tagline="Our creative studio is being polished."
        onShow={() => setBlurred(true)}
      />
    </div>
  );
}
