import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { Button, Input, Select, Icon } from "../../components/primitives";
import { CONTACT_EMAIL, submitClientRequest } from "../../lib/clientRequests";
import { cx } from "../../lib/cx";

const ROLES = [
  "Founder / CEO",
  "CMO / Marketing Head",
  "Brand Manager",
  "Growth / Performance",
  "Agency Partner",
  "Other",
];

export default function StartProjectPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [contact, setContact] = useState("");
  const [org, setOrg] = useState("");
  const [hq, setHq] = useState("");
  const [goal, setGoal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkRef = useRef<SVGSVGElement>(null);

  const valid = useMemo(
    () => name.trim() && contact.trim() && org.trim(),
    [name, contact, org],
  );

  useGSAP(
    () => {
      if (!submitted || !checkRef.current) return;
      const path = checkRef.current.querySelector("path");
      if (!path) return;
      const len = path.getTotalLength();
      gsap.fromTo(
        path,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: DUR.lg, ease: EASE.out, delay: 0.1 },
      );
    },
    { dependencies: [submitted] },
  );

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-lg px-6 py-10 md:py-16">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-label text-ink-2 transition-colors hover:text-ink">
          <Icon icon={ArrowLeft} size={16} /> Back to Fifth Avenue
        </Link>

        {submitted ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center shadow-card">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success-muted">
              <svg ref={checkRef} width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13.5L10.5 19L21 7" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="font-serif text-title-lg text-ink">Thanks, {name.split(" ")[0] || "there"}.</h1>
            <p className="mx-auto mt-3 max-w-sm text-body text-ink-2">
              We've got your details for {org}. A strategist will reach out within one
              business day to scope the goal, the plan and the dashboard.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
              Send another
            </Button>
          </div>
        ) : (
          <>
            <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
              Start a project
            </p>
            <h1 className="mt-3 font-serif text-display-lg text-ink">Let's build your next quarter.</h1>
            <p className="mt-3 max-w-md text-body text-ink-2">
              Tell us the goal — we'll bring the plan, the creators and the dashboard.
              It takes a minute, and a strategist replies within a day.
            </p>

            <form
              className="mt-8 flex flex-col gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!valid || submitting) return;
                setSubmitting(true);
                setError(null);
                const res = await submitClientRequest({
                  name,
                  role,
                  contact,
                  organisation: org,
                  headquarters: hq,
                  goal,
                });
                setSubmitting(false);
                if (res.ok) setSubmitted(true);
                else setError(res.error ?? "Something went wrong.");
              }}
            >
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" />
              </Field>
              <Field label="Your role">
                <Select className="w-full" options={ROLES.map((r) => ({ value: r, label: r }))} value={role} onChange={(e) => setRole(e.target.value)} />
              </Field>
              <Field label="Email or phone">
                <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="rahul@brand.com  ·  +91 98765 43210" />
              </Field>
              <Field label="Organisation">
                <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Brand or company name" />
              </Field>
              <Field label="Headquarters" hint="city / base of operations">
                <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="Mumbai, India" />
              </Field>
              <Field label="What's the goal?" hint="optional">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Launch, growth, a specific campaign — whatever you're solving for."
                  rows={3}
                  className={cx(
                    "w-full resize-none rounded-md border bg-input px-3 py-2 text-body text-ink placeholder:text-ink-3",
                    "transition-colors duration-150 focus:border-accent/50 focus:outline-none",
                    "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)]",
                    "border-line hover:border-line-strong",
                  )}
                />
              </Field>

              {error && (
                <p className="rounded-md border border-danger/40 bg-danger-muted px-3 py-2 text-caption text-danger">
                  {error} You can also email us at{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!valid} className="mt-2 w-full justify-center">
                <Icon icon={Check} size={16} /> Send project brief
              </Button>
              <p className="text-center text-caption text-ink-3">
                We reply to every enquiry — no automated funnels.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={cx("flex flex-col gap-2")}>
      <span className="flex items-center justify-between">
        <span className="text-label font-medium text-ink">{label}</span>
        {hint && <span className="text-caption text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
