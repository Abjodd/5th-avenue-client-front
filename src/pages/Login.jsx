/**
 * Fifth Avenue — Client Portal Login.
 *
 * A single quiet column: eyebrow, serif title, two fields, one button. No
 * scene, no parallax, no cycling headline — the sign-in page is a doorway,
 * not a landing page.
 *
 * The root carries [data-marketing] so the page borrows the marketing site's
 * palette (light: #f7f7f8 paper, #0d1a3d ink, #1e3a8a accent) rather than the
 * portal's warm cream. /login is reached from the marketing nav and footer, so
 * it should read as the last marketing page rather than the first portal one.
 * Remove the attribute to hand it back to the portal tokens.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, Lock } from "lucide-react";
import { Button, Input, Icon } from "../components/primitives";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in — skip the form.
  if (user) return <Navigate to="/portal/overview" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // First sign-in ever → Profile, so the brand sees and corrects the account
    // we hold for them. Every sign-in after → the dashboard, where the
    // brand-story intro plays. `firstLogin` comes from the server, not this
    // browser: a local flag would fire again on every new device. `replace` so
    // Back leaves the portal instead of bouncing through login.
    navigate(result.user?.firstLogin ? "/portal/profile" : "/portal/overview", { replace: true });
  };

  return (
    <div data-marketing className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-8 md:px-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-label text-ink-2 transition-colors hover:text-ink"
        >
          <Icon icon={ArrowLeft} size={16} /> Back to Fifth Avenue
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
            Client portal
          </p>
          <h1 className="mt-3 font-serif text-display-lg text-ink">Sign in.</h1>
          <p className="mt-3 text-body text-ink-2">
            Your campaigns, analytics and billing — on one calm dashboard.
          </p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={submit}>
            <div>
              <label className="mb-1.5 block font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                Email
              </label>
              <Input
                type="email"
                icon={Mail}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@company.com"
                autoComplete="username"
                invalid={!!error}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
                Password
              </label>
              <Input
                type="password"
                icon={Lock}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••"
                autoComplete="current-password"
                invalid={!!error}
              />
            </div>

            {error && (
              <p role="alert" className="text-caption text-danger">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              iconRight={ArrowRight}
              loading={loading}
              disabled={!email || !password}
              className="mt-2 w-full"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-caption text-ink-3">
            Lost your credentials? Contact your Fifth Avenue account manager.
          </p>
        </div>
      </div>
    </div>
  );
}
