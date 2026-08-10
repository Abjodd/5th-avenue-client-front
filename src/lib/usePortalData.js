// src/lib/usePortalData.js — shared data-fetching hooks for the portal pages.
// One place for the loading/error/retry lifecycle that Overview, Campaigns,
// the Regional Map and Settings would otherwise each hand-roll. Guards against
// stale responses landing after unmount or after the user (clientName) changes.

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { PortalAPI } from "./api";

/**
 * Fetch one client-scoped portal resource.
 *
 * `fetcher` takes the logged-in brand's clientName and must be a stable
 * (module-level) reference; `map` (optional) transforms the response once on
 * arrival and must be stable too — an inline arrow here re-runs the fetch on
 * every render. Returns { data, setData, error, retry }; data is null while
 * loading.
 */
function usePortalResource(fetcher, map) {
  const { user } = useAuth();
  const clientName = user?.clientName;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!clientName) return;
    let alive = true;
    setData(null);
    setError(null);
    fetcher(clientName)
      .then((d) => { if (alive) setData(map ? map(d) : d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [clientName, fetcher, map, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { data, setData, error, retry };
}

/** This client's campaigns, with their sanitized embedded creators. */
export const usePortalCampaigns = (map) => usePortalResource(PortalAPI.campaigns, map);

/** This client's own company record (Settings → Company). */
export const usePortalClient = () => usePortalResource(PortalAPI.client);
