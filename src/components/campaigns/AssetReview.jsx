// src/components/campaigns/AssetReview.jsx — the brand's review of one asset
// on one creator: the file the team uploaded, and the thread the two sides
// have on it.
//
// Replaces the "Brief: … / Video: …" status words the creator row used to
// carry. A status told the brand where an asset had got to but gave them no
// way to watch it or say anything about it, which is the one thing they are
// actually being asked for at that point in a campaign.
//
// Notes post to the campaign's own roster row (see the asset-comment routes in
// 5th-internal-back/server.js), so they surface on the internal Deliverables
// tab beside the same file and replies come back down the same field.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Clapperboard, FileSignature, ExternalLink, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PortalAPI } from "../../lib/api";
import { popModal, overlayFade } from "../../lib/motion";
import { prettyDateTime } from "../../lib/format";
import { StatusPill } from "../StatusPill";
import { closeBtnCls, inputCls } from "./mapping";

/* The two reviewable assets, keyed by the field they live on so one component
   serves both. `key` is also what the API route takes. */
export const ASSETS = {
  concept: { key: "concept", label: "Concept", Icon: FileSignature, noun: "concept" },
  demo:    { key: "demo",    label: "Demo video", Icon: Clapperboard, noun: "cut" },
};

/* Google Drive shares a file as /file/d/<id>/view or /open?id=<id>; /preview is
   the embeddable form of the same link. Returned only for a link we recognise
   — anything else is offered as a button rather than guessed into an iframe
   that would render as a Google error page. */
const DRIVE_ID = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/;
// A concept is often dropped in as a live Docs/Sheets/Slides link rather than
// an exported file — docs.google.com/<kind>/d/<id>/edit... — which has the
// same /preview embeddable form, keyed off the same id and kind.
const GOOGLE_DOC = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const IMAGE_FILE = /\.(png|jpe?g|webp|gif)(\?|#|$)/i;

export function assetEmbed(url) {
  if (!url) return null;
  const drive = DRIVE_ID.exec(url);
  if (drive) return { kind: "frame", src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  const doc = GOOGLE_DOC.exec(url);
  if (doc) return { kind: "frame", src: `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview` };
  if (VIDEO_FILE.test(url)) return { kind: "video", src: url };
  // A concept often arrives as a board or a still rather than a cut.
  if (IMAGE_FILE.test(url)) return { kind: "image", src: url };
  return null;
}

/* The black preview pane itself, pulled out of the modal below so a second
   surface (CampaignDetail's "Concept & Demo" tab) can show the same embed —
   iframe, video, image or the "can't preview, here's the link" fallback —
   without copying this branch a second time and the two quietly drifting
   apart on which links embed and which don't.

   `size`/`fallbackSize` are Tailwind height classes so each caller can fit it
   to its own layout (the modal's responsive md:58% column vs. a fixed half-
   width panel); everything else about the pane — what embeds, what falls
   back, the "Open the file" link — stays identical everywhere it's used. */
export function AssetPreviewPane({
  url, label, noun, Icon,
  size = "h-[46vh] md:h-[62vh]",
  fallbackSize = "h-[30vh] md:h-[62vh]",
}) {
  const embed = assetEmbed(url);
  return (
    <div className="flex w-full shrink-0 items-center justify-center bg-black">
      {embed?.kind === "frame" ? (
        <iframe src={embed.src} title={label} allow="autoplay" allowFullScreen className={`w-full border-0 ${size}`}/>
      ) : embed?.kind === "video" ? (
        <video src={embed.src} controls playsInline className={`w-full object-contain ${size}`}/>
      ) : embed?.kind === "image" ? (
        <img src={embed.src} alt={label} className={`w-full object-contain ${size}`}/>
      ) : (
        /* No link, or one we can't embed. */
        <div className={`flex w-full flex-col items-center justify-center gap-3 px-6 text-center ${fallbackSize}`}>
          <Icon size={26} strokeWidth={1.6} className="text-white/40"/>
          <p className="text-[12px] leading-relaxed text-white/70">
            {url ? "This file can't be previewed here." : `No ${noun} has been attached to this one yet.`}
          </p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1.5 text-[11.5px] font-semibold text-white no-underline transition-colors hover:bg-white/10">
              Open the file <ExternalLink size={12}/>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* One note. The brand's own sit right and tinted, the team's left and plain —
   the cheapest way to read a two-sided thread without labelling every line. */
function Note({ note }) {
  const mine = note.fromClient;
  return (
    <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1.5 px-1 text-[10px] text-mute">
        <span className="font-semibold">{note.author}</span>
        {note.at && <span>{prettyDateTime(note.at)}</span>}
      </div>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[12px] leading-relaxed ${
        mine ? "bg-accent/[0.09] text-ink" : "border border-line bg-well/60 text-ink"
      }`}>
        {note.body}
      </div>
    </div>
  );
}

export default function AssetReview({ creator, asset, campaignId, onClose, onPosted }) {
  const { user } = useAuth();
  const meta = ASSETS[asset];
  const file = creator[`${asset}Asset`];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  // Posting needs all three: the campaign to write to, the roster row to write
  // against, and the brand the server scopes the write by. Missing any one
  // (a payload predating `ref`, say) leaves the panel readable but read-only,
  // rather than offering a box whose Send can only fail.
  const canPost = !!(campaignId && creator.ref && (user?.brandId || user?.clientName));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Newest note in view on open and after every send — a thread that opens at
  // the top hides the reply the brand came back to read.
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [file.comments.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !canPost) return;
    setSending(true);
    setError(null);
    try {
      const res = await PortalAPI.addAssetComment(campaignId, creator.ref, asset, {
        scope: user, text, author: user.name, accountId: user.id,
      });
      onPosted(asset, res.comments);
      setDraft("");
    } catch (e) {
      setError(e.body?.error || "Couldn't send that note. Try again.");
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    // Portalled to <body>: this row sits inside several backdrop-blurred
    // panels, each of which is a stacking context a fixed overlay would be
    // painted underneath.
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div variants={overlayFade} initial="hidden" animate="show" exit="exit"
        onClick={onClose} className="absolute inset-0 bg-[rgba(3,6,16,0.5)] backdrop-blur-[8px]"/>

      <motion.div variants={popModal} initial="hidden" animate="show" exit="exit" role="dialog" aria-modal="true"
        className="glass-panel relative flex max-h-[90vh] w-[min(880px,95vw)] flex-col overflow-hidden rounded-[24px]">

        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-serif text-[19px] italic font-semibold text-ink">
              <meta.Icon size={17} strokeWidth={1.9} className="text-accent"/> {meta.label}
            </h3>
            <div className="mt-0.5 truncate text-[12px] text-sub">{creator.name} {creator.handle}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill tier={file.t}>{file.label}</StatusPill>
            <button onClick={onClose} aria-label="Close" className={closeBtnCls}>✕</button>
          </div>
        </div>

        {/* Stacked on a phone, side by side from md up — same shape as the
            Assets lightbox, and for the same reason: beside the file the
            thread costs no height, so the work gets the window. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">

          <div className="shrink-0 md:w-[58%]">
            <AssetPreviewPane url={file.url} label={`${meta.label} — ${creator.name}`} noun={meta.noun} Icon={meta.Icon}/>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-line px-4 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mute">Your review</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-sub">
                Anything you write here reaches the team working on this {meta.noun}.
              </p>
            </div>

            <div className="flex min-h-[160px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
              {file.comments.length === 0 ? (
                <p className="my-auto text-center text-[11.5px] leading-relaxed text-mute">
                  No notes yet. Tell us what you&rsquo;d like changed — or that it&rsquo;s good to go.
                </p>
              ) : (
                file.comments.map((n) => <Note key={n.id} note={n}/>)
              )}
              <div ref={endRef}/>
            </div>

            {canPost ? (
              <div className="border-t border-line px-4 py-3">
                {error && <p className="mb-2 text-[11px] text-red">{error}</p>}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  // ⌘/Ctrl+Enter sends; a bare Enter stays a newline, because a
                  // review note is usually more than one line.
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                  rows={3}
                  placeholder="What would you like changed?"
                  className={`${inputCls} resize-y leading-relaxed`}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-mute">⌘/Ctrl + Enter to send</span>
                  <button onClick={send} disabled={!draft.trim() || sending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[11.5px] font-semibold text-on-accent shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:pointer-events-none disabled:opacity-40">
                    {sending ? "Sending…" : <>Send <Send size={12}/></>}
                  </button>
                </div>
              </div>
            ) : (
              <p className="border-t border-line px-4 py-3 text-[11px] text-mute">
                Comments aren&rsquo;t available on this creator yet.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
