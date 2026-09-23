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
 * Once the internal team promotes this prospect into a real brand and
 * campaign, `decidable` comes back false: the page still renders (an old
 * link shouldn't go dead), but Approve/Reject are replaced with a quiet
 * "Moved forward" note, since the decision has already been acted on.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Eye, Heart, Link2 } from "lucide-react";
import { PitchDraftAPI } from "../../lib/api";
import { FALogo } from "../../components/primitives/FALogo";

export default function PitchDraftView() {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";

  const [state, setState] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [brand, setBrand] = useState(null);
  const [campaignName, setCampaignName] = useState(null);
  const [brief, setBrief] = useState([]);
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
      .then(({ brand: b, campaignName: cn, brief: br, suggestedContent: sc, profiles: list, decidable: dec }) => {
        setBrand(b);
        setCampaignName(cn);
        setBrief(br || []);
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
      <div className="flex min-h-screen items-center justify-center bg-page">
        <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">Loading…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-line bg-card shadow-sm">
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
    <div className="min-h-screen bg-page px-4 pb-28 pt-12 text-ink sm:px-9 sm:pb-36 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-col items-center text-center sm:mb-14">
          <div className="mb-5 flex size-11 items-center justify-center rounded-full border border-line bg-card shadow-sm sm:size-12">
            <FALogo aria-hidden className="size-5 text-ink" />
          </div>
          <p className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-3">Fifth Avenue</p>
          <h1 className="mt-4 max-w-xl text-balance font-serif text-title-lg text-ink sm:text-[32px]">
            A pitch for {brand?.name || "your brand"}
          </h1>
          {campaignName && (
            <p className="mt-1 text-caption text-ink-3">{campaignName}</p>
          )}
          {decidable && profiles.length > 0 && (
            <>
              <p className="mx-auto mt-4 max-w-md text-body text-ink-2">
                Take a look below, mark each candidate approved or not, then save your choices at the bottom — your team is notified the moment you do.
              </p>
              <label className="mt-7 flex w-full max-w-xs items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-label shadow-sm sm:w-auto">
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

        {/* Brief — freeform heading/text sections, the context for everything below. */}
        {brief.length > 0 && (
          <section className="mx-auto mb-14 max-w-3xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <p className="font-mono text-eyebrow uppercase tracking-[0.18em] text-ink-3">The brief</p>
            </div>
            <div className="flex flex-col gap-8 rounded-2xl border border-line bg-card px-6 py-7 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:px-9 sm:py-9">
              {brief.map((s) => (
                <div key={s.id}>
                  <h2 className="font-serif text-label font-semibold text-ink">{s.heading || "—"}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-body leading-relaxed text-ink-2">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Creators suggested — the main event. */}
        {profiles.length > 0 && (
          <section className="mb-14">
            <div className="mb-6 flex flex-col items-center text-center">
              <p className="font-mono text-eyebrow uppercase tracking-[0.18em] text-ink-3">Creators suggested</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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

        {/* Suggested content — reference reels, supporting material. Each
            link was snapshotted once via HikerAPI when the team added it
            (see the backend's fetchReelSnapshot), so most show a real
            preview rather than a bare URL — same as the internal editor.
            Tile treatment (9:16 frame, hover-scaled thumbnail, hover-played
            reel, bottom scrim with handle + stats) borrows the visual
            language of the campaign register (../assets.jsx's ReelTile) so
            this reads as the same product rather than a plainer afterthought
            tacked on the end of the page. */}
        {suggestedContent.length > 0 && (
          <section>
            <div className="mb-6 flex flex-col items-center text-center">
              <p className="font-mono text-eyebrow uppercase tracking-[0.18em] text-ink-3">Suggested content</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {suggestedContent.map((c) => (
                <SuggestedContentTile key={c.id} c={c} />
              ))}
            </div>
          </section>
        )}

        {brief.length === 0 && profiles.length === 0 && suggestedContent.length === 0 && (
          <p className="text-center text-body text-ink-2">There's nothing here yet — check back soon.</p>
        )}
      </div>

      {decidable && profiles.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6 sm:px-5">
          <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-full border border-line bg-card/95 py-2.5 pl-4 pr-2.5 shadow-[0_16px_40px_-12px_rgb(0_0_0_/_0.22)] backdrop-blur sm:gap-4 sm:py-3 sm:pl-5 sm:pr-3">
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

function PitchCard({ p, status, dirty, decidable, onPick }) {
  const locked = !decidable; // already promoted — the call here is final
  // A view-count of exactly 0 is the stale HikerAPI artefact from before the
  // media-type fix (photo/carousel posts reported play_count: 0 rather than
  // omitting the field) — treat it the same as "no data" rather than
  // printing a misleading zero. Same guard as PitchApprove's own card.
  const avgViews = p.avgViews > 0 ? p.avgViews : null;

  return (
    <div className="group relative flex h-full flex-col items-center rounded-2xl border border-line bg-card px-5 pb-5 pt-7 text-center shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-shadow hover:shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.14)] sm:px-6 sm:pb-6 sm:pt-8">
      {dirty && (
        <span className="absolute right-4 top-4 rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          Unsaved
        </span>
      )}

      {p.avatar ? (
        <img
          src={PitchDraftAPI.avatarUrl(p.avatar)}
          alt=""
          className="size-20 rounded-full border-2 border-line object-cover shadow-sm"
        />
      ) : (
        <div className="flex size-20 items-center justify-center rounded-full border-2 border-line bg-accent-muted font-serif text-title text-accent">
          {(p.name || p.handle || "?").slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="mt-4 flex w-full items-center justify-center gap-1.5 px-2">
        <span className="max-w-[80%] truncate font-serif text-label font-semibold text-ink">{p.name || p.handle}</span>
        {p.isVerified && (
          <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 fill-accent" aria-label="Verified">
            <path d="M12 2 14.5 4.5 18 4 18.5 7.5 22 9 20.5 12 22 15 18.5 16.5 18 20 14.5 19.5 12 22 9.5 19.5 6 20 5.5 16.5 2 15 3.5 12 2 9 5.5 7.5 6 4 9.5 4.5Z" />
          </svg>
        )}
      </div>
      <a
        href={`https://instagram.com/${encodeURIComponent(p.handle)}`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-0.5 text-caption text-ink-3 transition-colors hover:text-accent hover:underline"
      >
        @{p.handle}
      </a>

      {/* Fixed-height, always-reserved — same reasoning as PitchApprove's
          own card: a short bio doesn't stretch the box, a long one scrolls
          in place, so every card in the grid lines up. */}
      <div className="mt-3 h-14 w-full shrink-0 overflow-y-auto text-caption leading-relaxed text-ink-2 [scrollbar-width:thin]">
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
          <div className="flex items-center gap-1.5 py-2.5 text-caption font-medium text-ink-3">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-ink-3" aria-hidden>
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
            Moved forward
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
      className="group relative block overflow-hidden rounded-xl bg-black shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(0_0_0_/_0.35)]"
      style={{ aspectRatio: "9 / 16" }}
    >
      {m?.thumbnail ? (
        <>
          <img
            src={m.thumbnail}
            alt=""
            className={`size-full object-cover transition-transform duration-500 ease-out ${hovered ? "scale-105" : "scale-100"}`}
          />
          {canPlay && hovered && (
            <video
              ref={videoRef}
              src={m.video}
              poster={m.thumbnail}
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
