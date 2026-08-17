import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { gsap, useGSAP } from "../../motion/gsap";
import { DUR, EASE } from "../../motion/tokens";
import { STATES_META } from "../../lib/marketing/data/map-data";
import { NICHES } from "../../lib/marketing/data/niches";
import { Button, Input, Select, Chip, Icon } from "../../components/primitives";
import { CONTACT_EMAIL, submitCreatorRequest } from "../../lib/clientRequests";
import { cx } from "../../lib/cx";

const PLATFORMS = ["Instagram", "YouTube", "Facebook", "X (Twitter)", "LinkedIn"];
const FOLLOWER_BANDS = ["< 10K (Nano)", "10K–100K (Micro)", "100K–1M (Macro)", "1M+ (Mega)"];
const LANGS = ["Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi"];

const stateOptions = Object.entries(STATES_META)
  .map(([id, m]) => ({ value: id, label: m.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

export default function ApplyPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [state, setState] = useState("mh");
  const [band, setBand] = useState(FOLLOWER_BANDS[1]);
  const [niche, setNiche] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>(["Hindi"]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkRef = useRef<SVGSVGElement>(null);

  const valid = useMemo(
    () => name.trim() && handle.trim() && (email.trim() || phone.trim()) && niche.length > 0 && langs.length > 0,
    [name, handle, email, phone, niche, langs],
  );

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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
          <Icon icon={ArrowLeft} size={16} /> Back to 5th Avenue
        </Link>

        {submitted ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center shadow-card">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-success-muted">
              <svg ref={checkRef} width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13.5L10.5 19L21 7" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="font-serif text-title-lg text-ink">Application received.</h1>
            <p className="mx-auto mt-3 max-w-sm text-body text-ink-2">
              Thanks, {name.split(" ")[0] || "creator"}. Our regional team reviews new creators
              weekly — if there's a fit, you'll hear from us at {handle}.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
              Submit another
            </Button>
          </div>
        ) : (
          <>
            <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">
              Regional creator network
            </p>
            <h1 className="mt-3 font-serif text-display-lg text-ink">Apply as a creator.</h1>
            <p className="mt-3 max-w-md text-body text-ink-2">
              We match creators to brand campaigns by region, language and niche.
              Tell us about you — it takes a minute.
            </p>

            <form
              className="mt-8 flex flex-col gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!valid || submitting) return;
                setSubmitting(true);
                setError(null);
                const res = await submitCreatorRequest({
                  name,
                  handle,
                  platform,
                  email,
                  phone,
                  state,
                  followers: band,
                  niche,
                  languages: langs,
                });
                setSubmitting(false);
                if (res.ok) setSubmitted(true);
                else setError(res.error ?? "Something went wrong.");
              }}
            >
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
              </Field>
              <Field label="Primary handle">
                <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" />
              </Field>
              {/* Contact — at least one is required by the backend, which needs
                  a way to reach the creator once the application is reviewed. */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@email.com" />
                </Field>
                <Field label="Phone">
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Platform">
                  <Select className="w-full" options={PLATFORMS.map((p) => ({ value: p, label: p }))} value={platform} onChange={(e) => setPlatform(e.target.value)} />
                </Field>
                <Field label="Home state">
                  <Select className="w-full" options={stateOptions} value={state} onChange={(e) => setState(e.target.value)} />
                </Field>
              </div>
              <Field label="Audience size">
                <Select className="w-full" options={FOLLOWER_BANDS.map((b) => ({ value: b, label: b }))} value={band} onChange={(e) => setBand(e.target.value)} />
              </Field>
              <Field label="Niche" hint={niche.length ? `${niche.length} selected` : "pick at least one"}>
                <div className="flex flex-wrap gap-2">
                  {NICHES.slice(0, 8).map((n) => (
                    <Chip key={n} selected={niche.includes(n)} onClick={() => toggle(niche, setNiche, n)}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Languages">
                <div className="flex flex-wrap gap-2">
                  {LANGS.map((l) => (
                    <Chip key={l} selected={langs.includes(l)} onClick={() => toggle(langs, setLangs, l)}>
                      {l}
                    </Chip>
                  ))}
                </div>
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
