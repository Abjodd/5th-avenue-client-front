/**
 * Consultant portal — the dashboard (/consultant). Only for consultants:
 * a separate sign-in, a separate session and its own look (consultant.css).
 *
 * Everything shown is the record the Fifth Avenue team keeps in the internal
 * app (Services → Consultant), read through the consultant's own token. Two
 * things can be changed from here, and both show up internally at once:
 *   · the profile picture
 *   · documents — uploaded here, listed internally as "From their portal"
 * The rest (billing, tax, contacts, brands, UGC creators) is kept by the team;
 * the profile page says so and who to ask.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutGrid, UserRound, Tags, Users, Clapperboard, FolderOpen, LogOut, Upload, ExternalLink, Download,
  Trash2, Camera, Mail, Phone, Loader2, ShieldCheck, Building2, Receipt, Landmark, IdCard,
} from "lucide-react";
import { ConsultantAPI, SessionEnded, clearSession, getSession } from "./consultantApi";
import { compressAvatar, AVATAR_ACCEPT } from "../lib/avatar";
import "./consultant.css";

const VIEWS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "brands", label: "Brands", icon: Tags },
  { id: "team", label: "Team", icon: Users },
  { id: "ugc", label: "UGC creators", icon: Clapperboard },
  { id: "documents", label: "Documents", icon: FolderOpen },
];
const MAX_FILE = 3 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
const initials = (s) => String(s || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtSize = (b) => (b == null ? "" : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
const inr = (n) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);
const readAsDataUri = (file) => new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => bad(fr.error); fr.readAsDataURL(file); });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function Picture({ me, size = 56, radius = 16 }) {
  const [broken, setBroken] = useState(false);
  const url = !broken && ConsultantAPI.pictureUrl(me);
  return url
    ? <img src={url} alt="" onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", border: "1px solid var(--cx-line-2)", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: radius, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        background: "linear-gradient(135deg, rgba(233,162,59,0.32), rgba(233,162,59,0.08))", color: "var(--cx-accent)", fontWeight: 600, fontSize: size / 2.8, border: "1px solid rgba(233,162,59,0.35)" }}>{initials(me?.name)}</span>;
}

function BrandMark({ b, size = 40 }) {
  const [broken, setBroken] = useState(false);
  const url = !broken && ConsultantAPI.brandLogoUrl(b);
  return url
    ? <img src={url} alt="" onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", background: "#fff", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--cx-raised)", color: "var(--cx-text)", fontWeight: 600, fontSize: size / 2.6, border: "1px solid var(--cx-line)", flexShrink: 0 }}>{initials(b.name)}</span>;
}

const Title = ({ eyebrow, children, aside }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
    <div>
      {eyebrow && <div className="cx-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
      <h1 className="cx-serif" style={{ fontSize: "clamp(32px, 4vw, 44px)", margin: 0, lineHeight: 1.05 }}>{children}</h1>
    </div>
    {aside && <div style={{ marginLeft: "auto" }}>{aside}</div>}
  </div>
);
const Empty = ({ children }) => <div className="cx-card" style={{ padding: "36px 24px", textAlign: "center", color: "var(--cx-mute)" }}>{children}</div>;
const Fact = ({ k, v, mono }) => (
  <div className="cx-fact"><div className="k">{k}</div><div className={`v${mono && v ? " cx-mono" : ""}`} style={mono && v ? { fontSize: 13.5, letterSpacing: "0.02em" } : undefined}>{v || <span style={{ color: "var(--cx-mute)" }}>Not added yet</span>}</div></div>
);

// ── views ───────────────────────────────────────────────────────────────────
function Overview({ me, docs, go }) {
  const stats = [
    { id: "brands", label: "Brands", n: me.brands.length },
    { id: "team", label: "People", n: (me.primaryContact?.name ? 1 : 0) + (me.pocs || []).length },
    { id: "ugc", label: "UGC creators", n: (me.ugcCreators || []).filter((u) => u.status !== "paused").length, sub: "active" },
    { id: "documents", label: "Documents", n: docs?.length ?? "…" },
  ];
  return (
    <div className="cx-fade-in">
      <div className="cx-card" style={{ padding: "28px 30px", marginBottom: 18, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap",
        background: "radial-gradient(90% 140% at 100% 0%, rgba(233,162,59,0.16), rgba(233,162,59,0) 60%), var(--cx-card)" }}>
        <Picture me={me} size={72} radius={20} />
        <div style={{ minWidth: 0 }}>
          <div className="cx-eyebrow">{greeting()}, {me.signedInAs?.name?.split(" ")[0] || "there"}</div>
          <h1 className="cx-serif" style={{ fontSize: "clamp(34px, 4.4vw, 50px)", margin: "6px 0 4px", lineHeight: 1.02 }}>{me.name}</h1>
          <div style={{ color: "var(--cx-sub)" }}>{[me.email, me.hq?.address].filter(Boolean).join(" · ")}</div>
        </div>
        <span className="cx-chip green" style={{ marginLeft: "auto" }}><ShieldCheck size={13} /> Active with Fifth Avenue</span>
      </div>

      <div className="cx-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", marginBottom: 26 }}>
        {stats.map((s) => (
          <button key={s.id} onClick={() => go(s.id)} className="cx-card" style={{ padding: "18px 20px", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
            <div className="cx-serif" style={{ fontSize: 44, lineHeight: 1, color: "var(--cx-text)" }}>{s.n}</div>
            <div style={{ color: "var(--cx-sub)", marginTop: 8 }}>{s.label}{s.sub ? <span style={{ color: "var(--cx-mute)" }}> · {s.sub}</span> : null}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="cx-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <div className="cx-eyebrow">Your brands</div>
            <button className="cx-btn cx-btn-sm" style={{ marginLeft: "auto" }} onClick={() => go("brands")}>View all</button>
          </div>
          {me.brands.length === 0 ? <div style={{ color: "var(--cx-mute)" }}>No brands assigned yet.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {me.brands.slice(0, 5).map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12 }}><BrandMark b={b} size={34} /><span style={{ fontSize: 15 }}>{b.name}</span></div>
              ))}
            </div>
          )}
        </section>
        <section className="cx-card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <div className="cx-eyebrow">Latest documents</div>
            <button className="cx-btn cx-btn-sm" style={{ marginLeft: "auto" }} onClick={() => go("documents")}>Upload</button>
          </div>
          {!docs ? <div style={{ color: "var(--cx-mute)" }}>Loading…</div> : docs.length === 0 ? <div style={{ color: "var(--cx-mute)" }}>No documents yet.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {docs.slice(0, 4).map((d) => (
                <a key={d.id} href={ConsultantAPI.fileUrl(d.id)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                  <span className="cx-mono" style={{ fontSize: 10.5, color: "var(--cx-accent)", width: 38, textAlign: "center" }}>{(d.type || "FILE").toUpperCase().slice(0, 4)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block" }}>{d.name}</span><span style={{ fontSize: 12, color: "var(--cx-mute)" }}>{fmtDate(d.uploadedAt)}</span></span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Profile({ me, onPicture }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try { await onPicture(await compressAvatar(file)); setMsg({ ok: true, text: "Picture updated — Fifth Avenue sees it too." }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => { setBusy(true); try { await onPicture(null); setMsg({ ok: true, text: "Picture removed." }); } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const sections = [
    { icon: Building2, title: "Basic", rows: [["Name", me.name], ["Email", me.email]] },
    { icon: Receipt, title: "Billing", rows: [["GST number", me.billing?.gstNumber, true], ["Billing address", me.billing?.address], ["Billing GST", me.billing?.gst, true], ["Billing email", me.billing?.email]] },
    { icon: Landmark, title: "Head office", rows: [["HQ address", me.hq?.address], ["HQ GST", me.hq?.gst, true]] },
    { icon: IdCard, title: "Tax", rows: [["TIN", me.tax?.tin, true], ["PAN", me.tax?.pan, true]] },
  ];
  return (
    <div className="cx-fade-in">
      <Title eyebrow="Profile">Your details</Title>
      <div className="cx-card" style={{ padding: 24, marginBottom: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Picture me={me} size={88} radius={24} />
          <button onClick={() => input.current?.click()} disabled={busy} aria-label="Change picture"
            style={{ position: "absolute", right: -6, bottom: -6, width: 34, height: 34, borderRadius: "50%", border: "2px solid var(--cx-card)", background: "var(--cx-accent)", color: "var(--cx-accent-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {busy ? <Loader2 size={15} className="cx-spin" /> : <Camera size={15} />}
          </button>
          <input ref={input} type="file" accept={AVATAR_ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} data-testid="picture-input" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Profile picture</div>
          <div style={{ color: "var(--cx-sub)", marginTop: 4 }}>PNG, JPEG or WebP, up to 2MB. Fifth Avenue's team sees the same picture.</div>
          {msg && <div style={{ marginTop: 8, fontSize: 13.5, color: msg.ok ? "var(--cx-green)" : "var(--cx-red)" }}>{msg.text}</div>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="cx-btn cx-btn-primary cx-btn-sm" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} /> {me.hasAvatar ? "Change" : "Upload"}</button>
          {me.hasAvatar && <button className="cx-btn cx-btn-sm" disabled={busy} onClick={remove}>Remove</button>}
        </div>
      </div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {sections.map((s) => (
          <section key={s.title} className="cx-card" style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}><s.icon size={16} color="var(--cx-accent)" /><span className="cx-eyebrow" style={{ color: "var(--cx-sub)" }}>{s.title}</span></div>
            {s.rows.map(([k, v, mono]) => <Fact key={k} k={k} v={v} mono={mono} />)}
          </section>
        ))}
      </div>
      <p style={{ color: "var(--cx-mute)", marginTop: 18, fontSize: 13.5 }}>Something out of date? Your Fifth Avenue manager updates these details for you.</p>
    </div>
  );
}

function Brands({ me }) {
  return (
    <div className="cx-fade-in">
      <Title eyebrow="Brands" aside={<span className="cx-chip">{me.brands.length} brand{me.brands.length === 1 ? "" : "s"}</span>}>Brands you run with us</Title>
      {me.brands.length === 0 ? <Empty>No brands assigned yet — your Fifth Avenue manager will add them.</Empty> : (
        <div className="cx-grid">
          {me.brands.map((b) => (
            <div key={b.id} className="cx-card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <BrandMark b={b} size={48} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 500 }}>{b.name}</div>
                {b.website && <a href={b.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--cx-sub)" }}>{b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ color: "var(--cx-mute)", marginTop: 18, fontSize: 13.5 }}>Adding new brands yourself is coming soon.</p>
    </div>
  );
}

function Person({ p, tag }) {
  return (
    <div className="cx-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--cx-raised)", color: "var(--cx-text)", fontWeight: 600 }}>{initials(p.name)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{p.name || "—"}</div>
          <div style={{ color: "var(--cx-sub)", fontSize: 13.5 }}>{p.designation || ""}</div>
        </div>
        {tag && <span className="cx-chip accent" style={{ marginLeft: "auto" }}>{tag}</span>}
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, color: "var(--cx-sub)", fontSize: 14 }}>
        {p.email && <a href={`mailto:${p.email}`} style={{ display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none" }}><Mail size={14} />{p.email}</a>}
        {p.phone && <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Phone size={14} />{p.phone}</span>}
      </div>
    </div>
  );
}
function Team({ me }) {
  const has = me.primaryContact?.name || (me.pocs || []).length;
  return (
    <div className="cx-fade-in">
      <Title eyebrow="Team">Your people on our records</Title>
      {!has ? <Empty>No contacts on record yet.</Empty> : (
        <div className="cx-grid">
          {me.primaryContact?.name && <Person p={me.primaryContact} tag="Primary contact" />}
          {(me.pocs || []).map((p) => <Person key={p._id} p={p} tag="POC" />)}
        </div>
      )}
    </div>
  );
}

function Ugc({ me }) {
  const list = me.ugcCreators || [];
  return (
    <div className="cx-fade-in">
      <Title eyebrow="UGC" aside={<span className="cx-chip green">{list.filter((u) => u.status !== "paused").length} active</span>}>Your dedicated UGC creators</Title>
      {list.length === 0 ? <Empty>No UGC creators dedicated to you yet.</Empty> : (
        <div className="cx-grid">
          {list.map((u) => (
            <div key={u._id} className="cx-card" style={{ padding: 20, opacity: u.status === "paused" ? 0.7 : 1 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 500 }}>{u.name || u.handle}</div>
                  <div style={{ color: "var(--cx-sub)", fontSize: 13.5 }}>{[u.handle, u.platform].filter(Boolean).join(" · ")}</div>
                </div>
                <span className={`cx-chip ${u.status === "paused" ? "" : "green"}`} style={{ marginLeft: "auto" }}>{u.status === "paused" ? "Paused" : "Active"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 16 }}>
                <span className="cx-serif" style={{ fontSize: 30 }}>{inr(u.rate)}</span><span style={{ color: "var(--cx-mute)", fontSize: 13 }}>per piece</span>
              </div>
              {u.notes && <p style={{ color: "var(--cx-sub)", fontSize: 13.5, lineHeight: 1.55, margin: "10px 0 0" }}>{u.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Documents({ docs, setDocs }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const input = useRef(null);
  const choose = (f) => {
    setMsg(null);
    if (!f) return setFile(null);
    if (f.size > MAX_FILE) { setFile(null); return setMsg({ ok: false, text: `${f.name} is ${fmtSize(f.size)} — files must be 3MB or smaller.` }); }
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };
  const upload = async () => {
    if (!name.trim()) return setMsg({ ok: false, text: "Give the document a name." });
    if (!file) return setMsg({ ok: false, text: "Choose a file." });
    setBusy(true); setMsg(null);
    try {
      const d = await ConsultantAPI.upload({ name: name.trim(), filename: file.name, file: await readAsDataUri(file) });
      setDocs((x) => [d, ...(x || [])]); setName(""); setFile(null); if (input.current) input.current.value = "";
      setMsg({ ok: true, text: `${d.name} uploaded — Fifth Avenue can see it now.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async (d) => {
    try { await ConsultantAPI.removeDocument(d.id); setDocs((x) => x.filter((y) => y.id !== d.id)); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <div className="cx-fade-in">
      <Title eyebrow="Documents">Documents</Title>
      <div className="cx-card" style={{ padding: 22, marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Upload a document</div>
        <div style={{ color: "var(--cx-sub)", fontSize: 13.5, marginBottom: 16 }}>Agreements, GST or PAN certificates, invoices — PDF, images, Word or Excel, up to 3MB. It goes straight to your Fifth Avenue team.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="cx-input plain" value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name, e.g. GST certificate" style={{ flex: "2 1 220px", height: 42 }} />
          <label className="cx-btn" style={{ flex: "1 1 180px", height: 42, overflow: "hidden" }}>
            <FolderOpen size={15} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? file.name : "Choose file"}</span>
            <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => choose(e.target.files?.[0])} data-testid="doc-input" />
          </label>
          <button className="cx-btn cx-btn-primary" disabled={busy || !file} onClick={upload} style={{ height: 42 }}>{busy ? <Loader2 size={16} className="cx-spin" /> : <Upload size={16} />} Upload</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13.5, color: msg.ok ? "var(--cx-green)" : "var(--cx-red)" }}>{msg.text}</div>}
      </div>
      {!docs ? <Empty>Loading documents…</Empty> : docs.length === 0 ? <Empty>No documents yet.</Empty> : (
        <div className="cx-card" style={{ overflow: "hidden" }}>
          {docs.map((d, i) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: i ? "1px solid var(--cx-line)" : "none", flexWrap: "wrap" }}>
              <span className="cx-mono" style={{ width: 44, height: 44, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--cx-accent-soft)", color: "var(--cx-accent)", fontSize: 11 }}>{(d.type || "FILE").toUpperCase().slice(0, 4)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15 }}>{d.name}</div>
                <div style={{ color: "var(--cx-mute)", fontSize: 12.5 }}>{[fmtSize(d.size), fmtDate(d.uploadedAt), d.source === "portal" ? `uploaded by ${d.uploadedBy || "you"}` : "from Fifth Avenue"].filter(Boolean).join(" · ")}</div>
              </div>
              <a className="cx-btn cx-btn-sm" href={ConsultantAPI.fileUrl(d.id)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
              <a className="cx-btn cx-btn-sm" href={ConsultantAPI.fileUrl(d.id, true)}><Download size={14} /></a>
              {d.source === "portal" && <button className="cx-btn cx-btn-sm" onClick={() => remove(d)} aria-label={`Delete ${d.name}`}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── the page ────────────────────────────────────────────────────────────────
export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find((v) => v.id === params.get("view"))?.id || "overview";
  const go = useCallback((id) => { setParams(id === "overview" ? {} : { view: id }); window.scrollTo({ top: 0 }); }, [setParams]);
  const [me, setMe] = useState(null);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const session = getSession();

  const ended = useCallback((e) => {
    if (e instanceof SessionEnded) navigate("/consultant/login", { replace: true });
    else setError(e.message);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    document.title = "Consultant Studio · Fifth Avenue";
    ConsultantAPI.me().then(setMe).catch(ended);
    ConsultantAPI.documents().then(setDocs).catch(ended);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPicture = useCallback(async (dataUri) => {
    try { setMe(await ConsultantAPI.setPicture(dataUri)); }
    catch (e) { if (e instanceof SessionEnded) ended(e); throw e; }
  }, [ended]);

  const counts = useMemo(() => me && ({
    brands: me.brands.length, team: (me.primaryContact?.name ? 1 : 0) + (me.pocs || []).length,
    ugc: (me.ugcCreators || []).length, documents: docs?.length,
  }), [me, docs]);

  if (!session) return <Navigate to="/consultant/login" replace />;
  const signOut = () => { clearSession(); navigate("/consultant/login", { replace: true }); };

  return (
    <div className="cx">
      <div className="cx-shell">
        <aside className="cx-side">
          <div>
            <div className="cx-eyebrow" style={{ color: "var(--cx-accent)" }}>Fifth Avenue</div>
            <div className="cx-serif" style={{ fontSize: 26, marginTop: 4 }}>Consultant Studio</div>
          </div>
          <nav className="cx-nav" aria-label="Sections">
            {VIEWS.map((v) => (
              <button key={v.id} className={v.id === view ? "on" : ""} onClick={() => go(v.id)} aria-current={v.id === view ? "page" : undefined}>
                <v.icon size={17} /> {v.label}
                {counts && counts[v.id] != null && <span className="count">{counts[v.id]}</span>}
              </button>
            ))}
          </nav>
          <div className="cx-side-foot" style={{ marginTop: "auto" }}>
            {me && (
              <div className="cx-side-who" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 4px", borderTop: "1px solid var(--cx-line)" }}>
                <Picture me={me} size={36} radius={11} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.signedInAs?.name || me.name}</div>
                  <div style={{ fontSize: 12, color: "var(--cx-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
                </div>
              </div>
            )}
            <button className="cx-btn cx-btn-sm" onClick={signOut} style={{ width: "100%" }}><LogOut size={14} /> Sign out</button>
          </div>
        </aside>

        <main className="cx-main">
          {error && <Empty>Couldn't load your studio: {error}</Empty>}
          {!error && !me && <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--cx-sub)" }}><Loader2 size={18} className="cx-spin" /> Loading your studio…</div>}
          {me && view === "overview" && <Overview me={me} docs={docs} go={go} />}
          {me && view === "profile" && <Profile me={me} onPicture={onPicture} />}
          {me && view === "brands" && <Brands me={me} />}
          {me && view === "team" && <Team me={me} />}
          {me && view === "ugc" && <Ugc me={me} />}
          {me && view === "documents" && <Documents docs={docs} setDocs={setDocs} />}
        </main>
      </div>
      <style>{`@media (max-width: 820px) { .cx-mobile-out { display: inline-flex !important; } }`}</style>
      <button className="cx-btn cx-btn-sm cx-mobile-out" onClick={signOut} style={{ display: "none", position: "fixed", top: 14, right: 16, zIndex: 20 }}><LogOut size={14} /> Sign out</button>
    </div>
  );
}
