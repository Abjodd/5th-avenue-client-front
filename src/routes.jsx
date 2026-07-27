/**
 * 5th Avenue — merged route table.
 *
 * Two apps behind one origin:
 *   · the public marketing site at the root, wrapped in <MarketingLayout/>
 *     (nav + footer + film grain, [data-marketing] token scope);
 *   · the real, backend-wired client portal under /portal/*, behind
 *     <ProtectedRoute/> and inside <AppShell/>.
 *
 * /login is the seam: the marketing nav's "Client login" lands there, and a
 * successful sign-in continues to /portal/overview.
 *
 * Route-level code splitting throughout — an unauthenticated visitor reading
 * the landing page should never download recharts or the India map paths.
 */
import { Suspense, lazy, useEffect } from "react";
import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";

import ProtectedRoute from "./routes/ProtectedRoute";
import { PageSkeleton } from "./components/PageStates";
import NotFound from "./pages/NotFound";

/**
 * A data router does not reset scroll between routes, so navigating from
 * halfway down the landing page to /apply used to land you halfway down that
 * page too (clamped to its height). This resets every navigation to the top,
 * for every route — the marketing layout only covered its own children, and
 * /apply, /start and /login sit outside it.
 *
 * In-page anchors keep their behaviour: a navigation carrying a hash is left
 * alone so the browser can jump to the target.
 */
function RootLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return <Outlet />;
}

/* ── Public marketing site ── */
const MarketingLayout = lazy(() => import("./layout/MarketingLayout"));
const LandingPage = lazy(() => import("./pages/landing/LandingPage"));
const NetworkPage = lazy(() => import("./pages/marketing/NetworkPage"));
const InternationalPage = lazy(() => import("./pages/marketing/InternationalPage"));
const TechPage = lazy(() => import("./pages/marketing/TechPage"));
const CreativesPage = lazy(() => import("./pages/marketing/CreativesPage"));
const PortfolioPage = lazy(() => import("./pages/marketing/PortfolioPage"));
const LegalPage = lazy(() => import("./pages/legal/LegalPage"));
const CareersPage = lazy(() => import("./pages/careers/CareersPage"));
const ApplyPage = lazy(() => import("./pages/apply/ApplyPage"));
const StartProjectPage = lazy(() => import("./pages/start/StartProjectPage"));
const Styleguide = lazy(() => import("./pages/Styleguide"));

/* ── Client portal (real data) ── */
const PortalLayout = lazy(() => import("./layout/PortalLayout"));
const Login = lazy(() => import("./pages/Login"));
const Overview = lazy(() => import("./pages/Overview"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const RegionalMap = lazy(() => import("./pages/RegionalMap"));
const Profile = lazy(() => import("./pages/Profile"));

/** Suspense boundary for a lazily-loaded route element. The marketing site
    fades in from a bare tinted panel; the portal shows its own skeleton. */
function S({ children, portal = false }) {
  return (
    <Suspense fallback={portal ? <PageSkeleton /> : <div className="min-h-screen bg-page" />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
{
  element: <RootLayout />,
  children: [
  {
    element: (
      <S>
        <MarketingLayout />
      </S>
    ),
    children: [
      { index: true, element: <LandingPage /> },
      { path: "regional", element: <NetworkPage /> },
      { path: "international", element: <InternationalPage /> },
      { path: "tech", element: <TechPage /> },
      { path: "creatives", element: <CreativesPage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "legal", element: <LegalPage /> },
      { path: "legal/:doc", element: <LegalPage /> },
      { path: "careers", element: <CareersPage /> },
    ],
  },

  /* Standalone public pages — their own full-bleed chrome, no marketing nav. */
  { path: "/apply", element: <S><ApplyPage /></S> },
  { path: "/start", element: <S><StartProjectPage /></S> },
  { path: "/login", element: <S portal><Login /></S> },

  /* The portal proper. */
  {
    path: "/portal",
    element: (
      <S portal>
        <ProtectedRoute>
          <PortalLayout />
        </ProtectedRoute>
      </S>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: "overview", element: <Overview /> },
      { path: "campaigns", element: <Campaigns /> },
      { path: "regional", element: <RegionalMap /> },
      { path: "profile", element: <Profile /> },
      { path: "*", element: <Navigate to="/portal/overview" replace /> },
    ],
  },

  /* The portal used to live at the root of this repo (/overview, /campaigns,
     …). It is deployed and clients may hold bookmarks, so the old paths still
     resolve — they just forward to their /portal equivalent. Note that
     /regional is NOT redirected: it now belongs to the public Network page. */
  { path: "/overview", element: <Navigate to="/portal/overview" replace /> },
  { path: "/campaigns", element: <Navigate to="/portal/campaigns" replace /> },
  { path: "/profile", element: <Navigate to="/portal/profile" replace /> },

  ...(import.meta.env.DEV
    ? [{ path: "/styleguide", element: <S><Styleguide /></S> }]
    : []),

  { path: "*", element: <NotFound /> },
  ],
},
]);
