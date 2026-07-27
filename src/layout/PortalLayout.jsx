/**
 * Chrome + navigation context for every signed-in portal page.
 *
 * Keeps the setPage(page, params) API the pages already use, but backed by the
 * router: params travel as location.state so deep links survive a refresh.
 * Page ids stay bare ("overview", "campaigns") — the /portal prefix is applied
 * here, so no page component needs to know where the portal is mounted.
 */
import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AppContext } from "../context";
import { useTheme } from "../context/ThemeContext";
import { PageSkeleton } from "../components/PageStates";
import AppShell from "./AppShell";

const BASE = "/portal";

export default function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { P } = useTheme();

  const page =
    location.pathname.replace(new RegExp(`^${BASE}/?`), "").replace(/\/$/, "") ||
    "overview";

  const setPage = (newPage, params = {}) => {
    navigate(`${BASE}/${newPage}`, { state: params });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppContext.Provider value={{ page, setPage, navParams: location.state || {}, P }}>
      <MotionConfig reducedMotion="user">
        <AppShell>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </AppShell>
      </MotionConfig>
    </AppContext.Provider>
  );
}
