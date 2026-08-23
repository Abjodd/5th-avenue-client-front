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
import { useCallback, useEffect, useRef, useState } from "react";
import { User, Palette, Building2, ArrowLeft, Mail, ExternalLink, Pencil, Lock, KeyRound, Eye, EyeOff, Check } from "lucide-react";

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
import ProfileCompletion from "../components/ProfileCompletion";

const PANES = [
  { id: "profile", label: "Profile", Icon: User },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "company", label: "Company", Icon: Building2 },
];

/** label · value · optional link. Empty renders "—", never a guess.
 *  `lockedReason` marks a field that deliberately CANNOT be edited, so it reads
 *  as a decision rather than as an oversight next to the ones that can. */
function Field({ label, value, href, lockedReason }) {
  const empty = value == null || value === "";
  return (
    <StaggerItem className="rounded-[16px] border border-line bg-[--color-glass] px-4 py-3.5 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:shadow-md">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">
        {label}
        {lockedReason && <Lock size={10} strokeWidth={2.2} className="text-donetxt" aria-label={lockedReason} />}
      </div>
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

/**
 * The same card as Field, but editable — and it has to SAY so.
 *
 * The first cut was an always-live input styled exactly like a read-only card:
 * identical border, identical type, no cursor change and no control. It was
 * indistinguishable from the fields you cannot edit sitting next to it, so the
 * capability was invisible — and worse, an empty Phone rendered its
 * placeholder in the same grey a real "—" uses, which reads as a value rather
 * than as an empty box.
 *
 * So editing is now an explicit mode: a pencil that appears on the card, a
 * ring and a real input while you're in it, and Save/Cancel you can actually
 * see. Enter saves and Escape cancels for anyone who'd rather not reach for
 * them.
 *
 * The write goes straight to the shared backend, so a change here is the same
 * record the agency's internal Auth page reads — there is one account, not a
 * portal copy of one.
 */
function EditableField({ label, value, onSave, type = "text", placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  // Opening the editor starts from whatever is saved right now, so a cancelled
  // edit leaves nothing behind for the next one to inherit.
  const open = () => { setDraft(value ?? ""); setErr(""); setEditing(true); };
  const cancel = () => { setDraft(value ?? ""); setErr(""); setEditing(false); };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next === (value ?? "").trim()) return setEditing(false); // nothing changed
    setBusy(true);
    setErr("");
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setErr(e.body?.error || e.message);       // stay open so it can be fixed
    } finally {
      setBusy(false);
    }
  };

  const empty = value == null || value === "";

  return (
    <StaggerItem
      className={`group relative rounded-[16px] border bg-[--color-glass] px-4 py-3.5 shadow-[0_1px_10px_rgba(25,22,17,0.03)] backdrop-blur-md transition-all duration-200 ${
        editing ? "border-accent/50 shadow-[0_0_0_3px_rgba(44,62,126,0.08)]" : "border-line hover:-translate-y-px hover:border-accent/30 hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</span>
        {/* Occupies its space whenever the field is idle and only fades in on
            hover, focus or keyboard tab — so the row never reflows as it
            appears, and a grid of cards isn't a grid of pencils at rest. */}
        {!editing && (
          <button type="button" onClick={open} aria-label={`Edit ${label.toLowerCase()}`}
            className="-my-1 flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-medium text-accent opacity-0 transition-opacity duration-150 hover:bg-accent/[0.08] focus:opacity-100 focus:outline-none group-hover:opacity-100">
            <Pencil size={11} strokeWidth={2.2} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <input
            ref={inputRef}
            type={type}
            value={draft}
            disabled={busy}
            placeholder={placeholder}
            onChange={(e) => { setDraft(e.target.value); setErr(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className="mt-1 w-full rounded-[8px] border border-line bg-[--color-input] px-2 py-1 text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-donetxt disabled:opacity-50"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={commit} disabled={busy}
              className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} disabled={busy}
              className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-sub transition-colors hover:text-ink disabled:opacity-50">
              Cancel
            </button>
          </div>
        </>
      ) : (
        // Clicking the value opens the editor too — the pencil is the signpost,
        // but the value is the bigger target and the one people reach for.
        <button type="button" onClick={open}
          className={`mt-1 block w-full truncate text-left text-[15px] font-semibold ${empty ? "italic text-donetxt" : "text-ink"}`}>
          {empty ? "Not set" : value}
        </button>
      )}

      {err && <div className="mt-1.5 text-[11px] text-red">{err}</div>}
    </StaggerItem>
  );
}

/** A grid of fields, or nothing at all when none of them have a value. */
function FieldGrid({ fields, empty }) {
  // An editable field counts as something to show even when it is empty: it is
  // a control, not a value, and hiding it would hide the way to fill it in.
  const anything = fields.some((f) => f.onSave || (f.value != null && f.value !== ""));
  if (!anything) return <PanelEmpty>{empty}</PanelEmpty>;
  return (
    <Stagger animate="show" stagger={0.05} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {fields.map((f) => (f.onSave
        ? <EditableField key={f.label} {...f} />
        : <Field key={f.label} {...f} />))}
    </Stagger>
  );
}

/**
 * Changing your own sign-in password.
 *
 * Three fields, each earning its place: CURRENT authorises the change (there is
 * no session token, so the account id alone must not be enough), and CONFIRM
 * stands between a typo and a lockout only an account manager can undo.
 *
 * The rules below mirror the server so a bad password is caught before a round
 * trip; the server enforces them, and its message wins when the two disagree.
 */
const MIN_PASSWORD = 8;                       // mirrors MIN_PASSWORD in routes/auth.js
const BLANK_PASSWORDS = { current: "", next: "", confirm: "" };

function PasswordField({ label, value, onChange, reveal, disabled, autoComplete, inputRef }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</span>
      <input
        ref={inputRef}
        type={reveal ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder="••••••••"
        className="mt-1 w-full rounded-[10px] border border-line bg-[--color-input] px-3 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-donetxt focus:border-accent/50 disabled:opacity-50"
      />
    </label>
  );
}

function PasswordPanel({ userId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK_PASSWORDS);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => { if (open) firstRef.current?.focus(); }, [open]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErr("");
  };

  // Leaving drops what was typed — a half-entered password is not a draft.
  const close = () => { setForm(BLANK_PASSWORDS); setErr(""); setReveal(false); setOpen(false); };

  const filled = form.current && form.next && form.confirm;
  // Only once all three are filled — flagging a mismatch mid-typing is noise.
  const problem = !filled ? ""
    : form.next.length < MIN_PASSWORD ? `New password must be at least ${MIN_PASSWORD} characters.`
    : form.next === form.current ? "New password must be different from your current one."
    : form.next !== form.confirm ? "The two new passwords don't match."
    : "";

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !filled || problem) return;
    setBusy(true);
    setErr("");
    try {
      await AccountAPI.changePassword(userId, form.current, form.next);
      setSaved(true);
      close();
    } catch (e2) {
      setErr(e2.body?.error || e2.message);   // stays open so it can be corrected
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel reveal delay={0.12} className="px-6 py-5">
      <PanelTitle
        title="Password"
        hint="The password you sign in with. Changing it here updates it everywhere immediately."
        action={!open && (
          <button type="button" onClick={() => { setSaved(false); setOpen(true); }}
            className="flex items-center gap-1.5 rounded-full border border-line bg-[--color-glass] px-3 py-1.5 text-[11.5px] font-medium text-accent transition-colors hover:bg-accent/[0.06]">
            <KeyRound size={12} strokeWidth={2.2} /> Change password
          </button>
        )}
      />

      {open ? (
        <form onSubmit={submit} className="flex max-w-[420px] flex-col gap-3">
          <PasswordField label="Current password" value={form.current} onChange={set("current")}
            reveal={reveal} disabled={busy} autoComplete="current-password" inputRef={firstRef} />
          <PasswordField label="New password" value={form.next} onChange={set("next")}
            reveal={reveal} disabled={busy} autoComplete="new-password" />
          <PasswordField label="Confirm new password" value={form.confirm} onChange={set("confirm")}
            reveal={reveal} disabled={busy} autoComplete="new-password" />

          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-mute">At least {MIN_PASSWORD} characters.</span>
            <button type="button" onClick={() => setReveal((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-sub transition-colors hover:text-ink">
              {reveal ? <EyeOff size={12} /> : <Eye size={12} />} {reveal ? "Hide" : "Show"}
            </button>
          </div>

          {(problem || err) && <div className="text-[11.5px] text-red">{problem || err}</div>}

          <div className="flex items-center gap-1.5">
            <button type="submit" disabled={busy || !filled || !!problem}
              className="rounded-full bg-accent px-3.5 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
            <button type="button" onClick={close} disabled={busy}
              className="rounded-full border border-line px-3.5 py-1.5 text-[11.5px] font-medium text-sub transition-colors hover:text-ink disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <Subpanel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Current password</span>
            <span className="mt-1 block font-mono text-[15px] font-semibold tracking-[0.22em] text-ink">••••••••</span>
          </span>
          {saved && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-green">
              <Check size={13} strokeWidth={2.4} /> Updated — use it the next time you sign in.
            </span>
          )}
        </Subpanel>
      )}
    </Panel>
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
function AvatarUpload({ user, onSaved, openRef }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [broken, setBroken] = useState(false);
  // Shown the instant a file is picked, so the new photo appears while the
  // upload is still in flight instead of after a round trip.
  const [pending, setPending] = useState(null);

  const stored = AccountAPI.avatarUrl(user);
  // Falls back to the brand's logo when there is no personal photo — see
  // AccountAPI.brandLogoUrl for why the absence IS the choice rather than a
  // stored flag. `own` is tracked separately from `src` because the two differ
  // in what the controls should offer: with a personal photo you can remove it
  // (returning to the logo); on the logo there is nothing of yours to remove.
  const brandLogo = AccountAPI.brandLogoUrl(user);
  const own = pending || stored;
  const src = own || brandLogo;
  const show = !!src && !broken;
  const usingBrandLogo = !own && !!brandLogo && !broken;

  // Lets the completion panel's "Add" button open this picker directly.
  // Handing up the opener rather than having the caller reach for a DOM node
  // keeps the hidden <input> an implementation detail of this component.
  //
  // In an effect, not the render body: publishing the opener is a side effect,
  // and it closes over `busy` — so it has to be republished whenever that
  // changes or the guard would test a stale value.
  useEffect(() => {
    if (!openRef) return undefined;
    openRef.current = () => { if (!busy) inputRef.current?.click(); };
    return () => { openRef.current = null; };
  }, [openRef, busy]);

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
        title={usingBrandLogo ? "Upload your own photo" : "Change your profile photo"}
        className="relative flex size-[70px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-accent to-purple text-[24px] font-semibold text-white shadow-[0_10px_30px_rgba(44,62,126,0.35)] transition-transform duration-200 hover:scale-[1.03]">
        {/* A portrait should fill the frame (cover); a logo must not be cropped
            to it, so it is contained on white — a wordmark sliced down its
            middle reads as a rendering fault, not as a brand. */}
        {show
          ? <img src={src} alt="" onError={() => setBroken(true)}
              className={`absolute inset-0 size-full ${usingBrandLogo ? "bg-white object-contain p-2" : "object-cover"}`} />
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
            {own ? "Change photo" : "Upload your own"}
          </button>
          {/* Labelled "Use brand logo" rather than "Remove", because that is
              what it actually does when the brand has one — the two-way choice
              between your face and your company's mark, without a third state
              to keep in sync. */}
          {!!own && (
            <button type="button" disabled={busy} onClick={remove}
              className="rounded-full border border-line bg-[--color-glass] px-3 py-1 text-[11.5px] font-medium text-sub transition-colors hover:text-ink disabled:opacity-50">
              {brandLogo ? "Use brand logo" : "Remove"}
            </button>
          )}
          <span className={`text-[11px] ${err ? "text-red" : "text-mute"}`}>
            {err || (usingBrandLogo
              ? `Showing ${user?.clientName || "your brand"}'s logo · upload your own to replace it`
              : "Optional · PNG, JPEG or WebP · up to 2MB")}
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

  // The identity panel sits above the pane rail, so "Add a photo" from the
  // completion list has to scroll back up to it as well as open the picker —
  // firing the picker alone would leave the reader looking at a file dialog
  // with no idea which control opened it.
  const identityRef = useRef(null);
  const openPhotoPicker = useRef(null);
  const fixPhoto = () => {
    identityRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    openPhotoPicker.current?.();
  };

  /**
   * Saves one account field and folds the server's answer back into the
   * session, so the shell's avatar and greeting update without a reload.
   *
   * The response is merged, not the local draft: the backend trims the value
   * and recomputes the stored initials when the name changes, and those are
   * what the rest of the app renders.
   */
  const saveField = useCallback((key) => async (value) => {
    const updated = await AccountAPI.updateProfile(user.id, { [key]: value });
    updateUser({
      name: updated.name,
      title: updated.title,
      phone: updated.phone,
      avatar: updated.avatar,
    });
  }, [user?.id, updateUser]);

  // Email is the login identity — changing it here would let someone lock
  // themselves out of the portal, and the backend refuses it for that reason
  // (PORTAL_EDITABLE in routes/auth.js). Account ID and Member since aren't
  // profile fields at all: one is the record's primary key, the other is a
  // fact about when it was created.
  const account = [
    { label: "Full name", value: user?.name, onSave: saveField("name"), placeholder: "Your name" },
    { label: "Role", value: user?.title, onSave: saveField("title"), placeholder: "e.g. Marketing Head" },
    { label: "Email", value: user?.email, href: user?.email ? `mailto:${user.email}` : undefined,
      lockedReason: "Your email is your sign-in — your account manager changes it" },
    { label: "Phone", value: user?.phone, onSave: saveField("phone"), type: "tel", placeholder: "+91 98765 43210" },
    { label: "Account ID", value: user?.id, lockedReason: "Set by 5th Avenue" },
    { label: "Member since", value: user?.createdAt ? prettyDate(user.createdAt) : null, lockedReason: "Set by 5th Avenue" },
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

        {/* Identity header — the avatar here is the upload control.
            The ref lives on a wrapper because Panel is a plain function
            component: a ref passed to it would land in ...rest and never
            attach. */}
        <div ref={identityRef} className="scroll-mt-28">
          <Panel reveal className="mt-6 mb-5 px-7 py-6">
            <AvatarUpload user={user} onSaved={updateUser} openRef={openPhotoPicker} />
          </Panel>
        </div>

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
              <div className="flex flex-col gap-4">
                <ProfileCompletion user={user} onFixPhoto={fixPhoto} />
                <Panel reveal delay={0.06} className="px-6 py-5">
                  <PanelTitle title="Account" hint="Hover a field and hit Edit to change it. Locked fields are set by 5th Avenue." />
                  <FieldGrid fields={account} empty="No account details on file." />
                  <p className="mt-4 text-[11px] leading-relaxed text-mute">
                    Saved changes reach your 5th Avenue team straight away.
                  </p>
                </Panel>
                <PasswordPanel userId={user?.id} />
              </div>
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
