# 5th Avenue — Client Portal

**What:** Client-facing portal for 5th Avenue Marketing. Read-only view of a brand's campaigns — Overview dashboard (KPIs, creator breakdowns, Performance analytics), Campaigns board, and Regional Map. Each login is scoped to exactly one client; a brand can only ever see its own data.

**Why:** Clients need visibility into their campaigns without access to the internal dashboard. This is a trimmed sibling of `5th-internal-front` — same design system and patterns, but only client-safe data and pages. Billing, Notifications, Settings, and the extra Overview tabs live in the `5th-front` reference repo and return in later phases.

**How:** React 18 + Vite 6 + Tailwind 4 + Recharts. Routed with `react-router-dom` (`src/App.jsx`) — `/login` is public, everything else sits behind `ProtectedRoute` inside `AppShell`. `Overview`, `Campaigns`, and `RegionalMap` are route-split with `React.lazy()`/`Suspense` so an unauthenticated visitor's login page doesn't pull in Recharts or the India map path data.

Every page derives its view from `GET /api/portal/campaigns?client=<clientName>` against the shared `5th-internal-back` backend (`src/lib/api.js`); the Overview page's Performance section additionally calls `GET /api/portal/analytics` for period-bucketed spend/reach/engagement timeseries and a spend-by-service split. The backend's internal 16-stage pipeline is collapsed to a 5-phase client view (`src/lib/phases.js`). Light theme only — no separate dark mode.

## Auth

Login calls the backend's `POST /api/auth/portal-login`, which checks a hashed password against the `BrandCredential` collection (managed from the founder-only Auth page in `5th-internal-front`) and resolves that credential's `brandId` to a real `Client` document, returning `clientName`. Every subsequent API call in this app is scoped to that `clientName` — a login can only ever see the one client it's linked to. If a credential's `brandId` doesn't resolve to a real client yet (e.g. a brand created without a matching `Client` doc), login fails closed rather than falling back to any default.

This is password-hash auth with no session token yet (no JWT/cookie) — fine for showing the portal to a stakeholder, but real session verification should land before this is exposed beyond a trusted network.

Campaign `start`/`end` dates are stored as ISO (`YYYY-MM-DD`) end to end; `src/lib/dates.js` only parses that format.

## Quick Start

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires `5th-internal-back` running (default `http://localhost:4000`; override with `VITE_API_URL`).

## Structure

```
src/
├── App.jsx              # Routes (react-router-dom) + lazy-loaded pages
├── context.js            # useApp() — page, setPage, navParams, palette P
├── context/AuthContext.jsx  # login() against /api/auth/portal-login, session in sessionStorage
├── routes/ProtectedRoute.jsx
├── layout/AppShell.jsx   # Top bar, nav tabs, client label
├── lib/                  # api.js (fetch + stage→phase), dates.js, phases.js, geo.js, format.js
├── components/           # Dot, StatusPill, PageStates, PerformanceSection, PeriodFilter
└── pages/                # Login, Overview, Campaigns, RegionalMap
```
