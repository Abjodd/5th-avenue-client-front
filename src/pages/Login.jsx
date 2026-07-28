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
import { useTheme } from "../context/ThemeContext";

/* Page wash behind the split scene. The login page used to pin itself to the
   light theme; it now follows the resolved theme like every other surface, so
   arriving here from a dark landing page doesn't flash white. */
const PAGE_WASH = {
  light: "linear-gradient(135deg,#E9F0FF 0%,#F1F7FF 38%,#EAF7EF 68%,#FFF3E6 100%)",
  dark:  "linear-gradient(135deg,#141726 0%,#12161F 38%,#111A18 68%,#1A1712 100%)",
};
/* Readability scrim over the collage, on the copy side. */
const COPY_SCRIM = {
  light: "linear-gradient(102deg, rgba(238,243,252,0.9) 0%, rgba(238,243,252,0.55) 26%, transparent 55%)",
  dark:  "linear-gradient(102deg, rgba(16,18,26,0.92) 0%, rgba(16,18,26,0.6) 26%, transparent 55%)",
};

/* ════════════════════════════════════════════════════════════════════════
   EDIT HERE — the creator posts in the login collage.

   Drop image files into  public/login-posts/  and point `image` at them, e.g.
   "/login-posts/anjali-salad.jpg". Paths are absolute from the site root, so
   they always start with a slash and no import is needed.

   · Any entry whose image is missing or fails to load falls back to the
     coloured gradient + emoji, so a wrong path never breaks the page.
   · Set `image: null` to use the gradient look deliberately.
   · Add or remove entries freely — they're dealt into the scrolling columns
     round-robin, and each column loops seamlessly however many it gets.
   · Portrait crops (9:13) look best; anything else is centre-cropped.
   ════════════════════════════════════════════════════════════════════════ */
const POSTS = [
  { handle: "@tastewithanjali", like: "128K", image: "/login-posts/01.jpg", hue: "blue",   emoji: "🥗" },
  { handle: "@breakfastclub",   like: "94K",  image: "/login-posts/02.jpg", hue: "orange", emoji: "🍳" },
  { handle: "@freshfuel",       like: "212K", image: "/login-posts/03.jpg", hue: "green",  emoji: "🥑" },
  { handle: "@reelsbykaya",     like: "76K",  image: "/login-posts/04.jpg", hue: "blue",   emoji: "🎬" },
  { handle: "@spicerouteco",    like: "154K", image: "/login-posts/05.jpg", hue: "orange", emoji: "🌶️" },
  { handle: "@morningpour",     like: "88K",  image: "/login-posts/06.jpg", hue: "green",  emoji: "☕" },
];

/* How fast each column scrolls, in seconds per full loop. One entry per
   column — the number of entries IS the number of columns. Alternating signs
   make neighbouring columns travel in opposite directions. */
const COLUMNS = [46, -38];

/* Fallback gradients, used when a post has no usable image. */
const HUES = {
  blue:   "linear-gradient(155deg,#6E8BE4,#3B54A6)",
  orange: "linear-gradient(155deg,#F5B36C,#E4863A)",
  green:  "linear-gradient(155deg,#6BC79A,#279E63)",
};
const CYCLE = ["watching.", "sharing.", "loving."];
const HEARTS = ["❤️"];

/** One post card. Shows the image when it loads; on a 404 or a null path it
    swaps to the gradient + emoji treatment so the column never shows a broken
    image icon. */
function PostCard({ post }) {
  const [failed, setFailed] = useState(false);
  const showImage = post.image && !failed;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-[20px] shadow-[0_20px_45px_rgba(25,22,17,0.18)] ring-1 ring-white/15 transition-transform duration-500 hover:scale-[1.03]"
      style={{ aspectRatio: "9 / 13", background: HUES[post.hue] }}
    >
      {showImage ? (
        <img
          src={post.image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center text-[44px]"
          style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.25))" }}
        >
          {post.emoji}
        </span>
      )}

      {/* top + bottom scrims so the handle and like count stay legible on any
          photo, however light or busy it is */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 28%, transparent 62%, rgba(0,0,0,0.5) 100%)" }}
      />

      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-2.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-white/90 text-[10px] shadow-sm">{post.emoji}</span>
        <span className="truncate text-[10px] font-semibold text-white drop-shadow-sm">{post.handle}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-2.5">
        <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          <span>❤</span> {post.like}
        </span>
      </div>
    </div>
  );
}

/** A column of posts scrolling forever. The list is rendered twice and the
    track travels exactly -50%, so the second copy lands where the first began
    and the loop is seamless. A negative `speed` scrolls the other way. */
function PostColumn({ posts, speed, parallaxX, parallaxY, depth }) {
  const x = useTransform(parallaxX, (v) => v * depth);
  const y = useTransform(parallaxY, (v) => v * depth);

  return (
    <motion.div className="relative w-[clamp(118px,12vw,158px)] flex-none overflow-hidden" style={{ x, y }}>
      <div
        className="login-marquee flex flex-col gap-5"
        style={{
          "--marquee-duration": `${Math.abs(speed)}s`,
          animationDirection: speed < 0 ? "reverse" : "normal",
        }}
      >
        {[...posts, ...posts].map((post, i) => (
          <PostCard key={`${post.handle}-${i}`} post={post} />
        ))}
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const { resolved } = useTheme();
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
    if (result.ok) navigate(location.state?.from?.pathname || "/portal/overview", { replace: true });
    else setErr(result.error);
  };

  const inputCls = "w-full rounded-[12px] border border-line bg-[--color-glass] px-3.5 py-3 text-[13.5px] text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-accent/50 focus:shadow-[0_0_0_4px_var(--accent-muted)] focus:bg-surface";
  const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute";

  return (
    <MotionConfig reducedMotion="user">
      <div ref={panelRef} onMouseMove={onMove}
        className="relative flex min-h-screen w-full overflow-hidden font-sans"
        style={{ background: PAGE_WASH[resolved] }}>

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
          {/* continuously scrolling collage of creator posts */}
          <div className="pointer-events-none absolute inset-0"
            style={{ maskImage: "radial-gradient(140% 100% at 65% 45%, #000 55%, transparent 92%)", WebkitMaskImage: "radial-gradient(140% 100% at 65% 45%, #000 55%, transparent 92%)" }}>
            {/* Kept to a band on the right of the panel so the wordmark and
                headline on the left stay clear. The track runs taller than the
                panel so posts are always entering and leaving, never flush. */}
            <div className="pointer-events-auto absolute right-0 flex gap-5 pr-10"
              style={{ top: "-12%", bottom: "-12%" }}>
              {COLUMNS.map((speed, col) => (
                <PostColumn
                  key={col}
                  speed={speed}
                  depth={1 + col * 0.6}
                  parallaxX={px}
                  parallaxY={py}
                  /* deal the posts out round-robin so neighbouring columns
                     never show the same image side by side */
                  posts={POSTS.filter((_, i) => i % COLUMNS.length === col)}
                />
              ))}
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
          <div className="pointer-events-none absolute inset-0" style={{ background: COPY_SCRIM[resolved] }} />

          {/* brand */}
          <motion.div className="relative" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="font-sans text-[18px] font-light uppercase tracking-[0.26em] text-accent">Fifth Avenue</div>
            <div className="mt-2 flex items-center gap-2 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-accent/55">
              <span className="h-px w-6 bg-accent/30" /> Client Portal
            </div>
          </motion.div>

          {/* headline */}
          <motion.div className="relative max-w-[340px]" initial="hide" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}>
            {[
              <div key="k" className="inline-flex items-center gap-1.5 rounded-full bg-surface/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent shadow-sm backdrop-blur-sm">
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
            className="relative w-full max-w-[380px] rounded-[28px] border border-line bg-[--color-glass] p-9 shadow-[0_30px_80px_rgba(25,22,17,0.12)] backdrop-blur-2xl"
          >
            <div className="mb-4 font-sans text-[15px] font-light uppercase tracking-[0.22em] text-accent md:hidden">Fifth Avenue</div>

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
