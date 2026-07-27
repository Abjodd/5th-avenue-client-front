import { useMemo, useRef, useState } from "react";
import {
  Sparkles, Gauge, HeartHandshake, Compass, MapPin, Clock, ArrowRight, ArrowDown, Check, type LucideIcon,
} from "lucide-react";
import { gsap, useGSAP, SplitText } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { prefersReducedMotion } from "../../motion/reducedMotion";
import { useReveal } from "../../motion/useReveal";
import { OPENINGS, DEPTS, type Opening } from "../../lib/marketing/data/careers";
import { Button, Input, Select, Badge, Icon } from "../../components/primitives";
import { submitForm, CONTACT_EMAIL } from "../../lib/submitForm";
import { cx } from "../../lib/cx";

const VALUES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Compass, title: "Ownership", body: "Every hire runs a real budget or a real client relationship — from week one, not year two." },
  { icon: Sparkles, title: "Craft", body: "We'd rather ship one campaign we're proud of than three we're not." },
  { icon: Gauge, title: "Speed", body: "Days, not quarters. Small teams, short loops, decisions made in the room." },
  { icon: HeartHandshake, title: "Regional-first", body: "We build for India's languages and cities, not a single-market template." },
];

export default function CareersPage() {
  const [selectedId, setSelectedId] = useState<string>(OPENINGS[0].id);
  const [dept, setDept] = useState<(typeof DEPTS)[number]>("All");
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const filtered = useMemo(
    () => (dept === "All" ? OPENINGS : OPENINGS.filter((o) => o.dept === dept)),
    [dept],
  );

  const applyTo = (o: Opening) => {
    setSelectedId(o.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ── Hero set-piece: eyebrow → curtain char-reveal of the headline → subline
     + CTAs. ── */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(heroRef);

      const split = new SplitText(q("[data-careers-title]"), {
        type: "chars,lines",
        linesClass: "overflow-hidden py-[0.06em]",
      });
      const tl = gsap.timeline({ defaults: { ease: EASE.out } });
      tl.from(q("[data-careers-eyebrow]"), { opacity: 0, y: 12, duration: DUR.md })
        .from(split.chars, { yPercent: 120, opacity: 0, duration: DUR.xl, stagger: 0.02, ease: EASE.emph }, "-=0.1")
        .from(q("[data-careers-sub]"), { opacity: 0, y: 16, duration: DUR.md }, "-=0.55")
        .from(q("[data-careers-cta]"), { opacity: 0, y: 14, duration: DUR.md, stagger: 0.08 }, "-=0.35")
        .from(q("[data-careers-cue]"), { opacity: 0, duration: DUR.md }, "-=0.25");

      return () => split.revert();
    },
    { scope: heroRef },
  );

  const valuesRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.06 });
  const openingsRef = useReveal<HTMLDivElement>({ stagger: true, staggerEach: 0.05 });

  return (
    <>
      {/* hero — bold set-piece */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-line">
        {/* ambient accent wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(58% 48% at 50% 0%, var(--accent-muted) 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto flex min-h-[90svh] max-w-[1200px] flex-col justify-center px-6 pb-24 pt-[max(8rem,16vh)] md:px-10">
          <p data-careers-eyebrow className="font-mono text-eyebrow uppercase tracking-[0.28em] text-ink-3">
            Careers · Bangalore · Now hiring
          </p>

          <h1
            data-careers-title
            className="mt-7 font-display font-semibold uppercase leading-[0.88] tracking-[-0.01em] text-ink"
            style={{ fontSize: "clamp(52px, 12vw, 176px)" }}
          >
            Come build
            <br />
            with us<span className="text-accent">.</span>
          </h1>

          <p data-careers-sub className="mt-8 max-w-2xl font-serif text-[clamp(20px,2.5vw,30px)] leading-snug text-ink-2">
            We're hiring across growth, brand, creators and ops — come make marketing that{" "}
            <span className="italic text-accent">compounds</span>, from Bangalore.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              data-careers-cta
              href="#openings"
              className="group inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-body font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              See open roles
              <Icon icon={ArrowRight} size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
            <a
              data-careers-cta
              href="#apply-form"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-line px-6 text-body text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Apply now
            </a>
            <span data-careers-cta className="ml-1 text-caption text-ink-3">
              {OPENINGS.length} roles · {DEPTS.length - 1} teams
            </span>
          </div>

          <div data-careers-cue className="mt-14 flex items-center gap-2 text-ink-3">
            <span className="fa-scroll-cue">
              <Icon icon={ArrowDown} size={16} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em]">Scroll to explore</span>
          </div>
        </div>
      </section>

      {/* why 5th avenue */}
      <section className="border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Why join</p>
          <h2 className="mt-3 max-w-2xl font-serif text-display-lg text-ink">How we work.</h2>
          <div ref={valuesRef} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div data-reveal key={v.title} className="rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <Icon icon={v.icon} size={18} />
                </span>
                <h3 className="mt-4 text-title text-ink">{v.title}</h3>
                <p className="mt-2 text-body text-ink-2">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* open roles */}
      <section id="openings" className="scroll-mt-16 border-b border-line px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Open roles</p>
              <h2 className="mt-3 font-serif text-display-lg text-ink">Where we need you.</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEPTS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-caption transition-colors",
                    dept === d ? "border-line-strong bg-hover text-ink" : "border-line text-ink-2 hover:text-ink",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div ref={openingsRef} className="mt-12 flex flex-col gap-5 sm:gap-6">
            {filtered.map((o) => (
              <div
                data-reveal
                key={o.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:justify-between sm:p-7"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-title text-ink">{o.title}</h3>
                    <Badge tone="accent">{o.dept}</Badge>
                  </div>
                  <p className="mt-2 max-w-2xl text-body text-ink-2">{o.blurb}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-3">
                    <span className="flex items-center gap-1.5"><Icon icon={MapPin} size={13} />{o.location}</span>
                    <span className="flex items-center gap-1.5"><Icon icon={Clock} size={13} />{o.type}</span>
                    <span className="hidden gap-1.5 sm:flex">{o.tags.join(" · ")}</span>
                  </div>
                </div>
                <Button variant="primary" iconRight={ArrowRight} className="shrink-0" onClick={() => applyTo(o)}>
                  Apply
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-body text-ink-3">No open roles in this team right now.</p>
            )}
          </div>
        </div>
      </section>

      {/* application form */}
      <ApplicationForm ref={formRef} selectedId={selectedId} onSelect={setSelectedId} />
    </>
  );
}

function ApplicationForm({
  ref, selectedId, onSelect,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkRef = useRef<SVGSVGElement>(null);

  const valid = useMemo(() => name.trim() && email.trim(), [name, email]);
  const roleOptions = [...OPENINGS.map((o) => ({ value: o.id, label: o.title })), { value: "general", label: "General application" }];
  const selectedTitle = OPENINGS.find((o) => o.id === selectedId)?.title ?? "General application";

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
    <section ref={ref} id="apply-form" className="scroll-mt-16 px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-lg">
        {submitted ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center shadow-card">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success-muted">
              <svg ref={checkRef} width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13.5L10.5 19L21 7" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="font-serif text-title-lg text-ink">Application received.</h2>
            <p className="mx-auto mt-3 max-w-sm text-body text-ink-2">
              Thanks, {name.split(" ")[0] || "there"}. We review every application for{" "}
              <span className="text-ink">{selectedTitle}</span> — if there's a fit, someone from the
              team reaches out within a week.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
              Submit another
            </Button>
          </div>
        ) : (
          <>
            <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Apply</p>
            <h2 className="mt-3 font-serif text-display-lg text-ink">Tell us about you.</h2>
            <p className="mt-3 max-w-md text-body text-ink-2">
              Pick the role, share your details, and a short note on why you'd be good at it.
            </p>

            <form
              className="mt-8 flex flex-col gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!valid || submitting) return;
                setSubmitting(true);
                setError(null);
                const res = await submitForm("careers", {
                  Role: selectedTitle,
                  Name: name,
                  Email: email,
                  "Portfolio / LinkedIn": link,
                  "Why 5th Avenue?": note,
                });
                setSubmitting(false);
                if (res.ok) setSubmitted(true);
                else setError(res.error ?? "Something went wrong.");
              }}
            >
              <Field label="Role">
                <Select className="w-full" options={roleOptions} value={selectedId} onChange={(e) => onSelect(e.target.value)} />
              </Field>
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
              </Field>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@email.com" />
              </Field>
              <Field label="Portfolio / LinkedIn" hint="optional">
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="linkedin.com/in/priyasharma" />
              </Field>
              <Field label="Why 5th Avenue?" hint="optional">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="A line or two on what you'd bring."
                  className="w-full resize-none rounded-md border border-line bg-input px-3 py-2 text-body text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-line-strong focus:border-accent/50 focus:outline-none"
                />
              </Field>

              {error && (
                <p className="rounded-md border border-danger/40 bg-danger-muted px-3 py-2 text-caption text-danger">
                  {error} You can also email us at{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
                </p>
              )}
              <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!valid} className="mt-2 w-full justify-center">
                <Icon icon={Check} size={16} /> Submit application
              </Button>
              <p className="text-center text-caption text-ink-3">
                We reply to every application — no automated funnels.
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="text-label font-medium text-ink">{label}</span>
        {hint && <span className="text-caption text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
