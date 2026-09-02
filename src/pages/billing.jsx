/**
 * src/pages/billing.jsx — what each campaign cost, line by line.
 * (Lowercase filename to match assets.jsx and the /portal/billing route.)
 *
 * The brand's own breakdown of every campaign budget: what each creator was
 * charged, and the agency fee, stated separately. The Budget card on a
 * campaign's Overview shows the same split as a hover; this is the version you
 * read across every campaign at once and check an invoice against.
 *
 * Because it IS checked against an invoice, three rules hold here that don't
 * hold on the summary screens:
 *
 *  · Money is exact (fmtINRExact). "₹2.2L" is four different invoices.
 *  · Nothing is computed from a rate — budgetLines() (lib/portalMetrics.js)
 *    turns stored figures into rows, and this page only lays them out.
 *  · Any gap between the lines and the budget is drawn as its own row rather
 *    than absorbed: a billing page that doesn't add up is worse than none.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { fmtINRExact, fmtShare, prettyDate } from "../lib/format";
import { budgetLines, countsInMetrics } from "../lib/portalMetrics";
import { usePortalCampaigns } from "../lib/usePortalData";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import { AmbientBackground } from "../components/motion/Motion";
import AnimatedNumber from "../components/AnimatedNumber";

/* Creator lines share the palette the Budget card's hover uses, so a campaign's
   split looks the same in both places. The fee and the unallocated remainder
   are deliberately NOT from it — neither is a creator, and colouring them like
   one is what made the fee read as another name on the roster. */
const LINE_COLORS = ["#2C3E7E", "#178E80", "#A2489A", "#A8720C", "#6C55CE", "#17915A", "#96792A", "#5B6FA3", "#4FA97E", "#C27FBA"];
const FEE_COLOR = "var(--color-teal)";

/* One campaign, in the shape this page reads. Local rather than in
   campaigns/mapping.js, which builds the board's view (phases, tracking, growth)
   — none of it wanted here. */
function toBilling(c) {
  const split = budgetLines({ budget: c.budget, agencyFee: c.agencyFee, creators: c.creators });
  return {
    id: c.id,
    name: c.name || "—",
    start: c.start || null,
    end: c.end || null,
    ...split,
    // Whether a budget was ever agreed, read from the campaign rather than from
    // the split. budgetLines falls back to the sum of the lines when there is no
    // budget — right for a hover that must still draw something, wrong here,
    // where it would print a total nobody agreed to under the words "Campaign
    // budget". The campaign's own card says "To be confirmed"; so does this.
    pending: !(Number(c.budget) > 0),
    // Creator rows only — the fee gets its own block below them, because it is
    // the one line on this bill that isn't a person.
    creators: split.rows.filter((r) => !r.fee),
    // From the campaign's own finance dates, not a label we invent. Most-settled
    // wins, so a paid campaign isn't also "awaiting payment".
    status: c.paidOn ? { label: "Settled", on: c.paidOn, tone: "green" }
      : c.invoiceRaisedOn ? { label: "Invoiced", on: c.invoiceRaisedOn, tone: "amber" }
      : c.advanceReceivedOn ? { label: "Advance received", on: c.advanceReceivedOn, tone: "amber" }
      : { label: "Not yet invoiced", on: null, tone: "mute" },
  };
}
// Drafts are left out for the same reason the Overview leaves them out of its
// totals: nothing has been billed on a campaign that hasn't started. A campaign
// with neither a budget nor a single priced line has nothing to show at all.
const mapBilling = (data) =>
  data.filter(countsInMetrics).map(toBilling).filter((c) => c.base > 0);

const TONE = {
  green: "border-green/25 bg-green/[0.08] text-green",
  amber: "border-amber/25 bg-amber/[0.08] text-amber",
  mute: "border-line bg-well text-mute",
};

/* A proportion bar that grows in on mount.
 *
 * The width is real CSS driven by a state flip in an effect, NOT a motion
 * `animate` — deliberately. Motion interpolates on requestAnimationFrame, which
 * browsers pause in a background tab, so a bar declared `initial={{width:0}}`
 * stays at zero until the tab is looked at. On a page of money that reads as
 * "nothing allocated" rather than as an animation that hasn't started, which is
 * the same trap AnimatedNumber documents at the top of its own file. An effect
 * always runs; the transition is decoration over an already-correct width. */
function Bar({ pct, color, className = "h-full rounded-full", delay = 0 }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(true); }, []);
  return (
    <div className={className}
      style={{ width: grown ? `${pct}%` : 0, background: color,
               transition: `width 480ms cubic-bezier(0.16,1,0.3,1) ${delay}ms` }} />
  );
}

/* A legend swatch, with its figure when there is one worth stating. */
function Key({ color, label, value, outline }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-[7px] shrink-0 rounded-[2px]"
        style={outline ? { border: "1px solid var(--color-line-strong)" } : { background: color }} />
      {label}{value != null && <strong className="font-semibold text-sub">{fmtINRExact(value)}</strong>}
    </span>
  );
}

/* The whole bill as one bar: creators, then the fee, then whatever is left.
 *
 * Scaled to whichever is larger, the budget or the lines — so an over-budget
 * campaign fills the bar and its agreed budget shows as a marker part-way
 * along, instead of the overage being silently clipped off the end. It is the
 * fastest read on the page: where the money went, and whether it fits. */
function AllocationBar({ creatorTotal, fee, base, listed, pending }) {
  const scale = Math.max(base, listed);
  if (scale <= 0) return null;
  const pc = (v) => `${(v / scale) * 100}%`;
  const over = !pending && listed > base;
  const segs = [
    { k: "creators", v: creatorTotal, c: LINE_COLORS[0] },
    { k: "fee", v: fee, c: FEE_COLOR },
  ].filter((s) => s.v > 0);

  return (
    <div className="mb-3">
      <div className="relative flex h-2 gap-px overflow-hidden rounded-full bg-well">
        {segs.map((s, i) => (
          <Bar key={s.k} pct={(s.v / scale) * 100} color={s.c} delay={i * 60}
            className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
        {/* Where the agreed budget sits, once the lines have run past it. Ringed
            in the page colour so the mark reads against whichever segment it
            happens to land on — a bare 1px line disappeared into the blue. */}
        {over && (
          <span className="absolute top-0 h-full w-[3px] rounded-full bg-red ring-1 ring-[--color-page]"
            style={{ left: `calc(${pc(base)} - 1.5px)` }} aria-hidden="true" />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[9.5px] text-mute">
        {creatorTotal > 0 && <Key color={LINE_COLORS[0]} label="Creators" value={creatorTotal} />}
        {fee > 0 && <Key color={FEE_COLOR} label="Agency fee" value={fee} />}
        {!pending && listed < base && <Key label="Not yet allocated" value={base - listed} outline />}
        {over && <Key color="var(--color-red)" label={`Over budget by ${fmtINRExact(listed - base)}`} />}
      </div>
    </div>
  );
}

/* One money row. A creator line carries a share bar under it — the same device
   the Budget card's hover uses — so the big lines are visible without reading
   every figure. `muted` marks the rows that aren't people. */
function Line({ label, sub, amount, share, color, muted, strong, tone, index = 0 }) {
  return (
    <div className="py-[7px]">
      <div className="flex items-baseline gap-3">
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[12px] ${strong ? "font-semibold text-ink" : muted ? "text-sub" : "font-medium text-ink"}`}
            style={tone ? { color: tone } : undefined}>{label}</div>
          {sub && <div className="mt-px truncate text-[10px] text-mute">{sub}</div>}
        </div>
        {share != null && (
          <span className="tnum hidden w-10 shrink-0 text-right text-[10px] text-mute sm:block">{fmtShare(share)}</span>
        )}
        <span className={`tnum shrink-0 text-right text-[12px] ${strong ? "font-bold text-ink" : "font-semibold text-ink"}`}
          style={tone ? { color: tone } : undefined}>{fmtINRExact(amount)}</span>
      </div>
      {color && share != null && (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-well">
          <Bar pct={Math.min(Math.max(share, 1), 100)} color={color} delay={100 + index * 50} />
        </div>
      )}
    </div>
  );
}

function CampaignBill({ c, index }) {
  // Balanced draws nothing: a reconciliation row reading zero is noise. Neither
  // does a campaign with no agreed budget — there is nothing to reconcile against.
  const showDiff = !c.pending && Math.abs(c.diff) >= 1;
  const unpriced = c.rosterCount - c.itemised;
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.3), duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[18px] border border-line bg-[--color-glass] p-4 shadow-card backdrop-blur-md sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-[17px] font-semibold italic text-ink">{c.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-mute">
            {c.start && c.end && <span>{prettyDate(c.start)} — {prettyDate(c.end)}</span>}
            <span className={`rounded-full border px-2 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] ${TONE[c.status.tone]}`}>
              {c.status.label}{c.status.on ? ` · ${prettyDate(c.status.on)}` : ""}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">Campaign budget</div>
          {c.pending
            ? <div className="mt-0.5 text-[13px] font-semibold text-amber">To be confirmed</div>
            : <div className="tnum text-[19px] font-bold text-ink">{fmtINRExact(c.base)}</div>}
        </div>
      </header>

      <AllocationBar creatorTotal={c.creatorTotal} fee={c.fee} base={c.base} listed={c.listed} pending={c.pending} />

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">Creators</span>
        {/* Only worth saying when it isn't everyone — "2 of 2" answers a
            question nobody asked. Wording follows the Budget card's hover: how
            many of THEIR creators the split covers, in plain words rather than
            an accounting term the brand has to decode. */}
        {unpriced > 0 && (
          <span className="text-[9.5px] text-mute">{c.itemised} of {c.rosterCount} creators priced</span>
        )}
      </div>
      <div className="divide-y divide-line">
        {c.creators.length
          ? c.creators.map((cr, i) => (
              <Line key={`${cr.key}-${i}`} label={cr.label} sub={cr.handle ? `@${cr.handle.replace(/^@/, "")}` : null}
                amount={cr.amount} share={c.pending ? null : cr.share} index={i}
                color={LINE_COLORS[i % LINE_COLORS.length]} />
            ))
          : <div className="py-2 text-[11px] text-mute">No creator costs agreed on this campaign yet.</div>}
      </div>

      {/* Its own block, not another creator row — the one line on this bill that
          isn't a person, and the brand asked to see it apart from creator cost. */}
      <div className="mt-2 border-t border-line pt-1">
        {c.fee > 0
          ? <Line label="Agency fee" sub="Charged on top of the creator costs above" amount={c.fee}
              share={c.pending ? null : c.rows.find((r) => r.fee)?.share} muted />
          : <div className="py-[7px] text-[11px] text-mute">No agency fee on this campaign.</div>}
      </div>

      <div className="mt-2 border-t-2 border-line pt-1">
        {/* "Total", not "Total billed" — on an over-budget campaign the lines add
            up past the agreed budget, and calling that sum the bill would tell
            the brand they owe the larger number. What they were invoiced is the
            budget in the header; this is what the rows above come to. */}
        <Line label="Total" amount={c.listed} strong />
        {/* A shortfall is ordinary on a campaign still being priced; an overage
            has outgrown the agreed budget, so it is drawn as a warning. */}
        {showDiff && (
          <div className="pt-1">
            {c.diff > 0
              ? <Line label="Not yet allocated" amount={c.diff} muted
                  sub={unpriced > 0
                    ? `${unpriced} creator${unpriced === 1 ? "" : "s"} on the roster with no cost agreed yet`
                    : "Still to be assigned against this budget"} />
              : <Line label="Over the agreed budget" amount={Math.abs(c.diff)} tone="var(--color-red)"
                  sub="The lines above exceed the campaign budget — we'll reconcile this with you" />}
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default function BillingPage() {
  const { data: campaigns, error, retry } = usePortalCampaigns(mapBilling);

  const totals = useMemo(() => {
    const list = campaigns || [];
    // Budgets only from campaigns that HAVE one, so a campaign still being
    // priced can't quietly add the sum of its own lines to "total billed".
    return {
      billed: list.reduce((s, c) => s + (c.pending ? 0 : c.base), 0),
      creators: list.reduce((s, c) => s + c.creatorTotal, 0),
      fees: list.reduce((s, c) => s + c.fee, 0),
    };
  }, [campaigns]);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!campaigns) return <PageSkeleton />;

  const split = totals.creators + totals.fees;

  return (
    <div className="relative min-h-screen bg-page font-sans text-ink">
      <AmbientBackground variant="a" />
      <div className="relative mx-auto max-w-[1000px] px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-6">
          <div className="microlabel mb-1.5 tracking-[0.2em]">Commercials</div>
          <h1 className="font-serif text-[clamp(30px,4vw,42px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">Billing</h1>
          <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-sub">
            Every campaign budget broken down — what each creator was charged, and the agency fee, stated separately.
          </p>
        </div>

        {campaigns.length === 0
          ? <EmptyState icon="₹" title="Nothing billed yet"
              hint="Campaign costs appear here as soon as a budget is agreed and the roster is priced." />
          : <>
              {/* The three figures the page adds up to, before the detail —
                  exact, like every line below them. This is the one screen
                  where "₹3.9L" is the wrong answer. */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[["Total billed", totals.billed], ["To creators", totals.creators], ["Agency fees", totals.fees]].map(([label, v]) => (
                  <div key={label} className="rounded-[14px] border border-line bg-[--color-glass] px-3.5 py-3 shadow-sm backdrop-blur-md">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-mute">{label}</div>
                    <div className="tnum mt-1 text-[16px] font-bold text-ink sm:text-[17px]">
                      <AnimatedNumber value={v} format={fmtINRExact} duration={800} />
                    </div>
                  </div>
                ))}
              </div>

              {/* The same split as each campaign's own bar, across the account —
                  what share of everything committed went to creators. */}
              {split > 0 && (
                <div className="mb-5">
                  <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-well">
                    <Bar pct={(totals.creators / split) * 100} color={LINE_COLORS[0]} className="h-full rounded-l-full" />
                    <Bar pct={(totals.fees / split) * 100} color={FEE_COLOR} delay={80} className="h-full rounded-r-full" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-mute">
                    <Key color={LINE_COLORS[0]} label={`Creators · ${fmtShare((totals.creators / split) * 100)}`} />
                    <Key color={FEE_COLOR} label={`Agency fees · ${fmtShare((totals.fees / split) * 100)}`} />
                    <span>Across {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {campaigns.map((c, i) => <CampaignBill key={c.id} c={c} index={i} />)}
              </div>
              <p className="mt-5 text-[10.5px] leading-relaxed text-mute">
                Figures are the agreed cost per creator and the agency fee for each campaign. Taxes are shown on the invoice itself.
              </p>
            </>}
      </div>
    </div>
  );
}
