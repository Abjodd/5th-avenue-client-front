// src/pages/Profile.jsx — read-only profile page for the logged-in brand user.
// Every field comes straight from the login payload, which IS the sanitized
// BrandCredential DB record (routes/auth.js → safe(doc) + brandId/clientName).
// Nothing is fetched again or invented; unknown fields render "—".

import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { prettyDate } from "../lib/format";
import { Reveal, Stagger, StaggerItem, AmbientBackground } from "../components/motion/Motion";
import ThemeToggle from "../components/ThemeToggle";

/* label · value · optional monospace/href hint */
function Field({ label, value, href }) {
  const empty = value == null || value === "";
  return (
    <StaggerItem className="rounded-[16px] border border-line bg-[--color-glass] px-4 py-3.5 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
      {href && !empty ? (
        <a href={href} className="mt-1 block truncate text-[15px] font-semibold text-accent no-underline hover:underline">{value}</a>
      ) : (
        <div className={`mt-1 truncate text-[15px] font-semibold ${empty ? "text-donetxt" : "text-ink"}`}>{empty ? "—" : value}</div>
      )}
    </StaggerItem>
  );
}

export default function Profile() {
  const { setPage } = useApp();
  const { user } = useAuth();

  const account = [
    { label: "Full name", value: user?.name },
    { label: "Role", value: user?.title },
    { label: "Email", value: user?.email, href: user?.email ? `mailto:${user.email}` : undefined },
    { label: "Phone", value: user?.phone, href: user?.phone ? `tel:${user.phone}` : undefined },
    { label: "Username", value: user?.username },
    { label: "Account ID", value: user?.id },
  ];
  const company = [
    { label: "Company", value: user?.clientName },
    { label: "Brand ID", value: user?.brandId },
    { label: "Member since", value: user?.createdAt ? prettyDate(user.createdAt) : null },
    { label: "Last updated", value: user?.updatedAt ? prettyDate(user.updatedAt) : null },
  ];

  return (
    <div className="relative">
      <AmbientBackground variant="a" />

      <div className="mx-auto w-full max-w-[900px] px-5 pb-16 sm:px-9">
        {/* Back + heading */}
        <Reveal className="pt-10">
          <button
            onClick={() => setPage("overview")}
            className="mb-5 flex items-center gap-1 rounded-full border border-line bg-[--color-glass] px-3 py-1.5 text-[11.5px] font-medium text-sub shadow-sm backdrop-blur-sm transition-all duration-150 hover:-translate-x-0.5 hover:text-ink"
          >
            ← Back to portal
          </button>
        </Reveal>

        {/* Identity header */}
        <Reveal className="mb-6 flex flex-wrap items-center gap-5 rounded-[24px] border border-line bg-[--color-glass] px-7 py-6 shadow-card backdrop-blur-xl">
          <div className="flex size-[70px] shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-accent to-purple text-[26px] font-semibold text-white shadow-[0_10px_30px_rgba(44,62,126,0.35)]">
            {user?.avatar || user?.name?.[0] || "?"}
          </div>
          <div className="min-w-0">
            <div className="microlabel mb-1 tracking-[0.2em]">Your profile</div>
            <h1 className="font-serif text-[clamp(28px,4vw,40px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">
              {user?.name || "—"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-sub">
              {user?.title && <span className="rounded-full bg-accent/[0.08] px-2.5 py-0.5 text-[11.5px] font-semibold text-accent">{user.title}</span>}
              <span>{user?.clientName}</span>
            </div>
          </div>
        </Reveal>

        {/* Appearance */}
        <Reveal className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-line bg-[--color-glass] px-6 py-5 shadow-card backdrop-blur-xl">
          <div>
            <h2 className="mb-1 font-serif text-[19px] italic font-semibold text-ink">Appearance</h2>
            <p className="text-[12.5px] text-sub">Default follows your device (system setting). Tap to switch light / dark.</p>
          </div>
          <ThemeToggle showLabel />
        </Reveal>

        {/* Account details */}
        <Reveal className="mb-4 rounded-[24px] border border-line bg-[--color-glass] px-6 py-5 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-serif text-[19px] italic font-semibold text-ink">Account</h2>
          <Stagger animate="show" stagger={0.05} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {account.map(f => <Field key={f.label} {...f} />)}
          </Stagger>
        </Reveal>

        {/* Company details */}
        <Reveal className="rounded-[24px] border border-line bg-[--color-glass] px-6 py-5 shadow-card backdrop-blur-xl">
          <h2 className="mb-4 font-serif text-[19px] italic font-semibold text-ink">Company</h2>
          <Stagger animate="show" stagger={0.05} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {company.map(f => <Field key={f.label} {...f} />)}
          </Stagger>
          <p className="mt-4 text-[11px] leading-relaxed text-mute">
            These details are managed by 5th Avenue. To update your name, contact details, or company
            information, reach out to your account manager.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
