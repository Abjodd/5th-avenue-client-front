// src/components/intro/BrandIntro.jsx — cinematic "brand performance story".
// Full-screen overlay that steps through the brand's real headline metrics
// (derived from Overview's kpis memo — nothing invented), then hands off to the
// dashboard. Plays once per login: AuthContext clears the sessionStorage flag on
// login; Overview mounts this only while the flag is absent.
// Skip: X (top-right), Esc, or clicking through the steps.

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import AnimatedNumber from "../AnimatedNumber";
import { fmtNum, fmtINR } from "../../lib/format";
import { EASE } from "../../lib/motion";
import { INTRO_KEY } from "../../lib/session";

const STEP_MS = 2400;

/* Per-step text choreography */
const lineUp = {
  hidden: { opacity: 0, y: 26 },
  show: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE, delay: 0.08 + i * 0.12 } }),
  exit: { opacity: 0, y: -18, transition: { duration: 0.3, ease: "easeIn" } },
};

function Step({ children }) {
  return (
    <motion.div
      key="step"
      className="flex flex-col items-center gap-3 px-6 text-center"
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

const Kicker = ({ i = 0, children }) => (
  <motion.div custom={i} variants={lineUp} className="microlabel !text-[11px] tracking-[0.22em] text-mute">
    {children}
  </motion.div>
);

const Big = ({ i = 1, color = "var(--color-ink)", children }) => (
  <motion.div
    custom={i}
    variants={lineUp}
    className="font-serif text-[clamp(56px,9vw,110px)] font-bold italic leading-[1.02] tracking-[-0.03em]"
    style={{ color }}
  >
    {children}
  </motion.div>
);

const Sub = ({ i = 2, children }) => (
  <motion.div custom={i} variants={lineUp} className="max-w-md text-[15px] leading-relaxed text-sub">
    {children}
  </motion.div>
);

export default function BrandIntro({ data, onDone, onClosed }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  /* Build steps from real data only — zero-value slides are dropped */
  const steps = useMemo(() => {
    const s = [];
    s.push(
      <Step key="hello">
        <Kicker>5th Avenue · Client Portal</Kicker>
        <Big>
          Hello, <span className="text-accent">{data.clientName}</span>
        </Big>
        <Sub>Here's the story of your brand so far.</Sub>
      </Step>
    );
    if (data.totalCampaigns > 0)
      s.push(
        <Step key="campaigns">
          <Kicker>Campaigns</Kicker>
          <Big color="var(--color-accent)">
            <AnimatedNumber value={data.totalCampaigns} duration={1100} />
          </Big>
          <Sub>
            campaign{data.totalCampaigns === 1 ? "" : "s"} in motion
            {data.activeCampaigns > 0 && data.activeCampaigns !== data.totalCampaigns
              ? ` — ${data.activeCampaigns} currently active`
              : ""}
          </Sub>
        </Step>
      );
    if (data.creators > 0)
      s.push(
        <Step key="creators">
          <Kicker>Your voices</Kicker>
          <Big color="var(--color-green)">
            <AnimatedNumber value={data.creators} duration={1100} />
          </Big>
          <Sub>
            creator{data.creators === 1 ? "" : "s"}
            {data.followers > 0 ? (
              <>
                {" "}
                reaching a combined audience of <b className="text-ink">{fmtNum(data.followers)}</b>
              </>
            ) : null}
          </Sub>
        </Step>
      );
    if (data.avgER > 0)
      s.push(
        <Step key="er">
          <Kicker>Engagement</Kicker>
          <Big color="var(--color-amber)">
            <AnimatedNumber value={data.avgER} duration={1100} format={(v) => `${v.toFixed(1)}%`} />
          </Big>
          <Sub>average engagement rate across your creators</Sub>
        </Step>
      );
    if (data.budget > 0)
      s.push(
        <Step key="budget">
          <Kicker>Investment</Kicker>
          <Big color="var(--color-purple)">
            <AnimatedNumber value={data.budget} duration={1200} format={fmtINR} />
          </Big>
          <Sub>committed across your campaigns</Sub>
        </Step>
      );
    s.push(
      <Step key="close">
        <Big>
          Here's where <span className="text-accent">everything</span> stands.
        </Big>
      </Step>
    );
    return s;
  }, [data]);

  const finish = useCallback(() => {
    sessionStorage.setItem(INTRO_KEY, "1");
    setLeaving(true);
    // Hand off immediately: the dashboard cascades in beneath the fading
    // overlay (also keeps the handoff robust if rAF is throttled/paused —
    // onExitComplete alone can be delayed in background tabs).
    onDone?.();
  }, [onDone]);

  const advance = useCallback(() => {
    setStep((p) => {
      if (p >= steps.length - 1) {
        finish();
        return p;
      }
      return p + 1;
    });
  }, [steps.length, finish]);

  /* Auto-advance */
  useEffect(() => {
    if (leaving) return;
    const t = setTimeout(advance, STEP_MS);
    return () => clearTimeout(t);
  }, [step, leaving, advance]);

  /* Esc skips */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  return (
    <AnimatePresence onExitComplete={onClosed}>
      {!leaving && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[500] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-page"
          onClick={advance}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.55, ease: EASE } }}
          role="dialog"
          aria-label="Brand performance story"
        >
          {/* Ambient blobs — same family as the dashboard's background */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="ambient-blob absolute left-[-140px] top-[-100px] h-[440px] w-[440px] rounded-full blur-[120px]" style={{ background: "var(--color-accent)", opacity: 0.09 }} />
            <div className="ambient-blob absolute bottom-[-160px] right-[-120px] h-[460px] w-[460px] rounded-full blur-[130px]" style={{ background: "var(--color-purple)", opacity: 0.07, animationDelay: "-9s" }} />
            <div className="ambient-blob absolute bottom-[10%] left-[22%] h-[360px] w-[360px] rounded-full blur-[110px]" style={{ background: "var(--color-gold)", opacity: 0.07, animationDelay: "-16s" }} />
          </div>

          {/* Skip */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            aria-label="Skip intro"
            className="absolute right-6 top-6 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white/60 text-[15px] text-sub shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:text-ink hover:shadow-md"
          >
            ✕
          </button>

          {/* Steps */}
          <div className="relative flex w-full max-w-4xl items-center justify-center">
            <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="absolute bottom-10 flex items-center gap-2">
            {steps.map((_, i) => (
              <motion.span
                key={i}
                className="h-[6px] rounded-full"
                animate={{
                  width: i === step ? 22 : 6,
                  backgroundColor: i === step ? "var(--color-accent)" : "rgba(25,22,17,0.18)",
                }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            ))}
          </div>
          <div className="absolute bottom-4 text-[10.5px] uppercase tracking-[0.16em] text-mute">
            Click to continue · Esc to skip
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
