/**
 * 5th Avenue — Client Portal Login
 * Mirrors 5th-internal-front/src/pages/Login: left brand panel, right form.
 * Credentials are issued per brand representative (see context/AuthContext);
 * the login scopes every page to that user's clientName.
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 320)); // small delay so it doesn't feel instant-fake
    const result = login(email, password);
    setLoading(false);
    if (result.ok) {
      navigate(location.state?.from?.pathname || "/overview", { replace: true });
    } else {
      setErr(result.error);
    }
  };

  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/40";
  const labelCls = "mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute";

  return (
    <div className="flex min-h-screen w-full bg-page font-sans">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="relative hidden w-[42%] min-w-[340px] flex-col justify-between overflow-hidden bg-accent p-12 md:flex">
        {/* subtle texture circles */}
        <div className="pointer-events-none absolute -right-[120px] -top-[120px] size-[400px] rounded-full border border-white/[0.06]"/>
        <div className="pointer-events-none absolute -left-20 bottom-14 size-[260px] rounded-full border border-white/[0.04]"/>
        <div>
          <div className="font-serif text-[22px] italic font-semibold tracking-[-0.02em] text-white">5th Avenue</div>
          <div className="mt-1.5 text-[9.5px] uppercase tracking-[0.14em] text-white/40">Client Portal</div>
        </div>
        <div className="font-serif text-[36px] italic font-medium leading-[1.2] text-white">
          Your campaigns,<br/>your creators,<br/>in one place.
        </div>
        <div className="text-[11px] text-white/40">© 5th Avenue Marketing</div>
      </div>

      {/* ── RIGHT FORM ── */}
      <div className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
          <h1 className="font-serif text-[24px] italic font-semibold text-ink">Sign in</h1>
          <p className="mb-6 mt-1 text-[12.5px] text-sub">
            Use the credentials issued to your brand by 5th Avenue.
          </p>
          <div className="mb-3.5">
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@yourbrand.com" autoComplete="username" className={inputCls}/>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" className={inputCls}/>
          </div>
          {err && (
            <div className="mb-3 rounded-md border border-red/20 bg-red/[0.04] px-3 py-2 text-[12px] font-medium text-red">
              {err}
            </div>
          )}
          <button type="submit" disabled={loading || !email || !password}
            className={`w-full rounded-[7px] py-2.5 text-[13px] font-semibold ${
              loading || !email || !password ? "cursor-not-allowed bg-well text-mute" : "bg-accent text-white"
            }`}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-5 text-center text-[11px] leading-relaxed text-mute">
            Lost your credentials? Contact your 5th Avenue account manager.
          </p>
        </form>
      </div>
    </div>
  );
}
