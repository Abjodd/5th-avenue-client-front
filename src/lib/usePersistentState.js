// src/lib/usePersistentState.js — useState that survives leaving the page.
//
// A filter is a decision the brand made, not transient UI state: narrowing the
// Overview to two niches and then glancing at Campaigns used to throw the
// choice away, because every page component unmounts on navigation. Stored in
// sessionStorage under the same `5av_` namespace as the session itself, so it
// lasts the session, is cleared on sign-out (see AuthContext.logout) and never
// follows one brand's login into the next.

import { useState, useEffect } from "react";

/** Keys are namespaced so logout can drop every one of them in a sweep. */
export const PERSIST_PREFIX = "5av_ui:";

export function usePersistentState(key, initial) {
  const storageKey = PERSIST_PREFIX + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* private mode */ }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Drop every persisted UI choice — one brand's filters are not the next's. */
export function clearPersistedState() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PERSIST_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* private mode */ }
}
