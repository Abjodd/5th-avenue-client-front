/**
 * src/pages/Profile.jsx — Settings.
 *
 * Three panes behind a sticky rail: who you are, how the portal looks, and the
 * company record 5th Avenue holds for you.
 *
 * Account fields come straight from the login payload, which IS the sanitized
 * BrandCredential document (routes/auth.js → safe(doc) + brandId/clientName).
 * Company fields come from GET /api/portal/client, allowlisted server-side.
 * Nothing is fetched twice and nothing is invented — a field the DB doesn't
 * hold renders "—", and a whole section with no data says so rather than
 * showing a grid of dashes.
 */
import { useRef, useState } from "react";
import { User, Palette, Building2, ArrowLeft, Mail, ExternalLink } from "lucide-react";

import { useApp } from "../context";
import { useAuth } from "../context/AuthContext";
import { usePortalClient } from "../lib/usePortalData";
import { prettyDate, initials } from "../lib/format";
import { AccountAPI } from "../lib/api";
import { compressAvatar, AVATAR_ACCEPT } from "../lib/avatar";
import { Reveal, Stagger, StaggerItem, AmbientBackground } from "../components/motion/Motion";
import { Panel, Subpanel, PanelTitle, PanelEmpty } from "../components/portal/Shell";
import { Skeleton } from "../components/PageStates";
import ThemeToggle from "../components/ThemeToggle";

const PANES = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "company", label: "Company", Icon: Building2 },
];

/** label · value · optional link. Empty renders "—", never a guess. */
function Field({ label, value, href }) {
  const empty = value == null || value === "";
  return (
    <StaggerItem className="rounded-[16px] border border-line bg-[--color-glass] px-4 py-3.5 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
      {href && !empty ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1 truncate text-[15px] font-semibold text-accent no-underline hover:underline">
          <span className="truncate">{value}</span>
          {href.startsWith("http") && <ExternalLink size={12} className="shrink-0" />}
        </a>
      ) : (
        <div className={`mt-1 truncate text-[15px] font-semibold ${empty ? "text-donetxt" : "text-ink"}`} title={empty ? undefined : String(value)}>
          {empty ? "—" : value}
        </div>
      )}
    </StaggerItem>
  );
}

/** A grid of fields, or nothing at all when none of them have a value. */
function FieldGrid({ fields, empty }) {
  const filled = fields.filter((f) => f.value != null && f.value !== "");
  if (!filled.length) return <PanelEmpty>{empty}</PanelEmpty>;
  return (
    <Stagger animate="show" stagger={0.05} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {fields.map((f) => <Field key={f.label} {...f} />)}
    </Stagger>
  );
}

/**
 * The identity avatar, and the only writable control in the whole portal.
 *
 * Clicking the avatar picks a file; the image is downscaled to 256px and
 * re-encoded client-side (see lib/avatar.js) before it is sent, so a 4MB phone
 * photo travels as ~25KB. It saves IMMEDIATELY on pick rather than behind a
 * separate button: there is exactly one field, so a Save step would be a second
 * click that can only ever mean "yes, the thing I just chose".
 */
function AvatarUpload({ user, onSaved }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [broken, setBroken] = useState(false);
  // Shown the instant a file is picked, so the new photo appears while the
  // upload is still in flight instead of after a round trip.
  const [pending, setPending] = useState(null);

  const stored = AccountAPI.avatarUrl(user);
  const src = pending || stored;
  const show = !!src && !broken;

  const pick = async (file) => {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const dataUri = await compressAvatar(file);
      setPending(dataUri);
      setBroken(false);
      const updated = await AccountAPI.updatePhoto(user.id, dataUri);
      onSaved({ hasAvatar: updated.hasAvatar, avatarUpdatedAt: updated.avatarUpdatedAt });
      setPending(null); // stored URL now carries the new photo, with a fresh ?v=
    } catch (e) {
      setPending(null);
      // The backend's own message is the useful one ("must be 2MB or smaller").
      setErr(e.body?.error || e.message);
    } finally {
      setBusy(false);
      // Lets the same file be re-picked after an error — without this, choosing
      // it again fires no change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setErr(""); setBusy(true);
    try {
      const updated = await AccountAPI.updatePhoto(user.id, null);
      onSaved({ hasAvatar: updated.hasAvatar, avatarUpdatedAt: updated.avatarUpdatedAt });
      setBroken(false);
    } catch (e) {
      setErr(e.body?.error || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-5">
      <button type="button" onClick={() => !busy && inputRef.current?.click()}
        title="Change your profile photo"
        className="relative flex size-[70px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-accent to-purple text-[24px] font-semibold text-white shadow-[0_10px_30px_rgba(44,62,126,0.35)] transition-transform duration-200 hover:scale-[1.03]">
        {show
          ? <img src={src} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
          : (user?.avatar || initials(user?.name))}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11px]">…</span>}
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-serif text-[26px] font-bold italic leading-tight text-ink">{user?.name || "—"}</h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-sub">
          {user?.title && <span className="rounded-full bg-accent/[0.08] px-2.5 py-0.5 text-[11.5px] font-semibold text-accent">{user.title}</span>}
          <span>{user?.clientName}</span>
          {user?.email && (
            <a href={`mailto:${user.email}`} className="flex items-center gap-1 text-mute transition-colors hover:text-accent">
              <Mail size={12} /> {user.email}
            </a>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="rounded-full border border-line bg-[--color-glass] px-3 py-1 text-[11.5px] font-medium text-sub transition-colors hover:text-ink disabled:opacity-50">
            {show ? "Change photo" : "Upload photo"}
          </button>
          {show && (
            <button type="button" disabled={busy} onClick={remove}
              className="rounded-full border border-red/20 px-3 py-1 text-[11.5px] font-medium text-red transition-colors hover:bg-red/[0.05] disabled:opacity-50">
              Remove
            </button>
          )}
          <span className={`text-[11px] ${err ? "text-red" : "text-mute"}`}>
            {err || "Optional · PNG, JPEG or WebP · up to 2MB"}
          </span>
        </div>
      </div>

      <input ref={inputRef} type="file" accept={AVATAR_ACCEPT} hidden
        onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export default function Settings() {
  const { setPage } = useApp();
  const { user, updateUser } = useAuth();
  const [pane, setPane] = useState("profile");
  const { data: company, error: companyError } = usePortalClient();

  const account = [
    { label: "Full name", value: user?.name },
    { label: "Role", value: user?.title },
    { label: "Email", value: user?.email, href: user?.email ? `mailto:${user.email}` : undefined },
    { label: "Phone", value: user?.phone, href: user?.phone ? `tel:${user.phone}` : undefined },
    { label: "Account ID", value: user?.id },
    { label: "Member since", value: user?.createdAt ? prettyDate(user.createdAt) : null },
  ];

  const p = company?.profile ?? {};
  const companyFields = [
    { label: "Industry", value: p.industry },
    { label: "Category", value: p.subIndustry },
    { label: "Business type", value: p.type },
    { label: "Company size", value: p.employees },
    { label: "Founded", value: p.founded },
    { label: "Stage", value: p.stage },
    { label: "Website", value: company?.website, href: company?.website ? `https://${String(company.website).replace(/^https?:\/\//, "")}` : undefined },
    { label: "Markets", value: p.geography },
  ];

  return (
    <div className="relative">
      <AmbientBackground variant="a" />

      <div className="mx-auto w-full max-w-[1100px] px-5 pb-16 sm:px-9">
        <Reveal className="pt-10">
          <button onClick={() => setPage("overview")}
            className="mb-5 flex items-center gap-1.5 rounded-full border border-line bg-[--color-glass] px-3 py-1.5 text-[11.5px] font-medium text-sub shadow-sm backdrop-blur-sm transition-all duration-150 hover:-translate-x-0.5 hover:text-ink">
            <ArrowLeft size={13} /> Back to portal
          </button>
          <div className="microlabel mb-1.5 tracking-[0.2em]">Settings</div>
          <h1 className="font-serif text-[clamp(28px,4vw,40px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">
            Your account
          </h1>
        </Reveal>

        {/* Identity header — the avatar here is the upload control */}
        <Panel reveal className="mt-6 mb-5 px-7 py-6">
          <AvatarUpload user={user} onSaved={updateUser} />
        </Panel>

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
          {/* Pane rail */}
          <nav className="top-28 flex gap-1.5 overflow-x-auto md:sticky md:flex-col md:overflow-visible" aria-label="Settings sections">
            {PANES.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setPane(id)} aria-current={pane === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  pane === id
                    ? "bg-accent/[0.09] font-semibold text-accent shadow-[0_0_0_1px_rgba(44,62,126,0.14)]"
                    : "text-sub hover:bg-well/70 hover:text-ink"
                }`}>
                <Icon size={15} strokeWidth={2} /> {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {pane === "profile" && (
              <Panel reveal className="px-6 py-5">
                <PanelTitle title="Account" hint="Issued to you by 5th Avenue and scoped to one brand." />
                <FieldGrid fields={account} empty="No account details on file." />
                <p className="mt-4 text-[11px] leading-relaxed text-mute">
                  These details are managed by 5th Avenue. To change your name, contact details or access,
                  reach out to your account manager.
                </p>
              </Panel>
            )}

            {pane === "appearance" && (
              <Panel reveal className="px-6 py-5">
                <PanelTitle title="Appearance" hint="Auto follows your device's system setting. Pick Light or Dark to override it." />
                <ThemeToggle showLabel />
              </Panel>
            )}

            {pane === "company" && (
              <div className="flex flex-col gap-4">
                <Panel reveal className="px-6 py-5">
                  <PanelTitle
                    title={company?.name || user?.clientName || "Company"}
                    hint="The profile we hold for your brand"
                    action={<span className="rounded-full bg-well px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">Read-only</span>}
                  />
                  {companyError ? (
                    <PanelEmpty>Couldn't load your company record. {companyError}</PanelEmpty>
                  ) : !company ? (
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[68px] rounded-[16px]" />)}
                    </div>
                  ) : (
                    <>
                      <FieldGrid fields={companyFields} empty="No company profile on file yet." />
                      {company.products?.length > 0 && (
                        <div className="mt-4 border-t border-line pt-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Products</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {company.products.map((prod) => (
                              <span key={prod} className="rounded-full border border-line bg-well/70 px-2.5 py-1 text-[11.5px] text-sub">{prod}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Panel>

                {company?.consultant && (
                  <Panel reveal delay={0.06} className="px-6 py-5">
                    <PanelTitle title="Account manager" hint="Your dedicated 5th Avenue contact" />
                    <Subpanel className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/[0.09] text-[12px] font-bold text-accent">
                        {initials(company.consultant)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">{company.consultant}</span>
                        <span className="block text-[11.5px] text-mute">5th Avenue Marketing</span>
                      </span>
                    </Subpanel>
                  </Panel>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
