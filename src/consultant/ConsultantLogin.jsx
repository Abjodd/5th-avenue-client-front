/**
 * Consultant portal — sign in (/consultant/login).
 *
 * Reached from "Consultant login" in the site footer, beside "Admin login".
 * Logins are made by the Fifth Avenue team in the internal app (Settings →
 * Consultant Login); there is no self sign-up. `?email=` prefills the email.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Mail, Loader2 } from "lucide-react";
import { getSession, signIn, warmUp } from "./consultantApi";
import "./consultant.css";

export default function ConsultantLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { warmUp(); document.title = "Consultant login · Fifth Avenue"; }, []);

  if (getSession()) return <Navigate to="/consultant" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    navigate("/consultant", { replace: true });
  };

  return (
    <div className="cx" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", minHeight: "100vh" }} data-page="consultant-login">
      <style>{`@media (max-width: 860px) { [data-page="consultant-login"] { grid-template-columns: 1fr !important; } [data-page="consultant-login"] .cx-login-art { display: none !important; } }`}</style>

      {/* left: the studio */}
      <aside className="cx-login-art" style={{ position: "relative", overflow: "hidden", padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "radial-gradient(120% 90% at 0% 0%, rgba(233,162,59,0.22) 0%, rgba(233,162,59,0) 55%), radial-gradient(90% 80% at 100% 100%, rgba(143,179,255,0.12) 0%, rgba(143,179,255,0) 60%), #121316",
        borderRight: "1px solid var(--cx-line)" }}>
        <div className="cx-eyebrow" style={{ color: "var(--cx-sub)" }}>Fifth Avenue · Consultant Studio</div>
        <div>
          <h1 className="cx-serif" style={{ fontSize: "clamp(44px, 5.4vw, 76px)", lineHeight: 1.0, margin: 0 }}>
            Your brands,<br /><span style={{ fontStyle: "italic", color: "var(--cx-accent)" }}>your studio.</span>
          </h1>
          <p style={{ color: "var(--cx-sub)", fontSize: 16, lineHeight: 1.6, maxWidth: 440, marginTop: 22 }}>
            Everything Fifth Avenue holds for your consultancy in one place — your details, the brands you run with us, your team, your UGC creators and your documents.
          </p>
        </div>
        <div style={{ display: "flex", gap: 26, color: "var(--cx-mute)", fontSize: 13 }}>
          {["Brands", "Team", "UGC creators", "Documents"].map((t) => <span key={t}>{t}</span>)}
        </div>
      </aside>

      {/* right: the form */}
      <main style={{ display: "flex", flexDirection: "column", padding: "32px clamp(20px, 5vw, 64px)" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--cx-sub)", textDecoration: "none", fontSize: 13.5 }}>
          <ArrowLeft size={15} /> Back to fifth-avenue.in
        </Link>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <form onSubmit={submit} className="cx-fade-in" style={{ width: "100%", maxWidth: 380 }} noValidate>
            <div className="cx-eyebrow">Consultant login</div>
            <h2 className="cx-serif" style={{ fontSize: 40, margin: "10px 0 8px" }}>Welcome back</h2>
            <p style={{ color: "var(--cx-sub)", margin: "0 0 28px", lineHeight: 1.55 }}>Sign in with the login your Fifth Avenue manager sent you.</p>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--cx-sub)", marginBottom: 6 }}>Email</span>
              <span style={{ position: "relative", display: "block" }}>
                <Mail size={16} style={{ position: "absolute", left: 14, top: 15, color: "var(--cx-mute)" }} />
                <input className="cx-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@consultancy.com" autoFocus={!email} />
              </span>
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--cx-sub)", marginBottom: 6 }}>Password</span>
              <span style={{ position: "relative", display: "block" }}>
                <Lock size={16} style={{ position: "absolute", left: 14, top: 15, color: "var(--cx-mute)" }} />
                <input className="cx-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus={!!email} />
              </span>
            </label>
            <div role="alert" aria-live="polite" style={{ minHeight: 22, color: "var(--cx-red)", fontSize: 13.5, margin: "6px 0 10px" }}>{error}</div>
            <button type="submit" className="cx-btn cx-btn-primary" disabled={busy} style={{ width: "100%", height: 48, fontSize: 15.5 }}>
              {busy ? <Loader2 size={17} className="cx-spin" /> : <>Sign in <ArrowRight size={17} /></>}
            </button>
            <p style={{ color: "var(--cx-mute)", fontSize: 12.5, lineHeight: 1.55, marginTop: 22 }}>
              No login yet, or forgot your password? Ask your Fifth Avenue manager — logins are set up by our team.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
