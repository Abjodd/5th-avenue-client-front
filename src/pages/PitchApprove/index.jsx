/**
 * Fifth Avenue — Pitch approval (public, code-gated)
 * ─────────────────────────────────────────────────────────────────
 * The one page in this app that isn't behind a brand login. A client opens
 * this from a link the team sends them (…/pitch/:brandId?code=XXXX), sees
 * EVERY influencer pitched to them across all of their campaigns — one list,
 * not split into a separate link per campaign — and approves or rejects
 * each.
 *
 * Decisions are a DRAFT until the client hits "Save my choices" at the
 * bottom — tapping Approve/Reject only updates this page; nothing reaches
 * the team, or the internal Pitch Client view, until Save actually sends
 * the batch. That's deliberate: a client comparing several cards should be
 * free to change their mind before anything is final, rather than each tap
 * being an irreversible, individually-fired write.
 *
 * See 5th-internal-back/routes/pitch.js for the backend contract and why
 * an access code rather than a login: this is a lightweight, single-purpose
 * share link, not a second front door into the real portal.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PitchAPI } from "../../lib/api";
import { FALogo } from "../../components/primitives/FALogo";

export default function PitchApprove() {
  const { brandId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") || "";

  const [state, setState] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [client, setClient] = useState(null);
  const [profiles, setProfiles] = useState([]);
  // Draft decisions keyed by pitch id — only entries that differ from what's
  // persisted (p.status) live here; picking a card back to its saved state
  // removes its entry. Nothing here has reached the server yet.
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [reviewer, setReviewer] = useState(() => {
    try { return localStorage.getItem("5av_pitch_reviewer") || ""; } catch { return ""; }
  });

  const load = useCallback(() => {
    setState("loading");
    PitchAPI.get(brandId, code)
      .then(({ client: c, profiles: list }) => {
        setClient(c);
        setProfiles(list);
        setDraft({});
        setState("ready");
      })
      .catch((err) => {
        setErrorMsg(err.body?.error || "This link isn't working right now.");
        setState("error");
      });
  }, [brandId, code]);

  useEffect(() => { load(); }, [load]);

  // How many distinct campaigns are represented — only worth labelling each
  // card with its campaign when there's more than one to tell apart.
  const multiCampaign = new Set(profiles.map((p) => p.campaignName).filter(Boolean)).size > 1;

  const pick = (pitchId, status) => {
    const p = profiles.find((x) => x.id === pitchId);
    if (!p) return;
    setDraft((d) => {
      const next = { ...d };
      if (status === p.status) delete next[pitchId];
      else next[pitchId] = status;
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
    for (const [pitchId, status] of entries) {
      try {
        const updated = await PitchAPI.decide(brandId, pitchId, code, status, by);
        setProfiles((list) => list.map((p) => (p.id === pitchId ? { ...p, ...updated } : p)));
        setDraft((d) => { const next = { ...d }; delete next[pitchId]; return next; });
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
            Pitched for {client?.name || "your brand"}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-body text-ink-2">
            Take a look at each profile below and mark it approved or not, then save your choices at the bottom — your team is notified the moment you do.
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
        </header>

        {profiles.length === 0 ? (
          <p className="text-center text-body text-ink-2">Nothing's been pitched here yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {profiles.map((p) => (
              <PitchCard
                key={p.id}
                p={p}
                status={displayStatus(p)}
                dirty={draft[p.id] !== undefined}
                showCampaign={multiCampaign}
                onPick={(status) => pick(p.id, status)}
              />
            ))}
          </div>
        )}
      </div>

      {profiles.length > 0 && (
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

function PitchCard({ p, status, dirty, showCampaign, onPick }) {
  const locked = p.shipped; // already moved on — the call here is final
  // A view-count of exactly 0 is the stale HikerAPI artefact from before the
  // media-type fix (photo/carousel posts reported play_count: 0 rather than
  // omitting the field) — treat it the same as "no data" rather than
  // printing a misleading zero.
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
          src={PitchAPI.avatarUrl(p.avatar)}
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

      {/* Fixed-height, always-reserved — a short bio doesn't stretch the box
          and a long one scrolls in place instead of pushing the card taller,
          so every card in the grid lines up regardless of bio length. */}
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

      {/* Everything below sinks to the bottom of the card (mt-auto on this
          wrapper, h-full flex-col on the card) so the action row lands at
          the same height on every card in a row, whether or not this one
          has a campaign tag above it. */}
      <div className="mt-auto flex w-full flex-col items-center pt-4">
        {showCampaign && p.campaignName && (
          <div className="mb-4 rounded-full bg-well px-3 py-1 text-[11px] text-ink-3">
            For <span className="text-ink-2">{p.campaignName}</span>
          </div>
        )}

        {locked ? (
          <div className="flex items-center gap-1.5 py-2.5 text-caption font-medium text-ink-3">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-ink-3" aria-hidden>
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
            </svg>
            Already moved on
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
