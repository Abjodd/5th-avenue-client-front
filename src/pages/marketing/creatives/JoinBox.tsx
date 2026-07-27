import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { gsap, useGSAP } from "../../../motion/gsap";
import { prefersReducedMotion } from "../../../motion/reducedMotion";
import { Icon } from "../../../components/primitives/Icon";

/* ══════════════════════════════════════════════════════════════════════════
   JoinBox — the finale. A sharp-cornered cube with a "video" playing on every
   face drops in, bounces, spins continuously (nudot-style), bursts confetti,
   and the CTA springs out of the top like a jack-in-the-box.

   3D gotcha: GSAP recomposes an element's whole transform, so the static
   rotateX pose lives on its own preserve-3d wrapper — 2D tweens touch only
   the outer drop element, the continuous spin only the cube.
   ══════════════════════════════════════════════════════════════════════════ */
const CUBE = 190;
const HALF = CUBE / 2;
const DROP_TOP = 150; // px from container top to cube top
const TEXT_RISE = DROP_TOP + HALF; // text starts buried at cube centre

const FACES: { label: string; grad: [string, string]; place: string }[] = [
  { label: "REEL 01", grad: ["var(--viz-pink)", "var(--viz-purple)"], place: `translateZ(${HALF}px)` },
  { label: "REEL 02", grad: ["var(--viz-orange)", "var(--viz-pink)"], place: `rotateY(90deg) translateZ(${HALF}px)` },
  { label: "REEL 03", grad: ["var(--viz-teal)", "var(--viz-blue)"], place: `rotateY(180deg) translateZ(${HALF}px)` },
  { label: "REEL 04", grad: ["var(--viz-amber)", "var(--viz-orange)"], place: `rotateY(-90deg) translateZ(${HALF}px)` },
  { label: "TOP", grad: ["var(--viz-purple)", "var(--viz-blue)"], place: `rotateX(90deg) translateZ(${HALF}px)` },
  { label: "BASE", grad: ["var(--viz-green)", "var(--viz-teal)"], place: `rotateX(-90deg) translateZ(${HALF}px)` },
];

const CONF_COLORS = [
  "var(--viz-pink)",
  "var(--viz-orange)",
  "var(--viz-purple)",
  "var(--viz-teal)",
  "var(--viz-amber)",
  "var(--viz-blue)",
  "var(--viz-green)",
];
const CONFETTI = Array.from({ length: 42 }, (_, i) => i);

export function JoinBox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // scroll lock + Esc while open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useGSAP(
    () => {
      if (!open || !wrapRef.current) return;
      const q = gsap.utils.selector(wrapRef);
      const drop = q(".jb-drop")[0];
      const cube = q(".jb-cube")[0];
      const text = q(".jb-text")[0];
      const pieces = q(".jb-piece");

      if (prefersReducedMotion()) {
        gsap.set(q(".jb-backdrop"), { opacity: 1 });
        gsap.set(text, { y: 0, scale: 1, opacity: 1 });
        return;
      }

      // continuous nudot-style spin — never touched by the timeline
      gsap.to(cube, { rotationY: "+=360", duration: 14, ease: "none", repeat: -1 });

      const impact = 1.35; // bounce.out's first landing within the 0.9s drop
      const tl = gsap.timeline();
      tl.fromTo(q(".jb-backdrop"), { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0)
        .fromTo(q(".jb-close"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.25)
        .fromTo(
          drop,
          { y: -window.innerHeight * 0.75, opacity: 1 },
          { y: 0, duration: 0.95, ease: "bounce.out" },
          0.9,
        )
        .fromTo(
          text,
          { y: TEXT_RISE, scale: 0.18, opacity: 0, rotation: -9 },
          { y: 0, scale: 1, opacity: 1, duration: 1.15, ease: "elastic.out(1, 0.4)" },
          impact + 0.2,
        )
        .to(text, { rotation: 0, duration: 1.4, ease: "elastic.out(1, 0.22)" }, impact + 0.35);

      // confetti burst at the moment of impact
      pieces.forEach((el) => {
        const dx = gsap.utils.random(-250, 250);
        const up = gsap.utils.random(70, 300);
        const fall = gsap.utils.random(200, 400);
        const rot = gsap.utils.random(-540, 540);
        gsap
          .timeline({ delay: impact + gsap.utils.random(0, 0.1) })
          .set(el, { opacity: 1, x: 0, y: 0, rotation: 0 })
          .to(el, { x: dx, y: -up, rotation: rot * 0.5, duration: 0.5, ease: "power2.out" })
          .to(el, { x: dx * 1.25, y: fall, rotation: rot, duration: 0.9, ease: "power1.in" }, ">")
          .to(el, { opacity: 0, duration: 0.35 }, "<0.55");
      });
    },
    { dependencies: [open], scope: wrapRef },
  );

  if (!open) return null;

  return (
    <div ref={wrapRef} className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Join Fifth Avenue">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="jb-backdrop absolute inset-0 cursor-default bg-black/70 opacity-0 backdrop-blur-sm"
      />
      <button
        ref={closeRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="jb-close absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/85 opacity-0 transition-colors hover:bg-white/10"
      >
        <Icon icon={X} size={18} />
      </button>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: 380, height: DROP_TOP + CUBE + 130 }}>
          {/* jack-in-the-box CTA — sits BEFORE the cube in the DOM so it rises
              from behind it, springing out of the lid */}
          <button
            type="button"
            onClick={() => {
              document.body.style.overflow = "";
              navigate("/start");
            }}
            className="jb-text pointer-events-auto absolute left-0 right-0 top-6 mx-auto w-max font-display uppercase leading-none opacity-0 transition-transform duration-200 hover:scale-105"
            style={{
              fontVariationSettings: "'wght' 800",
              fontSize: "clamp(30px, 5vw, 54px)",
              color: "#f2a9cf",
              WebkitTextStroke: "2px #1b1420",
              letterSpacing: "0.01em",
              textShadow: "0.05em 0.065em 0 rgba(20,16,26,0.9)",
            }}
          >
            Join us Now!
          </button>

          {/* dropping wrapper — 2D tweens only */}
          <div
            className="jb-drop absolute left-0 right-0 mx-auto w-max"
            style={{ top: DROP_TOP, perspective: "900px" }}
          >
            {/* static 3D pose — never tweened */}
            <div style={{ transformStyle: "preserve-3d", transform: "rotateX(-14deg)" }}>
              <div className="jb-cube relative" style={{ width: CUBE, height: CUBE, transformStyle: "preserve-3d" }}>
                {FACES.map((f) => (
                  <div
                    key={f.label}
                    className="fa-video-face absolute inset-0 flex items-center justify-center border border-white/15"
                    style={{
                      transform: f.place,
                      backfaceVisibility: "hidden",
                      background: `linear-gradient(135deg, ${f.grad[0]}, ${f.grad[1]})`,
                      backgroundSize: "220% 220%",
                    }}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm">
                      <Icon icon={Play} size={16} />
                    </span>
                    <span className="absolute left-2.5 top-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/90">
                      {f.label}
                    </span>
                    <span className="fa-video-bar absolute bottom-0 left-0 h-[3px] bg-white/85" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* confetti origin — the cube's centre */}
          <div className="absolute left-1/2 top-0" style={{ transform: `translateY(${DROP_TOP + HALF}px)` }}>
            {CONFETTI.map((i) => (
              <span
                key={i}
                className="jb-piece absolute block opacity-0"
                style={{ width: 7, height: 11, background: CONF_COLORS[i % CONF_COLORS.length] }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
