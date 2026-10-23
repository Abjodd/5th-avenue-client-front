/**
 * Fifth Avenue — Pitch Draft view (public, code-gated)
 * ─────────────────────────────────────────────────────────────────
 * The prospect-stage sibling of PitchApprove (../PitchApprove): a client
 * opens this from a link the team sends them (…/pitch-draft/:draftId?code=
 * XXXX) for a brand that isn't a real Fifth Avenue client yet. Same
 * access-code model, same approve/reject-then-save mechanic for candidate
 * creators — see that page's own top comment for why decisions are a draft
 * until "Save my choices", and 5th-internal-back/routes/pitchDrafts.js for
 * the backend contract.
 *
 * What's different from a real pitch link: there's a written brief and a
 * list of suggested reference content alongside the candidates, and the
 * display order here is deliberately Brief → Creators suggested →
 * Suggested Content — the brief sets the context, the candidates are the
 * main event, and the reference reels are supporting material at the end.
 * (The internal editor builds the same three sections in a different
 * order — brief, then suggested content, then candidates — because a team
 * member fills the candidate list last, after the brief is settled.)
 *
 * One link for the life of the pitch. Promoting the prospect into a real
 * brand and campaign does NOT close it: every candidate carries over to the
 * campaign, and decisions made here keep landing there. Each candidate locks
 * individually (`locked`) only once the team ships it — the card then shows
 * the final call ("Approved" / "Not selected") instead of the buttons.
 * `decidable` is page-level: is anything still open to decide?
 *
 * Redesign note: this page opts into `data-marketing` — the same scoped
 * palette + Instrument Serif/Sans + Jost type Login.jsx and the public
 * marketing site already use (see styles/index.css's "Marketing identity"
 * blocks). Every class already in use here (bg-page, text-ink/ink-2/ink-3,
 * bg-card, border-line, text-accent, …) is part of the shared vocabulary
 * both palettes draw from, so scoping the whole page over to it costs one
 * attribute rather than a rewrite — the same trick Login already relies on.
 * That gets a prospect-facing "pitch" the site's most polished, editorial
 * look (dark navy by default) instead of the portal's working-dashboard
 * cream, which is the more fitting register for something being pitched
 * rather than worked in daily.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Eye, Heart, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import { PitchDraftAPI } from "../../lib/api";
import { FALogo } from "../../components/primitives/FALogo";
import { AmbientBackground } from "../../components/motion/Motion";

export default function PitchDraftView() {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";

  const [state, setState] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [brand, setBrand] = useState(null);
  const [campaignName, setCampaignName] = useState(null);
  const [brief, setBrief] = useState([]);
  const [details, setDetails] = useState({});
  const [suggestedContent, setSuggestedContent] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [decidable, setDecidable] = useState(true);
  // Draft decisions keyed by profile id — same "nothing reaches the team
  // until Save" mechanic as PitchApprove.
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [reviewer, setReviewer] = useState(() => {
    try { return localStorage.getItem("5av_pitch_reviewer") || ""; } catch { return ""; }
  });

  const load = useCallback(() => {
    setState("loading");
    PitchDraftAPI.get(draftId, code)
      .then(({ brand: b, campaignName: cn, brief: br, details: dt, suggestedContent: sc, profiles: list, decidable: dec }) => {
        setBrand(b);
        setCampaignName(cn);
        setBrief(br || []);
        setDetails(dt || {});
        setSuggestedContent(sc || []);
        setProfiles(list || []);
        setDecidable(dec !== false);
        setDraft({});
        setState("ready");
      })
      .catch((err) => {
        setErrorMsg(err.body?.error || "This link isn't working right now.");
        setState("error");
      });
  }, [draftId, code]);

  useEffect(() => { load(); }, [load]);

  const pick = (profileId, status) => {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    setDraft((d) => {
      const next = { ...d };
      if (status === p.status) delete next[profileId];
      else next[profileId] = status;
      return next;
    });
  };

  const draftCount = Object.keys(draft).length;

  const saveChoices = async () => {
    const entries = Object.entries(draft);
    if (!entries.length) return;
    setSaving(true);
    setSaveMsg(null);
    const by = reviewer.trim() || undefined;
    try { localStorage.setItem("5av_pitch_reviewer", reviewer.trim()); } catch { /* ignore */ }
    let failed = 0;
    for (const [profileId, status] of entries) {
      try {
        const updated = await PitchDraftAPI.decide(draftId, profileId, code, status, by);
        setProfiles((list) => list.map((p) => (p.id === profileId ? { ...p, ...updated } : p)));
        setDraft((d) => { const next = { ...d }; delete next[profileId]; return next; });
      } catch {
        failed += 1;
      }
    }
    setSaving(false);
    setSaveMsg(failed ? `Sent the rest, but ${failed} didn't go through — try again.` : "Sent to your Fifth Avenue team.");
    setTimeout(() => setSaveMsg(null), 5000);
  };

  const displayStatus = useCallback((p) => draft[p.id] ?? p.status, [draft]);

  if (state === "loading") {
    return (
      <div data-marketing className="flex min-h-screen items-center justify-center bg-page">
        <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Loading…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div data-marketing className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-line bg-card shadow-card">
          <FALogo aria-hidden className="size-5 text-ink-2" />
        </div>
        <p className="font-mono text-eyebrow uppercase tracking-[0.16em] text-ink-3">Fifth Avenue</p>
        <h1 className="font-serif text-title-lg text-ink">{errorMsg}</h1>
        <p className="max-w-sm text-body text-ink-2">
          If you were sent this link, ask your Fifth Avenue contact to double-check it — a link can be replaced with a new one.
        </p>
      </div>
    );
  }

  return (
    <div data-marketing className="relative min-h-screen bg-page text-ink">
      <div className="fa-grain" aria-hidden />
      <AmbientBackground variant="b" />

      <PitchTopBar brandName={brand?.name} />

      <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-14 sm:px-9 sm:pb-40 sm:pt-20">
        <header className="mb-14 flex flex-col items-center text-center sm:mb-20">
          <p className="font-mono text-eyebrow uppercase tracking-[0.24em] text-ink-3">A private pitch</p>
          <h1 className="mt-4 max-w-2xl text-balance font-serif text-display-lg italic text-ink sm:text-display-2xl">
            A pitch for {brand?.name || "your brand"}.
          </h1>
          {campaignName && (
            <p className="mt-2 text-caption text-ink-3">{campaignName}</p>
          )}
          {decidable && profiles.length > 0 && (
            <>
              <p className="mx-auto mt-5 max-w-md text-body-lg text-ink-2">
                Take a look below, mark each candidate approved or not, then save your choices at the bottom — your team is notified the moment you do.
              </p>
              <label className="mt-8 flex w-full max-w-xs items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-label shadow-card sm:w-auto">
                <span className="shrink-0 text-ink-3">Reviewing as</span>
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-3 sm:w-36"
                />
              </label>
            </>
          )}
        </header>

        {/* The brief — the campaign's objective, audience and key messages,
            plus any freeform sections — the context for everything below. */}
        <BriefShowcase details={details} sections={brief} />

        {/* Creators suggested — the main event. */}
        {profiles.length > 0 && (
          <section className="mb-16 sm:mb-24">
            <SectionEyebrow>Creators suggested</SectionEyebrow>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3">
              {profiles.map((p) => (
                <PitchCard
                  key={p.id}
                  p={p}
                  status={displayStatus(p)}
                  dirty={draft[p.id] !== undefined}
                  decidable={decidable}
                  onPick={(status) => pick(p.id, status)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Suggested content — reference reels, supporting material, now a
            horizontal carousel rather than a static grid (scroll-snap +
            chevron controls) so a longer list doesn't just run the page on
            forever. Each link was snapshotted once via HikerAPI when the
            team added it (see the backend's fetchReelSnapshot), so most show
            a real preview rather than a bare URL — same as the internal
            editor. Tile treatment (9:16 frame, hover-scaled thumbnail,
            hover-played reel, bottom scrim with handle + stats) borrows the
            visual language of the campaign register (../assets.jsx's
            ReelTile) so this reads as the same product rather than a
            plainer afterthought tacked on the end of the page. */}
        {suggestedContent.length > 0 && (
          <section>
            <SectionEyebrow>Suggested content</SectionEyebrow>
            <ContentCarousel items={suggestedContent} />
          </section>
        )}

        {!hasBrief(details, brief) && profiles.length === 0 && suggestedContent.length === 0 && (
          <p className="text-center text-body text-ink-2">There's nothing here yet — check back soon.</p>
        )}
      </div>

      {decidable && profiles.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6 sm:px-5">
          <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-full border border-line bg-card/95 py-2.5 pl-4 pr-2.5 shadow-modal backdrop-blur sm:gap-4 sm:py-3 sm:pl-5 sm:pr-3">
            <span className="min-w-0 truncate text-[11px] text-ink-2 sm:text-caption">
              {saveMsg
                ? saveMsg
                : draftCount > 0
                  ? `${draftCount} change${draftCount === 1 ? "" : "s"} pending`
                  : "All caught up"}
            </span>
            <button
              type="button"
              onClick={saveChoices}
              disabled={draftCount === 0 || saving}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[12px] font-medium text-on-accent transition-opacity disabled:opacity-40 sm:px-5 sm:py-2.5 sm:text-label"
            >
              {saving ? "Sending…" : "Save my choices"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── The brief ────────────────────────────────────────────────────────────────
const hasBrief = (d, sections) =>
  !!(d?.objective || d?.audience || d?.messages || d?.service || d?.region || sections?.length);

// Lines typed as "1. …", "2) …", "- …" or "• …" read as a list; anything else
// as paragraphs. The team writes these in a plain textarea — this is what
// turns that into something that reads like a designed brief.
const LIST_MARK = /^(\d+[.)]|[-•*–])\s+/;
function BriefText({ text, large = false }) {
  const lines = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const isList = lines.length > 1 && lines.filter((l) => LIST_MARK.test(l)).length >= Math.ceil(lines.length / 2);
  const body = large
    ? "font-serif text-[clamp(20px,2.3vw,27px)] leading-[1.32] text-ink"
    : "text-body-lg leading-relaxed text-ink-2";
  if (!isList) {
    return <div className="flex flex-col gap-3">{lines.map((l, i) => <p key={i} className={body}>{l}</p>)}</div>;
  }
  return (
    <ol className={`flex flex-col ${large ? "gap-5" : "gap-3.5"}`}>
      {lines.map((l, i) => (
        <li key={i} className="flex gap-4 sm:gap-5">
          <span aria-hidden className={`shrink-0 font-serif italic tabular-nums text-ink-3 ${large ? "mt-1.5 w-6 text-[15px]" : "mt-1 w-5 text-[13px]"}`}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className={body}>{l.replace(LIST_MARK, "")}</span>
        </li>
      ))}
    </ol>
  );
}

function BriefLabel({ children }) {
  return (
    <p className="mb-5 flex items-center gap-3 font-mono text-eyebrow uppercase tracking-[0.2em] text-ink-3 sm:mb-6">
      <span aria-hidden className="h-px w-6 bg-line-strong" />
      {children}
    </p>
  );
}

function BriefShowcase({ details = {}, sections = [] }) {
  if (!hasBrief(details, sections)) return null;
  const { service, region, objective, audience, messages } = details;
  const tags = [["Service", service], ["Region", region]].filter(([, v]) => v);
  const both = audience && messages;
  // Each block draws a top rule only when something sits above it, so the
  // card never opens on a stray line whichever fields are filled in.
  const ruleIf = (cond) => (cond ? "border-t border-line" : "");
  const midRule = ruleIf(tags.length > 0 || objective);
  const notesRule = ruleIf(tags.length > 0 || objective || audience || messages);

  return (
    <section className="mx-auto mb-16 max-w-4xl sm:mb-24">
      <SectionEyebrow>The brief</SectionEyebrow>
      <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-card">
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 px-6 pb-1 pt-6 sm:pt-8">
            {tags.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">{k}</span>
                <span className="text-[12.5px] font-medium text-ink">{v}</span>
              </span>
            ))}
          </div>
        )}

        {objective && (
          <div className={`px-6 py-10 sm:px-14 sm:py-14 ${tags.length ? "pt-8 sm:pt-10" : ""}`}>
            <BriefLabel>Objective</BriefLabel>
            <BriefText text={objective} large />
          </div>
        )}

        {(audience || messages) && (
          <div className={`grid ${both ? "sm:grid-cols-2" : ""} ${midRule}`}>
            {audience && (
              <div className={`px-6 py-9 sm:px-12 sm:py-11 ${both ? "sm:border-r sm:border-line" : ""}`}>
                <BriefLabel>Audience</BriefLabel>
                <BriefText text={audience} />
              </div>
            )}
            {messages && (
              <div className={`px-6 py-9 sm:px-12 sm:py-11 ${both ? "border-t border-line sm:border-t-0" : ""}`}>
                <BriefLabel>Key messages</BriefLabel>
                <BriefText text={messages} />
              </div>
            )}
          </div>
        )}

        {sections.length > 0 && (
          <div className={`divide-y divide-line px-6 sm:px-14 ${notesRule}`}>
            {sections.map((s) => (
              <div key={s.id} className="py-9 sm:py-11">
                <BriefLabel>{s.heading || "Notes"}</BriefLabel>
                <BriefText text={s.body} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// The page's own masthead — fixed-bar visual language borrowed from the
// public marketing site's own <Nav/> (border-b, wordmark, same height
// rhythm), simplified down to just brand identity plus who this pitch is
// for, since none of that Nav's links (Home/Regional/Tech, Client Login)
// make sense on a link a prospect who has never signed in opens once.
function PitchTopBar({ brandName }) {
  return (
    <header className="relative border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[76px] sm:px-9">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-card sm:size-10">
            <FALogo aria-hidden className="size-[15px] text-ink sm:size-[18px]" />
          </span>
          <span className="font-sans text-[14px] font-light uppercase leading-none tracking-[0.3em] text-ink sm:text-[18px] sm:tracking-[0.34em]">
            Fifth Avenue
          </span>
        </div>
        {brandName && (
          <span className="hidden items-center rounded-full border border-line bg-card px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3 sm:inline-flex">
            Prepared for&nbsp;<span className="font-semibold text-ink">{brandName}</span>
          </span>
        )}
      </div>
    </header>
  );
}

// A section heading flanked by hairlines rather than a bare label — a small,
// cheap upgrade that reads as considered rather than as a leftover
// dashboard convention, on a page that otherwise sells the work rather than
// operating it.
function SectionEyebrow({ children }) {
  return (
    <div className="mb-7 flex items-center justify-center gap-3 sm:mb-9">
      <span aria-hidden className="h-px w-8 bg-line-strong sm:w-12" />
      <p className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-3">{children}</p>
      <span aria-hidden className="h-px w-8 bg-line-strong sm:w-12" />
    </div>
  );
}

function PitchCard({ p, status, dirty, decidable, onPick }) {
  // Per candidate: locked once the team has shipped it (or the pitch closed
  // for it) — never a blanket lock just because the pitch was promoted.
  const locked = !!p.locked || !decidable;
  const finalLabel = status === "approved" ? "Approved" : status === "rejected" ? "Not selected" : "Closed";
  // A view-count of exactly 0 is the stale HikerAPI artefact from before the
  // media-type fix (photo/carousel posts reported play_count: 0 rather than
  // omitting the field) — treat it the same as "no data" rather than
  // printing a misleading zero. Same guard as PitchApprove's own card.
  const avgViews = p.avgViews > 0 ? p.avgViews : null;
  const [avatarBroken, setAvatarBroken] = useState(false);
  // A photo under 300px wide is Instagram's small thumbnail: stretched over
  // the whole portrait it goes visibly soft. Shown instead as a crisp round
  // portrait near its natural size, over a blurred wash of itself — so a
  // low-resolution photo still reads as intentional, never as blurry.
  const [lowRes, setLowRes] = useState(false);
  const avatarSrc = p.avatar && !avatarBroken ? PitchDraftAPI.avatarUrl(p.avatar) : null;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card transition-shadow hover:shadow-float">
      {dirty && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-accent shadow-pop">
          Unsaved
        </span>
      )}

      {/* Portrait — a real photo banner rather than a small centered
          avatar, with name/handle overlaid the same way a reel's caption
          sits over SuggestedContentCard below, so the two card families on
          this page read as one visual system rather than two. */}
      <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-well">
        {avatarSrc && lowRes ? (
          <>
            <img src={avatarSrc} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover blur-2xl brightness-75" />
            <div className="absolute inset-x-0 top-[14%] flex justify-center">
              <img
                src={avatarSrc}
                alt=""
                className="size-36 rounded-full object-cover shadow-float ring-4 ring-white/85 transition-transform duration-500 ease-out group-hover:scale-105 sm:size-40"
              />
            </div>
          </>
        ) : avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onLoad={(e) => { if (e.currentTarget.naturalWidth < 300) setLowRes(true); }}
            onError={() => setAvatarBroken(true)}
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-accent-muted font-serif text-display-lg italic text-accent">
            {(p.name || p.handle || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 46%, rgba(0,0,0,0) 68%)" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="flex items-center gap-1.5">
            <span className="max-w-[85%] truncate font-serif text-title italic text-white">{p.name || p.handle}</span>
            {p.isVerified && (
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-white" aria-label="Verified">
                <path d="M12 2 14.5 4.5 18 4 18.5 7.5 22 9 20.5 12 22 15 18.5 16.5 18 20 14.5 19.5 12 22 9.5 19.5 6 20 5.5 16.5 2 15 3.5 12 2 9 5.5 7.5 6 4 9.5 4.5Z" />
              </svg>
            )}
          </div>
          <a
            href={`https://instagram.com/${encodeURIComponent(p.handle)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="pointer-events-auto text-caption text-white/75 transition-colors hover:text-white hover:underline"
          >
            @{p.handle}
          </a>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-5 text-center sm:px-6 sm:pb-6">
        {/* Fixed-height, always-reserved — same reasoning as PitchApprove's
            own card: a short bio doesn't stretch the box, a long one scrolls
            in place, so every card in the grid lines up. */}
        <div className="h-14 w-full shrink-0 overflow-y-auto text-caption leading-relaxed text-ink-2 [scrollbar-width:thin]">
          {p.bio ? <p className="whitespace-pre-wrap">{p.bio}</p> : <p className="text-ink-3">No bio</p>}
        </div>

        <div className="mt-4 grid w-full grid-cols-3 gap-x-2 gap-y-4 border-y border-line py-4">
          <Stat label="Followers" value={fmtCompact(p.followers)} />
          <Stat label="Following" value={fmtCompact(p.following)} />
          <Stat label="Posts" value={fmtCompact(p.posts)} />
          <Stat label="Avg likes" value={fmtCompact(p.avgLikes)} />
          <Stat label="Avg views" value={avgViews != null ? fmtCompact(avgViews) : "—"} />
          <Stat label="Eng. rate" value={p.avgER != null ? `${(+p.avgER).toFixed(1)}%` : "—"} />
        </div>

        <div className="mt-auto flex w-full flex-col items-center pt-4">
          {locked ? (
            <div className={`flex items-center gap-1.5 py-2.5 text-caption font-medium ${status === "approved" ? "text-success" : "text-ink-3"}`}>
              {status === "approved" && (
                <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                </svg>
              )}
              {finalLabel}
            </div>
          ) : (
            <div className="flex w-full overflow-hidden rounded-full border border-line">
              <button
                type="button"
                onClick={() => onPick("rejected")}
                className={`flex-1 border-r border-line py-2.5 text-label font-medium transition-colors ${
                  status === "rejected" ? "bg-danger text-white" : "text-ink-2 hover:bg-danger-muted hover:text-danger"
                }`}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => onPick("approved")}
                className={`flex-1 py-2.5 text-label font-medium transition-colors ${
                  status === "approved" ? "bg-success text-white" : "text-ink-2 hover:bg-success-muted hover:text-success"
                }`}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// A horizontal, snap-scrolling rail rather than a static grid — a real
// carousel (drag/scroll + chevron controls) instead of a wall of tiles that
// just keeps growing the page. Scrollbar hidden via inline utility classes
// (no global CSS added) since this is the one place on the page that needs
// it.
function ContentCarousel({ items }) {
  const trackRef = useRef(null);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.9, 640), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((c) => (
          <div key={c.id} className="w-[44vw] shrink-0 snap-start sm:w-[210px] lg:w-[236px]">
            <SuggestedContentTile c={c} />
          </div>
        ))}
      </div>
      {items.length > 2 && (
        <>
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByPage(-1)}
            className="absolute left-0 top-[40%] hidden size-9 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card/90 text-ink shadow-pop backdrop-blur transition-colors hover:bg-hover sm:flex"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByPage(1)}
            className="absolute right-0 top-[40%] hidden size-9 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card/90 text-ink shadow-pop backdrop-blur transition-colors hover:bg-hover sm:flex"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}

// Wraps the tile with whatever text doesn't belong inside it: the caption
// (kept legible at rest rather than only in a hover scrim, since this page
// has no lightbox to read it in afterward) and the team's own note, which
// stays a plain line underneath rather than folded into the hover state —
// it's the team talking to the client, not a fact about the post.
function SuggestedContentTile({ c }) {
  const m = c.media;
  return (
    <div className="flex flex-col gap-2">
      <SuggestedContentCard c={c} />
      {(m?.caption || c.note) && (
        <div className="flex flex-col gap-1 px-0.5">
          {m?.caption && <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-2">{m.caption}</p>}
          {c.note && <p className="text-[11px] italic text-ink-3">{c.note}</p>}
        </div>
      )}
    </div>
  );
}

function SuggestedContentCard({ c }) {
  const m = c.media;
  const [hovered, setHovered] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  // Our stored copy of the frame first (served by the backend, never
  // expires); the signed Instagram thumbnail only for links added before
  // posters were stored — and if that has expired, fall back to the link.
  const imageSrc = m?.poster ? PitchDraftAPI.avatarUrl(m.poster) : m?.thumbnail || null;
  const showImage = !!imageSrc && !imgBroken;
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  // Only a reel carries a playable video; a photo/carousel post never does.
  // Snapshots are taken once, at add-time (see fetchReelSnapshot), so by the
  // time a client opens this link the signed video URL may well have
  // expired — videoExpiresAt says so, and playback is skipped rather than
  // handed a dead link. The thumbnail still works regardless.
  const isReel = m?.kind === "reel";
  const canPlay = isReel && !!m?.video && (!m.videoExpiresAt || Date.parse(m.videoExpiresAt) > Date.now());

  useEffect(() => {
    if (!hovered) setPlaying(false);
    const video = videoRef.current;
    if (!video) return;
    if (hovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered]);

  const stats = [
    m?.views != null && [Eye, fmtCompact(m.views)],
    m?.likes != null && [Heart, fmtCompact(m.likes)],
  ].filter(Boolean);

  return (
    <a
      href={m?.permalink || c.url}
      target="_blank"
      rel="noreferrer noopener"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative block overflow-hidden rounded-xl bg-black shadow-card transition-shadow hover:shadow-float"
      style={{ aspectRatio: "9 / 16" }}
    >
      {showImage ? (
        <>
          <img
            src={imageSrc}
            alt=""
            onError={() => setImgBroken(true)}
            className={`size-full object-cover transition-transform duration-500 ease-out ${hovered ? "scale-105" : "scale-100"}`}
          />
          {canPlay && hovered && (
            <video
              ref={videoRef}
              src={m.video}
              poster={imageSrc}
              muted
              loop
              playsInline
              preload="none"
              onCanPlay={() => setPlaying(true)}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"}`}
            />
          )}
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-70"}`}
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 42%, rgba(0,0,0,0) 62%)" }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
            {m.username && <div className="truncate font-serif text-[13px] italic text-white">@{m.username}</div>}
            {stats.length > 0 && (
              <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] font-medium text-white/90">
                {stats.map(([Icon, value], i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <Icon size={11} strokeWidth={2.2} /> {value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-well px-4 text-center text-ink-3">
          <Link2 size={20} />
          <span className="line-clamp-2 break-all text-[11px] text-accent">{c.url}</span>
        </div>
      )}
    </a>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-label font-semibold text-ink">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-ink-3">{label}</span>
    </div>
  );
}

function fmtCompact(v) {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(v);
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
