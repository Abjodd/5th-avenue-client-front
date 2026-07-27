import { useEffect, useRef, useState } from "react";

export type PresenceStage = "open" | "closing";

interface PresenceResult {
  /** Whether the element should be in the tree at all. */
  mounted: boolean;
  /** "open" while visible, "closing" while the exit animation plays. */
  stage: PresenceStage;
}

/** Mount/unmount with room for an exit animation (GSAP's AnimatePresence).
    While `open` is false but the exit is playing, `mounted` stays true and
    `stage` is "closing" — components run their exit tween keyed off that,
    and the element unmounts after `exitMs`. */
export function usePresence(open: boolean, exitMs = 250): PresenceResult {
  const [mounted, setMounted] = useState(open);
  const [stage, setStage] = useState<PresenceStage>("open");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      setStage("open");
    } else if (mounted) {
      setStage("closing");
      timer.current = setTimeout(() => setMounted(false), exitMs);
    }
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { mounted, stage };
}
