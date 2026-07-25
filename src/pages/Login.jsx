/**
 * 5th Avenue — Client Portal Login
 * Split page themed blue · light-orange · light-green throughout. Left is a
 * fluid, motion-driven scene: a floating collage of simple creator tiles with
 * cursor parallax, a cycling headline, and a live stream of rising hearts.
 * Right is the sign-in form — credentials live in the backend's BrandCredential
 * collection (see context/AuthContext); login scopes every page to clientName.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useSpring, useTransform, useReducedMotion, MotionConfig } from "motion/react";
import { useAuth } from "../context/AuthContext";

/* Simple creator tiles — a handle, a face, a like count. Nothing more. */
const HUES = {
  blue:   "linear-gradient(155deg,#6E8BE4,#3B54A6)",
  orange: "linear-gradient(155deg,#F5B36C,#E4863A)",
  green:  "linear-gradient(155deg,#6BC79A,#279E63)",
};
const TILES = [
  { hue: "blue",   handle: "@tastewithanjali", like: "128K", emoji: "🥗", x: "50%", y: "3%",  rot: -5, dur: 7.5, depth: 1.4 },
  { hue: "orange", handle: "@breakfastclub",   like: "94K",  emoji: "🍳", x: "12%", y: "26%", rot: 4,  dur: 9,   depth: 0.7 },
  { hue: "green",  handle: "@freshfuel",       like: "212K", emoji: "🥑", x: "56%", y: "48%", rot: 6,  dur: 6.8, depth: 1.8 },
  { hue: "blue",   handle: "@reelsbykaya",     like: "76K",  emoji: "🎬", x: "16%", y: "66%", rot: -6, dur: 8.4, depth: 1 },
];
const CYCLE = ["watching.", "sharing.", "loving."];
const HEARTS = ["❤️", "🧡", "💚", "💙"];

function Tile({ t, parallaxX, parallaxY, reduced }) {
  const x = useTransform(parallaxX, (v) => v * t.depth);
  const y = useTransform(parallaxY, (v) => v * t.depth);
  return (
    <motion.div
      className="absolute w-[clamp(120px,13vw,158px)]"
      style={{ left: t.x, top: t.y, x, y }}
      initial={{ opacity: 0, scale: 0.8, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 + TILES.indexOf(t) * 0.12 }}
    >
      <motion.div
        className="relative overflow-hidden rounded-[20px] shadow-[0_20px_45px_rgba(25,22,17,0.18)] ring-1 ring-white/40"
        style={{ aspectRatio: "9 / 13", background: HUES[t.hue], rotate: t.rot }}
        animate={reduced ? undefined : { y: [0, -14, 0] }}
        transition={reduced ? undefined : { duration: t.dur, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.06, rotate: 0, boxShadow: "0 30px 60px rgba(25,22,17,0.25)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(120% 70% at 25% 0%, rgba(255,255,255,0.55), transparent 55%)" }} />
        {/* handle */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-2.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-white/90 text-[10px] shadow-sm">{t.emoji}</span>
          <span className="truncate text-[10px] font-semibold text-white drop-shadow-sm">{t.handle}</span>
        </div>
        {/* face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[44px]" style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.25))" }}>{t.emoji}</span>
        </div>
        {/* like pill */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-2.5">
          <span className="flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <span>❤</span> {t.like}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [word, setWord] = useState(0);
  const [hearts, setHearts] = useState([]);
  const panelRef = useRef(null);

  /* cursor parallax (springy) */
  const px = useSpring(0, { stiffness: 55, damping: 16 });
  const py = useSpring(0, { stiffness: 55, damping: 16 });
  const onMove = (e) => {
    if (reduced) return;
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    px.set(((e.clientX - r.left) / r.width - 0.5) * -34);
    py.set(((e.clientY - r.top) / r.height - 0.5) * -26);
  };

  /* cycling headline word */
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setWord((w) => (w + 1) % CYCLE.length), 2200);
    return () => clearInterval(t);
  }, [reduced]);

  /* live stream of rising hearts (self-pruning) */
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      const id = Date.now() + Math.random();
      setHearts((h) => [...h, { id, x: 18 + Math.random() * 64, emoji: HEARTS[Math.floor(Math.random() * HEARTS.length)] }]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 3400);
    }, 750);
    return () => clearInterval(t);
  }, [reduced]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) navigate(location.state?.from?.pathname || "/overview", { replace: true });
    else setErr(result.error);
  };

  const inputCls = "w-full rounded-[12px] border border-[rgba(25,22,17,0.09)] bg-white/70 px-3.5 py-3 text-[13.5px] text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(44,62,126,0.1)] focus:bg-white";
  const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute";

  return (
    <MotionConfig reducedMotion="user">
      <div ref={panelRef} onMouseMove={onMove} data-theme="light"
        className="relative flex min-h-screen w-full overflow-hidden font-sans"
        style={{ background: "linear-gradient(135deg,#E9F0FF 0%,#F1F7FF 38%,#EAF7EF 68%,#FFF3E6 100%)" }}>

        {/* page-wide drifting colour blobs — blue · green · orange */}
        <div className="pointer-events-none absolute inset-0">
          {[
            { c: "#7FA0EC", cls: "left-[-8%] top-[-12%] size-[460px]", dur: 17, dx: 40, dy: -30 },
            { c: "#8BD9AC", cls: "bottom-[-14%] left-[26%] size-[420px]", dur: 21, dx: -34, dy: 26 },
            { c: "#F6C489", cls: "right-[8%] top-[24%] size-[380px]", dur: 24, dx: 30, dy: 34 },
          ].map((b, i) => (
            <motion.div key={i} className={`absolute rounded-full blur-[90px] opacity-50 ${b.cls}`}
              style={{ background: `radial-gradient(circle,${b.c},transparent 70%)` }}
              animate={reduced ? undefined : { x: [0, b.dx, 0], y: [0, b.dy, 0], scale: [1, 1.12, 1] }}
              transition={reduced ? undefined : { duration: b.dur, repeat: Infinity, ease: "easeInOut" }} />
          ))}
        </div>

        {/* ── LEFT — motion scene ── */}
        <div className="relative hidden w-[52%] min-w-[420px] flex-col justify-between p-12 md:flex">
          {/* floating tile collage */}
          <div className="pointer-events-none absolute inset-0"
            style={{ maskImage: "radial-gradient(140% 100% at 65% 45%, #000 55%, transparent 92%)", WebkitMaskImage: "radial-gradient(140% 100% at 65% 45%, #000 55%, transparent 92%)" }}>
            <div className="pointer-events-auto absolute inset-0">
              {TILES.map((t) => <Tile key={t.handle + t.y} t={t} parallaxX={px} parallaxY={py} reduced={reduced} />)}
            </div>
          </div>

          {/* rising hearts */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <AnimatePresence>
              {hearts.map((h) => (
                <motion.span key={h.id} className="absolute bottom-[16%] text-[18px]" style={{ left: `${h.x}%` }}
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.95, 0.95, 0], y: -190, scale: 1.1, x: [0, 10, -8, 0] }}
                  exit={{ opacity: 0 }} transition={{ duration: 3.3, ease: "easeOut" }}>
                  {h.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* readability scrim on the copy side */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(102deg, rgba(238,243,252,0.9) 0%, rgba(238,243,252,0.55) 26%, transparent 55%)" }} />

          {/* brand */}
          <motion.div className="relative" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="font-serif text-[26px] italic font-semibold tracking-[-0.02em] text-accent">5th Avenue</div>
            <div className="mt-2 flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-accent/55">
              <span className="h-px w-6 bg-accent/30" /> Client Portal
            </div>
          </motion.div>

          {/* headline */}
          <motion.div className="relative max-w-[340px]" initial="hide" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}>
            {[
              <div key="k" className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent shadow-sm backdrop-blur-sm">
                <motion.span className="size-1.5 rounded-full bg-green" animate={reduced ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={reduced ? undefined : { duration: 1.6, repeat: Infinity }} /> Live creator feed
              </div>,
              <h2 key="h" className="mt-3 font-serif text-[clamp(30px,3.6vw,40px)] italic font-medium leading-[1.14] text-ink">
                The content people<br />can't stop{" "}
                <span className="relative inline-block align-baseline">
                  <AnimatePresence mode="wait">
                    <motion.span key={word} className="inline-block bg-gradient-to-r from-accent via-teal to-green bg-clip-text text-transparent"
                      initial={{ y: "0.5em", opacity: 0, filter: "blur(4px)" }}
                      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                      exit={{ y: "-0.5em", opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                      {CYCLE[word]}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </h2>,
              <p key="p" className="mt-3 text-[12.5px] leading-relaxed text-sub">
                Track your creators, campaigns and reach — from brief to the reels your audience is loving right now.
              </p>,
            ].map((el, i) => (
              <motion.div key={i} variants={{ hide: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }}>
                {el}
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="relative text-[11px] text-mute" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            © 5th Avenue Marketing
          </motion.div>
        </div>

        {/* ── RIGHT — sign-in form (functionality unchanged) ── */}
        <div className="relative flex flex-1 items-center justify-center px-6">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[380px] rounded-[28px] border border-white/60 bg-white/70 p-9 shadow-[0_30px_80px_rgba(25,22,17,0.12)] backdrop-blur-2xl"
          >
            <div className="mb-4 font-serif text-[20px] italic font-semibold text-accent md:hidden">5th Avenue</div>

            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
              <motion.span className="size-1.5 rounded-full bg-accent" animate={reduced ? undefined : { opacity: [1, 0.4, 1] }} transition={reduced ? undefined : { duration: 1.8, repeat: Infinity }} />
              Secure sign in
            </div>
            <h1 className="mt-3 font-serif text-[30px] italic font-semibold leading-tight text-ink">Sign in</h1>
            <p className="mb-7 mt-1.5 text-[12.5px] text-sub">Use the credentials issued to your brand by 5th Avenue.</p>

            <div className="mb-4">
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@yourbrand.com" autoComplete="username" className={inputCls} />
            </div>
            <div className="mb-5">
              <label className={labelCls}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" className={inputCls} />
            </div>

            <AnimatePresence>
              {err && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mb-4 flex items-center gap-2 overflow-hidden rounded-[12px] border border-red/20 bg-red/[0.05] px-3.5 py-2.5 text-[12px] font-medium text-red">
                  <span className="text-[13px]">⚠</span>{err}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading || !email || !password}
              className={`group relative w-full overflow-hidden rounded-full py-3 text-[13px] font-semibold transition-all duration-[250ms] ease-out ${
                loading || !email || !password
                  ? "cursor-not-allowed bg-well text-mute"
                  : "bg-accent text-white shadow-[0_10px_28px_rgba(44,62,126,0.35)] hover:-translate-y-px hover:shadow-[0_16px_36px_rgba(44,62,126,0.45)] active:translate-y-0"
              }`}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {loading ? "Signing in…" : "Sign in"}
              </span>
              {!loading && email && password && (
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              )}
            </button>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-mute">
              Lost your credentials? Contact your 5th Avenue account manager.
            </p>
          </motion.form>
        </div>
      </div>
    </MotionConfig>
  );
}
