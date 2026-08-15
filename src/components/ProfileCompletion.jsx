/**
 * Profile completion — a donut plus the list of what is still missing.
 *
 * The donut alone would be a scold: it tells you that you are at 60% without
 * telling you what the other 40% is, and on this page most of it isn't yours to
 * fix. So the ring is paired with the actual missing items, split by who can
 * act on them — the photo gets a button that scrolls to the uploader, and
 * everything else is labelled as held by 5th Avenue.
 *
 * Recomputed from the session user on every render rather than cached, so
 * uploading a photo moves the ring immediately: AuthContext.updateUser merges
 * the new `hasAvatar` into the session, this re-renders, and ProgressRing
 * transitions the arc to its new length.
 */
import { CheckCircle2, Circle, ArrowUp } from "lucide-react";

import { ProgressRing } from "./primitives/ProgressRing";
import { profileCompletion } from "../lib/profileCompletion";
import { Panel, PanelTitle } from "./portal/Shell";

export default function ProfileCompletion({ user, onFixPhoto }) {
  const { pct, done, total, items, missing } = profileCompletion(user);
  // done === total, not pct === 100 — see the note in lib/profileCompletion.
  const complete = done === total;

  return (
    <Panel reveal className="px-6 py-5">
      <PanelTitle
        title="Profile completion"
        hint={complete
          ? "Everything we hold for you is filled in."
          : "What's still missing from the record we hold for you."}
      />

      <div className="flex flex-wrap items-center gap-6">
        <div className="relative shrink-0">
          <ProgressRing
            value={pct}
            size={104}
            stroke={9}
            showLabel={false}
            color={complete ? "var(--green)" : "var(--accent)"}
            colorTo={complete ? undefined : "var(--purple)"}
          />
          {/* The ring's own label is a 10px number sized for inline use; this
              page wants the value to read as the headline of the panel. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum font-serif text-[26px] font-bold italic leading-none text-ink">{pct}%</span>
            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-mute">
              {done} of {total}
            </span>
          </div>
        </div>

        <ul className="m-0 min-w-[190px] flex-1 list-none space-y-1.5 p-0">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-2 text-[12.5px]">
              {it.filled
                ? <CheckCircle2 size={14} className="shrink-0 text-green" />
                : <Circle size={14} className="shrink-0 text-donetxt" />}
              <span className={it.filled ? "text-sub" : "font-medium text-ink"}>{it.label}</span>
              {!it.filled && it.actionable && onFixPhoto && (
                <button type="button" onClick={onFixPhoto}
                  className="ml-auto flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-semibold text-accent transition-colors hover:bg-accent/[0.06]">
                  <ArrowUp size={10} /> Add
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Only shown when something is actually missing, and only naming the
          route that can fix it. A permanent "contact your account manager"
          line on a finished profile would be noise. */}
      {!complete && missing.some((m) => !m.actionable) && (
        <p className="mt-4 text-[11px] leading-relaxed text-mute">
          Your name, role and contact details are managed by 5th Avenue — ask your account
          manager to fill in anything missing above.
        </p>
      )}
    </Panel>
  );
}
