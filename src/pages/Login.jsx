/**
 * 5th Avenue — Client Portal Login
 * Mirrors 5th-internal-front/src/pages/Login: left brand panel, right form.
 * Credentials are issued per brand representative and live in the backend's
 * BrandCredential collection (see context/AuthContext) — the login scopes
 * every page to that user's clientName.
 */
import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Demo logins for quick access — fake data, seeded via 5th-internal-back's
// founder-only Auth page (BrandCredential). Display only; the real
// credential check happens against the backend, not this list.
// const DEMO_LOGINS = [
//   { clientName: "FreshBite Foods", email: "rahul@freshbitefoods.com", password: "freshbite123" },
// ];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 50 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      navigate(location.state?.from?.pathname || "/overview", { replace: true });
    } else {
      setErr(result.error);
    }
  };

  const handlePanelMove = (e) => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const inputCls = "w-full rounded-[12px] border border-[rgba(15,23,42,0.09)] bg-white/70 px-3.5 py-3 text-[13.5px] text-ink outline-none backdrop-blur-sm transition-all duration-200 focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(37,99,235,0.1)] focus:bg-white";
  const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-mute";

  return (
    <div className="flex min-h-screen w-full bg-[#F7F8FA] font-sans">
      <style>{`
        @keyframes meshDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,-8%) scale(1.15); } }
        @keyframes meshDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-8%,6%) scale(1.1); } }
        @keyframes meshDrift3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(4%,10%) scale(0.9); } }
        @keyframes orbFloat { 0%,100% { transform: translateY(0) translateX(0) rotate(0deg); } 33% { transform: translateY(-22px) translateX(14px) rotate(4deg); } 66% { transform: translateY(14px) translateX(-10px) rotate(-3deg); } }
        @keyframes shimmerLine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes riseIn { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
        @keyframes wordmarkGlow { 0%,100% { text-shadow: 0 0 22px rgba(255,255,255,0.35); } 50% { text-shadow: 0 0 40px rgba(255,255,255,0.6); } }
      `}</style>

      {/* ── LEFT BRAND PANEL — animated gradient mesh + cursor spotlight ── */}
      <div
        ref={panelRef}
        onMouseMove={handlePanelMove}
        className="relative hidden w-[44%] min-w-[360px] flex-col justify-between overflow-hidden p-14 md:flex"
        style={{ background: "linear-gradient(160deg, #0F172A 0%, #14204A 45%, #182B63 100%)" }}
      >
        {/* drifting mesh blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-15%] size-[480px] rounded-full opacity-40 blur-[90px]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)", animation: "meshDrift1 16s ease-in-out infinite" }} />
          <div className="absolute bottom-[-15%] right-[-10%] size-[440px] rounded-full opacity-35 blur-[100px]" style={{ background: "radial-gradient(circle, #7860D6, transparent 70%)", animation: "meshDrift2 20s ease-in-out infinite" }} />
          <div className="absolute left-[30%] top-[40%] size-[360px] rounded-full opacity-25 blur-[100px]" style={{ background: "radial-gradient(circle, #1E9E5A, transparent 70%)", animation: "meshDrift3 22s ease-in-out infinite" }} />
        </div>

        {/* cursor-follow spotlight */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70 transition-[background] duration-200"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.08), transparent 65%)` }}
        />

        {/* fine noise / grain texture, near-invisible */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        {/* floating orbit rings */}
        <div className="pointer-events-none absolute -right-[130px] -top-[130px] size-[420px] rounded-full border border-white/[0.08]" style={{ animation: "orbFloat 24s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -left-24 bottom-16 size-[280px] rounded-full border border-white/[0.06]" style={{ animation: "orbFloat 19s ease-in-out infinite reverse" }} />
        <div className="pointer-events-none absolute right-[18%] top-[55%] size-[120px] rounded-full border border-white/[0.1]" style={{ animation: "orbFloat 13s ease-in-out infinite" }} />

        <div className="relative" style={{ animation: "riseIn 0.7s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div className="font-serif text-[26px] italic font-semibold tracking-[-0.02em] text-white" style={{ animation: "wordmarkGlow 5s ease-in-out infinite" }}>
            5th Avenue
          </div>
          <div className="mt-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.2em] text-white/45">
            <span className="h-px w-6 bg-white/30" />
            Client Portal
          </div>
        </div>

        <div className="relative font-serif text-[40px] italic font-medium leading-[1.18] text-white" style={{ animation: "riseIn 0.8s 0.15s cubic-bezier(0.16,1,0.3,1) both" }}>
          Your campaigns,<br />
          <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">your creators,</span><br />
          in one place.
        </div>

        <div className="relative flex items-center gap-3 text-[11px] text-white/40" style={{ animation: "riseIn 0.8s 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
          <span
            className="h-px w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent bg-[length:200%_100%]"
            style={{ animation: "shimmerLine 3.5s linear infinite" }}
          />
          © 5th Avenue Marketing
        </div>
      </div>

      {/* ── RIGHT FORM ── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6">
        {/* ambient soft glow behind the form on light side */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute right-[10%] top-[12%] size-[380px] rounded-full opacity-[0.12] blur-[110px]" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)", animation: "meshDrift1 18s ease-in-out infinite" }} />
          <div className="absolute bottom-[8%] left-[8%] size-[320px] rounded-full opacity-[0.09] blur-[100px]" style={{ background: "radial-gradient(circle, #A8519E, transparent 70%)", animation: "meshDrift2 22s ease-in-out infinite" }} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-[380px] rounded-[28px] border border-[rgba(15,23,42,0.06)] bg-white/70 p-9 shadow-[0_30px_80px_rgba(15,23,42,0.1)] backdrop-blur-2xl"
          style={{ animation: "riseIn 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-accent/15 bg-accent/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" style={{ animation: "wordmarkGlow 2s ease-in-out infinite" }} />
            Secure sign in
          </div>
          <h1 className="mt-3 font-serif text-[30px] italic font-semibold leading-tight text-ink">Sign in</h1>
          <p className="mb-7 mt-1.5 text-[12.5px] text-sub">
            Use the credentials issued to your brand by 5th Avenue.
          </p>

          <div className="mb-4" style={{ animation: "riseIn 0.5s 0.1s cubic-bezier(0.16,1,0.3,1) both" }}>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@yourbrand.com" autoComplete="username" className={inputCls} />
          </div>
          <div className="mb-5" style={{ animation: "riseIn 0.5s 0.16s cubic-bezier(0.16,1,0.3,1) both" }}>
            <label className={labelCls}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" className={inputCls} />
          </div>

          {err && (
            <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-red/20 bg-red/[0.05] px-3.5 py-2.5 text-[12px] font-medium text-red" style={{ animation: "riseIn 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
              <span className="text-[13px]">⚠</span>{err}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password}
            className={`group relative w-full overflow-hidden rounded-full py-3 text-[13px] font-semibold transition-all duration-250 ease-out ${
              loading || !email || !password
                ? "cursor-not-allowed bg-well text-mute"
                : "bg-accent text-white shadow-[0_10px_28px_rgba(37,99,235,0.35)] hover:-translate-y-px hover:shadow-[0_16px_36px_rgba(37,99,235,0.45)] active:translate-y-0"
            }`}>
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? "Signing in…" : "Sign in"}
            </span>
            {!loading && email && password && (
              <span
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
            )}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-mute">
            Lost your credentials? Contact your 5th Avenue account manager.
          </p>

          {/* Demo credentials hint — fake data, so surface it for quick access
              (same pattern as the internal staff app's login page). */}
          {/* <div className="mt-8 rounded-[16px] border border-[rgba(15,23,42,0.07)] bg-white/60 px-4 py-4 shadow-sm backdrop-blur-sm">
            <div className="mb-2.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">
              <span className="size-1 rounded-full bg-accent/60" />
              Demo credentials
            </div>
            {DEMO_LOGINS.map((u, i) => (
              <button key={u.email} type="button"
                onClick={() => { setEmail(u.email); setPassword(u.password); setErr(""); }}
                className={`group flex w-full items-center justify-between rounded-[10px] px-1.5 py-2 text-left transition-colors duration-150 hover:bg-accent/[0.05] ${
                  i !== DEMO_LOGINS.length - 1 ? "border-b border-[rgba(15,23,42,0.06)]" : ""
                }`}>
                <span className="text-[10.5px] font-medium text-ink transition-colors group-hover:text-accent">{u.clientName}</span>
                <span className="font-mono text-[10px] text-mute">{u.email}</span>
              </button>
            ))}
            <div className="mt-2 text-[9px] text-mute">Click a row to auto-fill credentials.</div>
          </div> */}
        </form>
      </div>
    </div>
  );
}