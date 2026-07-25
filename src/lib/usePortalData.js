// src/lib/usePortalData.js — shared data-fetching hook for the portal pages.
// One place for the loading/error/retry lifecycle that Overview, Campaigns and
// RegionalMap previously each hand-rolled. Guards against stale responses
// landing after unmount or after the user (clientName) changes.

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { PortalAPI } from "./api";

/**
 * Fetch this client's campaigns. `map` (optional) transforms the raw response
 * once on arrival — pass a stable (module-level) function.
 * Returns { data, setData, error, retry }; data is null while loading.
 */
export function usePortalCampaigns(map) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user?.clientName) return;
    let alive = true;
    setData(null);
    setError(null);
    PortalAPI.campaigns(user.clientName)
      .then(d => { if (alive) setData(map ? map(d) : d); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [user?.clientName, map, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { data, setData, error, retry };
}
