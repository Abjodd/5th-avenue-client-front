/**
 * True below the "md" breakpoint (768px) — the same cutover Tailwind's own
 * md: prefix uses everywhere else in this app (AppShell's "hidden sm:flex"
 * neighbours, Overview's own lg: collapses, …), so a component branching on
 * this agrees with the CSS already shipping rather than inventing a second
 * opinion about where "mobile" starts.
 *
 * Backed by matchMedia + its change event, not a resize listener polling
 * window.innerWidth — it only re-renders on an actual breakpoint crossing,
 * not every pixel of a desktop window being dragged narrower.
 */
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setIsMobile(mql.matches); // the query string can change between renders
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
