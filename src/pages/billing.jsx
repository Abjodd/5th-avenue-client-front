/**
 * src/pages/billing.jsx — what each campaign cost, line by line.
 * (Lowercase filename to match assets.jsx and the /portal/billing route.)
 *
 * The brand's own breakdown of every campaign budget: what each creator was
 * charged and the agency fee, stated separately. Read with an invoice beside
 * it, so three rules hold here that don't hold on the summary screens:
 *
 *  · Money is exact (fmtINRExact). "₹2.2L" is four different invoices.
 *  · Nothing is computed from a rate — budgetLines() (lib/portalMetrics.js)
 *    turns stored figures into rows, and this page only lays them out.
 *  · Any gap between the lines and the budget is drawn as its own row rather
 *    than absorbed: a billing page that doesn't add up is worse than none.
 *
 * Laid out with the shared portal vocabulary (Panel, Section, KPI's ledger
 * band) rather than its own. Each campaign gets two blocks whose arithmetic
 * closes separately — the roster totals to its lines, the tinted band at the
 * foot runs budget → GST → payable — because on an over-budget campaign the
 * lines exceed the budget that payable is derived from.
 */
import { useEffect, useMemo, useState } from "react";
import { cx } from "../lib/cx";
import { fmtINRExact, fmtShare, prettyDate } from "../lib/format";
import { budgetLines, countsInMetrics } from "../lib/portalMetrics";
import { usePortalCampaigns } from "../lib/usePortalData";
import { useAuth } from "../context/AuthContext";
import { PageSkeleton, ErrorState, EmptyState } from "../components/PageStates";
import { Stagger, AmbientBackground } from "../components/motion/Motion";
import { Panel, Section, KPI } from "../components/portal/Shell";
import { StatusPill } from "../components/StatusPill";

/* ── GST ─────────────────────────────────────────────────────────────────────
   18% on the campaign budget, shown on this page and nowhere else in the portal.
   Kept local rather than in lib/portalMetrics.js so no other screen can pick it
   up: every figure elsewhere quotes the budget the campaign was booked at, which
   is ex-tax. This is the one screen read with an invoice beside it.

   Charged on the agreed BUDGET, not the sum of the lines — the budget is what
   gets invoiced, and a part-priced roster is an incomplete account of it. No
   agreed budget means no GST figure: there is nothing to tax yet. */
const GST_RATE = 0.18;
const gstOn = (amount) => Math.round(amount * GST_RATE);

/* Two colours, because the page asks one question: of the money committed,
   how much went to creators and how much was the agency's fee. A per-creator
   rainbow encoded nothing the name beside it didn't, and its teal collided
   with the fee swatch — so creators are separated by opacity (creatorTint),
   which stays legible on a roster of thirty and can never collide.
   Tokens, not hex: frozen light-theme literals survived into dark mode. */
const CREATOR_COLOR = "var(--color-accent)";
const FEE_COLOR = "var(--color-teal)";
const INK = "var(--color-ink)";

const shareOf = (part, whole) => (whole > 0 ? `${fmtShare((part / whole) * 100)} of committed` : null);

/* Rank as fade, capped so the tail never disappears into the well behind it.
   The bars are a supporting read — the figure and the share are printed on the
   row itself — so this only has to separate neighbours, not identify them. */
const creatorTint = (i) => 1 - Math.min(i, 5) * 0.12;

/* One campaign, in the shape this page reads. Local rather than in
   campaigns/mapping.js, which builds the board's view (phases, tracking, growth)
   — none of it wanted here. */
function toBilling(c) {
  const split = budgetLines({ budget: c.budget, agencyFee: c.agencyFee, creators: c.creators });
  // budgetLines falls back to the sum of the lines when no budget is set, which
  // is right for a hover and wrong for a bill — so `pending` gates the tax.
  const pending = !(Number(c.budget) > 0);
  const gst = pending ? 0 : gstOn(split.base);
  return {
    id: c.id,
    name: c.name || "—",
    start: c.start || null,
    end: c.end || null,
    ...split,
    gst,
    payable: pending ? 0 : split.base + gst,
    pending,
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

/* Finance milestones, not the four client-facing delivery tiers — so these
   are passed to StatusPill as raw tones rather than mapped onto a tier. */
const TONE = {
  green: "bg-green/10 text-green",
  amber: "bg-amber/10 text-amber",
  mute: "bg-well text-sub",
};

/* A proportion bar that grows in on mount. CSS width driven by an effect, NOT
   motion's `animate`: rAF is paused in a background tab, so `initial={{width:0}}`
   would leave a bar of money reading "nothing allocated" until the tab is
   looked at. Effects always run; the transition is decoration over an
   already-correct width. Same trap AnimatedNumber documents. */
function Bar({ pct, color, className = "h-full rounded-full", delay = 0, opacity = 1 }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(true); }, []);
  return (
    <div className={className}
      style={{ width: grown ? `${pct}%` : 0, background: color, opacity,
               transition: `width 480ms cubic-bezier(0.16,1,0.3,1) ${delay}ms` }} />
  );
}

/* A legend swatch, with its figure when there is one worth stating. */
function Key({ color, label, value, outline }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-[7px] shrink-0 rounded-[2px]"
        style={outline ? { border: "1px solid var(--color-line-strong)" } : { background: color }} />
      {label}{value != null && <strong className="tnum font-semibold text-sub">{fmtINRExact(value)}</strong>}
    </span>
  );
}

/* The whole bill as one bar — the fastest read on the page: where the money
   went and whether it fits. Scaled to the larger of budget or lines, so an
   over-budget campaign shows its budget as a marker part-way along instead of
   having the overage clipped off the end. */
function AllocationBar({ creatorTotal, fee, base, listed, pending }) {
  const scale = Math.max(base, listed);
  if (scale <= 0) return null;
  const pc = (v) => `${(v / scale) * 100}%`;
  const over = !pending && listed > base;
  const segs = [
    { k: "creators", v: creatorTotal, c: CREATOR_COLOR },
    { k: "fee", v: fee, c: FEE_COLOR },
  ].filter((s) => s.v > 0);

  return (
    <div className="pb-4">
      <div className="relative flex h-1.5 gap-px overflow-hidden rounded-full bg-well">
        {segs.map((s, i) => (
          <Bar key={s.k} pct={(s.v / scale) * 100} color={s.c} delay={i * 60}
            className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
        {/* Ringed in the page colour so the mark reads against whichever
            segment it lands on — a bare 1px line vanished into the blue. */}
        {over && (
          <span className="absolute top-0 h-full w-[3px] rounded-full bg-red ring-1 ring-page"
            style={{ left: `calc(${pc(base)} - 1.5px)` }} aria-hidden="true" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-mute">
        {creatorTotal > 0 && <Key color={CREATOR_COLOR} label="Creators" value={creatorTotal} />}
        {fee > 0 && <Key color={FEE_COLOR} label="Agency fee" value={fee} />}
        {!pending && listed < base && <Key label="Not yet allocated" value={base - listed} outline />}
        {over && <Key color="var(--color-red)" label={`Over budget by ${fmtINRExact(listed - base)}`} />}
      </div>
    </div>
  );
}

/* One ruled ledger line: name, then meter / share / figure columns that hold
   their x-positions down the block — each renders even when empty, so figures
   sit in a true column rather than merely ending at the same edge.

   The meter is a COLUMN, not an underline. Drawn beneath the row it put two
   strokes under every creator (tinted bar, then divider hairline), so a share
   read as a rule underlining a handle rather than as a quantity. It drops
   first at narrow widths; the share, being information, always stays. */
function LedgerRow({
  label, sub, amount, share, meterColor, meterOpacity = 1,
  muted, strong, emphasis, tone, index = 0,
}) {
  const toned = tone ? { color: tone } : undefined;
  return (
    <div className={cx("flex items-center gap-3", emphasis ? "py-3" : "py-2.5")}>
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "truncate",
            strong || emphasis ? "text-[13px] font-semibold text-ink"
              : muted ? "text-[12.5px] text-sub"
              : "text-[13px] font-medium text-ink",
          )}
          style={toned}
        >
          {label}
        </div>
        {sub && <div className="mt-0.5 text-[11px] leading-snug text-mute">{sub}</div>}
      </div>

      {/* Renders empty on rows with no share to plot (Total, GST, diff). */}
      <div aria-hidden className="hidden h-[3px] w-14 shrink-0 overflow-hidden rounded-full sm:block"
        style={{ background: meterColor && share != null ? "var(--color-well)" : "transparent" }}>
        {meterColor && share != null && (
          <Bar pct={Math.min(Math.max(share, 1), 100)} color={meterColor} opacity={meterOpacity}
            delay={140 + index * 45} />
        )}
      </div>
      <span className="tnum w-8 shrink-0 text-right text-[11px] text-mute">
        {share != null ? fmtShare(share) : ""}
      </span>
      <span
        className={cx(
          "tnum min-w-[88px] shrink-0 text-right text-ink",
          emphasis ? "text-[17px] font-bold tracking-[-0.01em]"
            : strong ? "text-[15px] font-bold"
            : "text-[13.5px] font-semibold",
        )}
        style={toned}
      >
        {fmtINRExact(amount)}
      </span>
    </div>
  );
}

/** Block heading inside a statement, with an optional note. */
function BlockHead({ label, note, className }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", className)}>
      <span className="microlabel tracking-[0.12em]">{label}</span>
      {note && <span className="text-[11px] text-mute">{note}</span>}
    </div>
  );
}

function CampaignBill({ c, index }) {
  // Balanced draws nothing: a reconciliation row reading zero is noise. Neither
  // does a campaign with no agreed budget — there is nothing to reconcile against.
  const showDiff = !c.pending && Math.abs(c.diff) >= 1;
  const unpriced = c.rosterCount - c.itemised;
  const feeShare = c.rows.find((r) => r.fee)?.share;

  return (
    <Panel reveal delay={Math.min(index * 0.05, 0.25)} className="flex flex-col overflow-hidden">
      {/* The settlement band bleeds to the card's edges, so the body carries
          the horizontal padding rather than the Panel. */}
      <div className={cx("px-5 pt-5 sm:px-6 sm:pt-6", c.pending && "pb-5 sm:pb-6")}>
        <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 pb-4">
          <div className="min-w-0">
            {/* PanelTitle's size — a statement is a panel like any other. */}
            <h2 className="truncate font-serif text-[19px] font-semibold italic leading-tight text-ink">{c.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              {c.start && c.end && (
                <span className="microlabel tracking-[0.12em]">{prettyDate(c.start)} — {prettyDate(c.end)}</span>
              )}
              <StatusPill tone={TONE[c.status.tone]}>
              {c.status.label}{c.status.on ? ` · ${prettyDate(c.status.on)}` : ""}
            </StatusPill>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="microlabel tracking-[0.12em]">Campaign budget</div>
            {c.pending
              ? <div className="mt-1.5 text-[13px] font-semibold text-amber">To be confirmed</div>
              : <>
                  <div className="tnum mt-1.5 text-[24px] font-bold leading-none tracking-[-0.02em] text-ink">
                    {fmtINRExact(c.base)}
                  </div>
                  {/* Answers "what does this come to" without scrolling past a
                      long roster to the statement at the foot. */}
                  <div className="tnum mt-1.5 text-[11px] text-mute">{fmtINRExact(c.payable)} incl. GST</div>
                </>}
          </div>
        </header>

        <AllocationBar creatorTotal={c.creatorTotal} fee={c.fee} base={c.base} listed={c.listed} pending={c.pending} />

        {/* Only when it isn't everyone — "2 of 2" answers nobody's question. */}
        <BlockHead
          label="Creators"
          note={unpriced > 0 ? `${c.itemised} of ${c.rosterCount} priced` : null}
          className="border-t border-line pt-3.5"
        />
        <div className="divide-y divide-line">
          {c.creators.length
            ? c.creators.map((cr, i) => (
                <LedgerRow key={`${cr.key}-${i}`} label={cr.label}
                  sub={cr.handle ? `@${cr.handle.replace(/^@/, "")}` : null}
                  amount={cr.amount} share={c.pending ? null : cr.share} index={i}
                  meterColor={CREATOR_COLOR} meterOpacity={creatorTint(i)} />
              ))
            : <div className="py-2.5 text-[12px] text-mute">No creator costs agreed on this campaign yet.</div>}

          {/* The one line on this bill that isn't a person. */}
          {c.fee > 0
            ? <LedgerRow label="Agency fee" sub="Charged on top of the creator costs above" amount={c.fee}
                share={c.pending ? null : feeShare} meterColor={FEE_COLOR} muted />
            : <div className="py-2.5 text-[12px] text-mute">No agency fee on this campaign.</div>}
        </div>

        {/* "Total", not "Total billed": on an over-budget campaign the lines
            run past the budget, and calling that sum the bill would tell the
            brand they owe the larger number. */}
        <div className="border-t border-line-strong">
          <LedgerRow label="Total" amount={c.listed} strong />
          {/* A shortfall is ordinary mid-pricing; an overage is a warning. */}
          {showDiff && (
            <div className="border-t border-line">
              {c.diff > 0
                ? <LedgerRow label="Not yet allocated" amount={c.diff} muted
                    sub={unpriced > 0
                      ? `${unpriced} creator${unpriced === 1 ? "" : "s"} on the roster with no cost agreed yet`
                      : "Still to be assigned against this budget"} />
                : <LedgerRow label="Over the agreed budget" amount={Math.abs(c.diff)} tone="var(--color-red)"
                    sub="The lines above exceed the campaign budget — we'll reconcile this with you" />}
            </div>
          )}
        </div>
      </div>

      {/* Full-bleed and tinted, not another indented block: the rows above
          answer "where did the budget go", these answer "what do I pay", and
          that second question should be findable without reading the first. */}
      {!c.pending && (
        <div className="mt-4 border-t border-line bg-well px-5 py-4 sm:px-6">
          <BlockHead label="To pay" />
          <div className="divide-y divide-line">
            <LedgerRow label={`GST @ ${GST_RATE * 100}%`} sub={`On the ${fmtINRExact(c.base)} campaign budget`}
              amount={c.gst} muted />
            <LedgerRow label="Total payable" sub="Inclusive of GST" amount={c.payable} emphasis />
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function BillingPage() {
  const { data: campaigns, error, retry } = usePortalCampaigns(mapBilling);
  const { user } = useAuth();
  const clientName = user?.clientName ?? "Your Brand";

  const totals = useMemo(() => {
    const list = campaigns || [];
    // Budgets only from campaigns that HAVE one, so a campaign still being
    // priced can't quietly add the sum of its own lines to "total billed".
    const billed = list.reduce((s, c) => s + (c.pending ? 0 : c.base), 0);
    // Summed per campaign, not 18% of the total, so the rounding agrees with the
    // cards below — this page gets checked against an invoice.
    const gst = list.reduce((s, c) => s + c.gst, 0);
    return {
      billed,
      gst,
      payable: billed + gst,
      creators: list.reduce((s, c) => s + c.creatorTotal, 0),
      fees: list.reduce((s, c) => s + c.fee, 0),
    };
  }, [campaigns]);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!campaigns) return <PageSkeleton />;

  const split = totals.creators + totals.fees;
  const n = campaigns.length;

  return (
    <div className="relative min-h-screen bg-page font-sans text-ink">
      <AmbientBackground variant="a" />
      {/* Matched to Overview/Campaigns/Insights/Assets. A statement wants a
          capped measure, but that cap belongs on the reading column, not the
          page — a 1000px page put this masthead somewhere no other page's is. */}
      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-16 sm:px-9">
        {/* Same dateline-and-headline construction as the Overview's. */}
        <header className="pt-12">
          <div className="microlabel mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 tracking-[0.2em]">
            <span className="text-ink">Commercials</span>
            <span aria-hidden className="text-line-strong">/</span>
            <span>{clientName}</span>
            {n > 0 && <>
              <span aria-hidden className="text-line-strong">/</span>
              <span className="tnum">{n} campaign{n === 1 ? "" : "s"}</span>
            </>}
          </div>
          <h1 className="font-serif text-[clamp(34px,4.6vw,52px)] font-bold italic leading-[1.05] tracking-[-0.02em] text-ink">
            Billing
          </h1>
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-sub">
            Every campaign budget broken down — what each creator was charged, and the agency fee, stated separately.
          </p>
          <div className="rule mt-7" />
        </header>

        {campaigns.length === 0
          ? <div className="pt-8">
              <EmptyState icon="₹" title="Nothing billed yet"
                hint="Campaign costs appear here as soon as a budget is agreed and the roster is priced." />
            </div>
          : <>
              {/* What the page adds up to, before the detail. Hairlines are
                  the grid's own `gap-px` showing the container through, so
                  they land correctly however the row wraps — fixed column
                  counts (not auto-fit) keep that predictable. */}
              <Panel reveal className="mt-6 overflow-hidden">
                <Stagger animate="show" stagger={0.07}
                  className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-6">
                  {/* `tick` carries the legend here rather than the figure's
                      colour — the creator/fee split is the page's argument.
                      Figures stay in one ink, as they do portal-wide. */}
                  <KPI flush size="sm" index={0} color={INK} label="Total billed"
                    value={totals.billed} format={fmtINRExact} sublabel="agreed budgets, ex-tax" />
                  <KPI flush size="sm" index={1} color={INK} tick={CREATOR_COLOR} label="To creators"
                    value={totals.creators} format={fmtINRExact} sublabel={shareOf(totals.creators, split)} />
                  <KPI flush size="sm" index={2} color={INK} tick={FEE_COLOR} label="Agency fees"
                    value={totals.fees} format={fmtINRExact} sublabel={shareOf(totals.fees, split)} />
                  <KPI flush size="sm" index={3} color={INK} label={`GST @ ${GST_RATE * 100}%`}
                    value={totals.gst} format={fmtINRExact} sublabel="on agreed budgets" />
                  <KPI flush size="sm" index={4} color={INK} label="Total payable"
                    value={totals.payable} format={fmtINRExact} sublabel="inclusive of GST" />
                  <KPI flush size="sm" index={5} color={INK} label="Campaigns"
                    value={n} format={Math.round} sublabel="with costs to show" />
                </Stagger>

                {/* Just the creator/fee proportion, NOT AllocationBar: that
                    scales against the budget, and pending campaigns add lines
                    without one — account-wide it would cry "over budget". */}
                {split > 0 && (
                  <div className="border-t border-line px-5 py-4 sm:px-6">
                    <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-well">
                      <Bar pct={(totals.creators / split) * 100} color={CREATOR_COLOR} className="h-full rounded-l-full" />
                      <Bar pct={(totals.fees / split) * 100} color={FEE_COLOR} delay={80} className="h-full rounded-r-full" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-mute">
                      <Key color={CREATOR_COLOR} label="Creators" value={totals.creators} />
                      <Key color={FEE_COLOR} label="Agency fee" value={totals.fees} />
                      <span>across {n} campaign{n === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                )}
              </Panel>

              {/* Two up from xl: a bill is read against one invoice at a time,
                  so the second column costs nothing and keeps each statement
                  near the ~700px a name/share/figure row wants. `items-start`
                  so a two-creator campaign doesn't stretch to match a thirty. */}
              <Section eyebrow="Statements" title="Every campaign, line by line"
                hint="What each creator was charged, the agency fee, and what the campaign comes to with tax.">
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  {campaigns.map((c, i) => <CampaignBill key={c.id} c={c} index={i} />)}
                </div>
              </Section>

              <p className="mt-8 max-w-[78ch] text-[11px] leading-relaxed text-mute">
                Figures are the agreed cost per creator and the agency fee for each campaign. GST is charged at {GST_RATE * 100}% on the
                agreed campaign budget and is stated separately — every other figure on this page, and everywhere else in the portal, is
                exclusive of tax. A campaign whose budget is still to be confirmed carries no GST figure yet.
              </p>
            </>}
      </div>
    </div>
  );
}
