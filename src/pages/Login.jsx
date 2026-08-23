/**
 * 5th Avenue — Client Portal Login (single-panel redesign)
 * One continuous navy scene — no left/right split. The motion (blueprint
 * grid, drifting orbs, cycling headline) sits behind a single centered
 * glass card that holds both the pitch and the sign-in form. The stat
 * strip lives inside the card itself, above the fields, so there's one
 * flow instead of two competing halves.
 *
 * Brand mark: swap FAVICON_SRC below for the actual file in /public
 * (e.g. "/favicon.svg", "/favicon.png", "/logo.svg") if it isn't
 * literally "/favicon.ico".
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FAVICON_SRC = "/favicon.svg";

// One typeface for the whole scene — the wordmark up top, the headline,
// and the card title all read as one voice instead of a sans/serif mix.
const FONT_BRAND = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif";

const C = {
  navyDark: "#03060F",
  navy: "#0A1638",
  navyDeep: "#050B1E",
  blue: "#3E7BFF",
  blueSoft: "#8FB2FF",
  white: "#FFFFFF",
  onNavySub: "rgba(255,255,255,0.68)",
  onNavyMute: "rgba(255,255,255,0.48)",
  onNavyLine: "rgba(255,255,255,0.14)",
  glass: "rgba(255,255,255,0.06)",
  glassStrong: "rgba(255,255,255,0.09)",
  red: "#FF6B6B",
};

const CYCLE = ["tracked.", "organized.", "on time."];

export default function FifthAvenueLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [word, setWord] = useState(0);
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);

  const sceneRef = useRef(null);

  const onMove = (e) => {
    if (reduced) return;
    const r = sceneRef.current?.getBoundingClientRect();
    if (!r) return;
    setMx(((e.clientX - r.left) / r.width - 0.5) * -24);
    setMy(((e.clientY - r.top) / r.height - 0.5) * -16);
  };

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setWord((w) => (w + 1) % CYCLE.length), 2200);
    return () => clearInterval(t);
  }, [reduced]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || success) return;
    setErr("");
    setLoading(true);
    const result = await login(email, password);
    if (result.ok) {
      setLoading(false);
      // First sign-in ever → Profile, so the brand sees and corrects the
      // account we hold for them. Every sign-in after → the dashboard, where
      // the brand-story intro plays. `firstLogin` comes from the server, not
      // this browser: a local flag would fire again on every new device.
      // `replace` so Back leaves the portal instead of bouncing through login.
      navigate(result.user?.firstLogin ? "/portal/profile" : "/portal/overview", { replace: true });
    } else {
      setLoading(false);
      setErr(result.error);
      setShake(true);
      setTimeout(() => setShake(false), 480);
    }
  };

  const disabled = loading || success || !email || !password;

  return (
    <div
      ref={sceneRef}
      onMouseMove={onMove}
      style={{
        position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, boxSizing: "border-box", padding: "24px 16px",
        fontFamily: FONT_BRAND,
        // Layered instead of one flat radial: a deep base, a warmer glow
        // rising from the horizon, and a faint top vignette so the card
        // sits in a scene with depth rather than a single color wash.
        background: `
          radial-gradient(60% 40% at 50% 0%, rgba(62,123,255,0.16), transparent 70%),
          radial-gradient(120% 90% at 50% 100%, ${C.navy} 0%, ${C.navyDeep} 55%, ${C.navyDark} 100%)
        `,
        borderRadius: "20px",
      }}
    >
      <style>{`
        @keyframes fa-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes fa-griddrift { from { transform: translate(0,0); } to { transform: translate(-64px,-64px); } }
        @keyframes fa-shine { 0% { transform: translateX(-130%) skewX(-20deg); } 100% { transform: translateX(230%) skewX(-20deg); } }
        @keyframes fa-burst { 0% { transform: scale(0.5); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes fa-orb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.08); } }
        @keyframes fa-orb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-26px,24px) scale(1.08); } }
        @keyframes fa-aurora { 0%,100% { transform: translateX(-4%) rotate(0deg); opacity: 0.5; } 50% { transform: translateX(4%) rotate(1.5deg); opacity: 0.85; } }
        @keyframes fa-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } }
        @keyframes fa-fadeup { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fa-wordin { from { opacity: 0; transform: translateY(0.5em); filter: blur(4px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes fa-spin { to { transform: rotate(360deg); } }
        .fa-shine-btn { position: absolute; top: 0; left: 0; width: 40%; height: 100%; background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent); animation: fa-shine 2.6s ease-in-out infinite; pointer-events: none; }
        .fa-input { transition: all 0.2s; }
        .fa-input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 4px ${C.blue}33 !important; background: rgba(255,255,255,0.08) !important; }
        .fa-input::placeholder { color: rgba(255,255,255,0.32); }
        @media (max-width: 640px) {
          .fa-login-brand { left: 16px !important; top: 16px !important; gap: 10px !important; }
          .fa-login-brand span { font-size: 14px !important; letter-spacing: 0.18em !important; }
          .fa-login-headline { margin-top: 48px !important; padding: 0 8px; }
          .fa-login-card { width: 100% !important; max-width: 100% !important; padding: 22px 18px !important; border-radius: 20px !important; }
          .fa-login-footer { margin-bottom: 8px !important; }
        }
        @media (prefers-reduced-motion: reduce) { .fa-anim { animation: none !important; } }
      `}</style>

      {/* Blueprint grid — slow drift, parallaxes very slightly with the cursor */}
      <svg
        style={{
          position: "absolute", inset: "-64px", opacity: 0.12, pointerEvents: "none",
          transform: `translate(${mx * 0.4}px, ${my * 0.4}px)`, transition: "transform 0.3s ease-out",
        }}
        width="120%" height="120%"
      >
        <defs>
          <pattern id="fa-grid2" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M46 0H0V46" fill="none" stroke={C.blueSoft} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fa-grid2)" className="fa-anim" style={{ animation: reduced ? "none" : "fa-griddrift 14s linear infinite" }} />
      </svg>

      {/* Ambient depth — two soft orbs plus a faint aurora sweep behind the
          card. Replaces the rising-diamond field: same navy/blue theme,
          but nothing pops into the foreground or competes with the form. */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="fa-anim" style={{ position: "absolute", left: "-8%", top: "-14%", width: 420, height: 420, borderRadius: "50%", filter: "blur(100px)", background: `radial-gradient(circle, ${C.blue}, transparent 70%)`, opacity: 0.38, animation: reduced ? "none" : "fa-orb1 18s ease-in-out infinite" }} />
        <div className="fa-anim" style={{ position: "absolute", right: "-10%", bottom: "-16%", width: 460, height: 460, borderRadius: "50%", filter: "blur(110px)", background: `radial-gradient(circle, ${C.blue}, transparent 70%)`, opacity: 0.28, animation: reduced ? "none" : "fa-orb2 22s ease-in-out infinite" }} />
        <div
          className="fa-anim"
          style={{
            position: "absolute", left: "50%", top: "-20%", width: "140%", height: 360,
            transform: "translateX(-50%)",
            background: `linear-gradient(90deg, transparent, ${C.blueSoft}22, transparent)`,
            filter: "blur(60px)",
            animation: reduced ? "none" : "fa-aurora 12s ease-in-out infinite",
          }}
        />
      </div>

      <div
        className="fa-login-brand"
        onClick={() => navigate(-1)}
        style={{ position: "absolute", left: 32, top: 32, display: "inline-flex", alignItems: "center", gap: 12, cursor: "pointer", animation: reduced ? "none" : "fa-fadeup 0.5s cubic-bezier(0.16,1,0.3,1)" }}
      >
        <img
          src={FAVICON_SRC}
          alt="Fifth Avenue"
          width={28}
          height={28}
          style={{ display: "block", filter: `drop-shadow(0 0 6px ${C.blue}90)` }}
        />
        <span style={{ fontFamily: FONT_BRAND, fontSize: 20, fontWeight: 300, textTransform: "uppercase", letterSpacing: "0.26em", color: C.white }}>
          Fifth Avenue
        </span>
      </div>

      <div className="fa-login-headline" style={{ position: "relative", marginTop: 18, textAlign: "center", animation: reduced ? "none" : "fa-fadeup 0.6s 0.05s cubic-bezier(0.16,1,0.3,1) both", maxWidth: 760 }}>
        <h1 style={{ margin: "12px 0 0", fontFamily: FONT_BRAND, fontWeight: 300, fontSize: "clamp(24px,3.4vw,32px)", lineHeight: 1.2, letterSpacing: "0.01em", color: C.white }}>
          Every campaign, perfectly{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            <span
              key={word}
              className="fa-anim"
              style={{
                display: "inline-block", fontWeight: 600,
                background: `linear-gradient(90deg, ${C.blueSoft}, ${C.white})`,
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                animation: reduced ? "none" : "fa-wordin 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {CYCLE[word]}
            </span>
          </span>
        </h1>
      </div>

      <form
        className="fa-login-card"
        onSubmit={handleSubmit}
        style={{
          position: "relative", marginTop: 32, marginBottom: 20, width: "min(100%, 400px)", maxWidth: 400,
          boxSizing: "border-box", fontFamily: FONT_BRAND,
          borderRadius: 24, padding: 32, background: C.glass, backdropFilter: "blur(14px)",
          border: `1px solid ${err ? `${C.red}55` : C.onNavyLine}`,
          boxShadow: "0 40px 90px rgba(0,0,0,0.35)",
          animation: reduced ? "none" : "fa-fadeup 0.6s 0.12s cubic-bezier(0.16,1,0.3,1) both",
          transform: shake ? "translateX(0)" : undefined,
        }}
      >
        {success && (
          <>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", border: `2px solid ${C.blue}`, animation: "fa-burst 0.8s ease-out forwards" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", border: `2px solid ${C.blueSoft}`, animation: "fa-burst 0.8s 0.12s ease-out forwards" }} />
          </>
        )}

        <h2 style={{ margin: 0, fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 22, lineHeight: 1.2, background: `linear-gradient(90deg, ${C.white}, ${C.blueSoft}, ${C.white})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: reduced ? "none" : "fa-shimmer 5s linear infinite" }}>
          {success ? "Welcome back" : "Sign in"}
        </h2>
        <p style={{ margin: "6px 0 22px", fontSize: 12.5, color: C.onNavySub }}>
          Use the credentials issued to your brand by Fifth Avenue.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onNavyMute }}>Email</label>
          <input
            type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            placeholder="you@yourbrand.com" autoComplete="username" className="fa-input"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.white, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${err ? C.red : C.onNavyLine}`, fontFamily: FONT_BRAND }}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onNavyMute }}>Password</label>
          <input
            type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }}
            placeholder="••••••••" autoComplete="current-password" className="fa-input"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.white, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${err ? C.red : C.onNavyLine}`, fontFamily: FONT_BRAND }}
          />
        </div>

        {err && (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "10px 14px", fontSize: 12, fontWeight: 500, border: `1px solid ${C.red}55`, background: `${C.red}1A`, color: "#FFB4B4" }}>
            <span style={{ fontSize: 13 }}>⚠</span>{err}
          </div>
        )}

        <button
          type="submit" disabled={disabled}
          style={{
            position: "relative", width: "100%", overflow: "hidden", borderRadius: 999, padding: "13px 0",
            fontSize: 13, fontWeight: 600, fontFamily: FONT_BRAND, border: "none", cursor: disabled ? "not-allowed" : "pointer",
            background: loading || !email || !password ? "rgba(255,255,255,0.1)" : `linear-gradient(120deg, ${C.blue}, ${C.blueSoft})`,
            color: loading || !email || !password ? C.onNavyMute : C.white,
            boxShadow: loading || !email || !password ? "none" : `0 14px 30px ${C.blue}55`,
            transition: "all 0.25s ease-out",
          }}
        >
          <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <span className="fa-anim" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "fa-spin 0.8s linear infinite" }} />}
            {success ? "Welcome" : loading ? "Signing in…" : "Sign in"}
          </span>
          {!loading && !success && email && password && <span className="fa-shine-btn" />}
        </button>

        <p style={{ marginTop: 18, textAlign: "center", fontSize: 11, lineHeight: 1.6, color: C.onNavyMute }}>
          Lost your credentials? Contact your Fifth Avenue account manager.
        </p>
      </form>

      <div className="fa-login-footer" style={{ position: "relative", marginBottom: 24, fontSize: 11, color: C.onNavyMute, textAlign: "center", fontFamily: FONT_BRAND }}>© Fifth Avenue Marketing</div>
    </div>
  );
}