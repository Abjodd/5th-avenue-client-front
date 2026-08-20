/**
 * 5th Avenue — Client Portal Login (single-panel redesign)
 * One continuous navy scene — no left/right split. The motion (blueprint
 * grid, drifting orbs, rising diamonds, cycling headline) sits behind a
 * single centered glass card that holds both the pitch and the sign-in
 * form. The "live campaign" stat strip lives inside the card itself, above
 * the fields, so there's one flow instead of two competing halves.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const C = {
  navyDark: "#03060F",
  navy: "#0A1638",
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

function mockLogin(email, password) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!email.includes("@")) {
        resolve({ ok: false, error: "Enter a valid email address." });
      } else if (password.length < 4) {
        resolve({ ok: false, error: "That password doesn't look right." });
      } else {
        resolve({ ok: true });
      }
    }, 850);
  });
}

function useRisingDiamonds(reduced) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      const id = Date.now() + Math.random();
      setItems((cur) => [
        ...cur,
        { id, x: 4 + Math.random() * 92, size: 5 + Math.random() * 6, dur: 6 + Math.random() * 3 },
      ]);
      setTimeout(() => setItems((cur) => cur.filter((it) => it.id !== id)), 9200);
    }, 550);
    return () => clearInterval(t);
  }, [reduced]);
  return items;
}

function Diamond({ size, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={style}>
      <polygon points="8,0 16,8 8,16 0,8" fill="none" stroke={C.blueSoft} strokeWidth="1.3" />
    </svg>
  );
}

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
  const diamonds = useRisingDiamonds(reduced);

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
      navigate("/portal/overview", { replace: true });
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
        background: `radial-gradient(120% 90% at 50% 0%, ${C.navy} 0%, ${C.navyDark} 68%)`,
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
        @keyframes fa-rise { 0% { opacity: 0; transform: translateY(0) rotate(0deg); } 10% { opacity: 0.85; } 90% { opacity: 0.85; } 100% { opacity: 0; transform: translateY(-540px) rotate(90deg); } }
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

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div className="fa-anim" style={{ position: "absolute", left: "-8%", top: "-14%", width: 420, height: 420, borderRadius: "50%", filter: "blur(100px)", background: `radial-gradient(circle, ${C.blue}, transparent 70%)`, opacity: 0.42, animation: reduced ? "none" : "fa-orb1 18s ease-in-out infinite" }} />
        <div className="fa-anim" style={{ position: "absolute", right: "-10%", bottom: "-16%", width: 460, height: 460, borderRadius: "50%", filter: "blur(110px)", background: `radial-gradient(circle, ${C.blue}, transparent 70%)`, opacity: 0.32, animation: reduced ? "none" : "fa-orb2 22s ease-in-out infinite" }} />
      </div>

      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {diamonds.map((d) => (
          <span key={d.id} style={{ position: "absolute", bottom: "-4%", left: `${d.x}%`, animation: `fa-rise ${d.dur}s linear forwards` }}>
            <Diamond size={d.size} />
          </span>
        ))}
      </div>

      <div className="fa-login-brand" onClick={() => navigate(-1)} style={{ position: "absolute", left: 32, top: 32, display: "inline-flex", alignItems: "center", gap: 12, cursor: "pointer", animation: reduced ? "none" : "fa-fadeup 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
        <svg width="32" height="32" viewBox="0 0 16 16" style={{ filter: `drop-shadow(0 0 4px ${C.blue}90)` }}>
          <polygon points="8,0 16,8 8,16 0,8" fill="none" stroke={C.blue} strokeWidth="1.4" />
        </svg>
        <span style={{ fontSize: 20, fontWeight: 300, textTransform: "uppercase", letterSpacing: "0.26em", color: C.white }}>Fifth Avenue</span>
      </div>

      <div className="fa-login-headline" style={{ position: "relative", marginTop: 18, textAlign: "center", animation: reduced ? "none" : "fa-fadeup 0.6s 0.05s cubic-bezier(0.16,1,0.3,1) both", maxWidth: 760 }}>
        <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 500, fontSize: "clamp(26px,3.6vw,34px)", lineHeight: 1.15, color: C.white }}>
          Every campaign, perfectly{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            <span key={word} className="fa-anim" style={{ display: "inline-block", background: `linear-gradient(90deg, ${C.blueSoft}, ${C.white})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: reduced ? "none" : "fa-wordin 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
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
          boxSizing: "border-box",
          borderRadius: 24, padding: 32, background: C.glass, backdropFilter: "blur(14px)",
          border: `1px solid ${err ? `${C.red}55` : C.onNavyLine}`,
          boxShadow: "0 40px 90px rgba(0,0,0,0.35)",
          animation: reduced ? "none" : "fa-fadeup 0.6s 0.12s cubic-bezier(0.16,1,0.3,1) both",
          transform: shake ? "translateX(0)" : undefined,
        }}
        className={shake ? "" : ""}
      >
        {success && (
          <>
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", border: `2px solid ${C.blue}`, animation: "fa-burst 0.8s ease-out forwards" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", border: `2px solid ${C.blueSoft}`, animation: "fa-burst 0.8s 0.12s ease-out forwards" }} />
          </>
        )}

        <h2 style={{ margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 600, fontSize: 24, lineHeight: 1.2, background: `linear-gradient(90deg, ${C.white}, ${C.blueSoft}, ${C.white})`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: reduced ? "none" : "fa-shimmer 5s linear infinite" }}>
          {success ? "Welcome back" : "Sign in"}
        </h2>
        <p style={{ margin: "6px 0 22px", fontSize: 12.5, color: C.onNavySub }}>
          Use the credentials issued to your brand by 5th Avenue.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onNavyMute }}>Email</label>
          <input
            type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            placeholder="you@yourbrand.com" autoComplete="username" className="fa-input"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.white, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${err ? C.red : C.onNavyLine}` }}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.onNavyMute }}>Password</label>
          <input
            type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }}
            placeholder="••••••••" autoComplete="current-password" className="fa-input"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, outline: "none", color: C.white, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${err ? C.red : C.onNavyLine}` }}
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
            fontSize: 13, fontWeight: 600, border: "none", cursor: disabled ? "not-allowed" : "pointer",
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
          Lost your credentials? Contact your 5th Avenue account manager.
        </p>
      </form>

      <div className="fa-login-footer" style={{ position: "relative", marginBottom: 24, fontSize: 11, color: C.onNavyMute, textAlign: "center" }}>© 5th Avenue Marketing</div>
    </div>
  );
}
