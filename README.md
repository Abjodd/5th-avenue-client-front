# 5th Avenue — Marketing Site + Client Portal

**What:** The public 5th Avenue marketing site and the client-facing portal, in one app on one origin. The marketing site (landing, Regional network, International, Tech, Creatives, Portfolio, Careers, Legal, plus the `/apply` and `/start` lead forms) is public. The portal under `/portal/*` is a read-only view of a brand's campaigns — Overview dashboard (KPIs, creator breakdowns, Performance analytics), Campaigns board, Regional Map and Profile. Each login is scoped to exactly one client; a brand can only ever see its own data.

**Why:** These were two repos — `5th-client-main` (the marketing site) and this one (the portal). Visitors had to cross an origin to sign in, the two shared no components, and the design tokens had drifted apart. They were merged so "Client login" is an in-app route, the primitives and chart library are shared, and there is one theme control for both.

**How:** React 19 + Vite 8 + Tailwind 4 + Recharts + GSAP/Motion. Routed with `react-router-dom` v7's data router (`src/routes.jsx`). The marketing pages sit under `MarketingLayout`, the portal under `ProtectedRoute` → `PortalLayout` → `AppShell`. Everything is route-split with `lazy()`/`Suspense`, so someone reading the landing page never downloads Recharts or the India map path data.

The codebase is deliberately **mixed TypeScript and JavaScript** — the marketing site is `.tsx`, the portal is `.jsx`. Vite compiles both; `npm run typecheck` covers the TS side only (`checkJs` is off). There is no conversion pass planned.

## Theme

One provider — `src/context/ThemeContext.jsx` — owns the theme for the whole app. It defaults to **System** (`prefers-color-scheme`, live-updating if the OS flips) and a toggle sets an explicit Light/Dark override, persisted under the `5av_theme` key. The resolved theme is written to `<html data-theme>`; an inline script in `index.html` applies it before first paint so there is no flash. Both the marketing nav's toggle and the portal's `ThemeToggle` drive the same provider, so the theme carries across the login seam.

**Two identities, one vocabulary.** `src/styles/index.css` carries both palettes — the portal's warm-paper neutrals + indigo-navy accent (mirroring `5th-internal-front`), and the marketing site's navy-dark look — behind a single set of Tailwind utility names. Raw values live on scope selectors and `@theme inline` maps them to utilities, so `bg-surface` resolves to white inside the portal and to `#040927` inside `<MarketingLayout/>`, with no branching in components:

```
:root, [data-theme="light"]                   → portal light   (document default)
[data-theme="dark"]                           → portal dark
[data-marketing]                              → marketing dark
:root[data-theme="light"] [data-marketing]    → marketing light
```

The portal is the document default on purpose: overlays that escape their DOM scope via `createPortal` land on `<body>` and inherit portal values. Both vocabularies (`page`/`bg`, `sub`/`ink-2`, `mute`/`ink-3`, `line-mid`/`line-strong`) are defined in **both** scopes, so a component written for either side renders correctly on the other.

## Auth

Login calls the backend's `POST /api/auth/portal-login`, which checks a hashed password against the `BrandCredential` collection (managed from the founder-only Auth page in `5th-internal-front`) and resolves that credential's `brandId` to a real `Client` document, returning `clientName`. Every subsequent API call in this app is scoped to that `clientName` — a login can only ever see the one client it's linked to. If a credential's `brandId` doesn't resolve to a real client yet, login fails closed rather than falling back to any default.

This is password-hash auth with no session token yet (no JWT/cookie) — fine for showing the portal to a stakeholder, but real session verification should land before this is exposed beyond a trusted network.

## Backend

Everything talks to the shared `5th-internal-back` (Express + Mongoose/Atlas) via `VITE_API_URL`, default `http://localhost:4000`.

| Surface | Endpoint | Effect |
|---|---|---|
| Portal pages | `GET /api/portal/campaigns?client=…` | campaigns + embedded creators |
| Settings → Company | `GET /api/portal/client?client=…` | the brand's own company record (allowlisted) |
| Overview → Performance | `GET /api/portal/analytics` | period-bucketed timeseries + spend split |
| `/start` (Start a project) | `POST /api/client-requests` | saves a `ClientRequest`, emails the founder |
| `/apply` (Apply as a creator) | `POST /api/creator-requests` | saves a `CreatorRequest`, emails the founder |
| `/careers` application | `POST /api/submit-form` | Vercel edge function → Resend email only, no DB |

The backend's internal 16-stage pipeline is collapsed to a 5-phase client view (`src/lib/phases.js`). Campaign `start`/`end` dates are ISO (`YYYY-MM-DD`) end to end; `src/lib/dates.js` only parses that format.

> `VITE_API_URL` must be set in the deployment environment, or the two lead forms will POST to `localhost:4000` in production and silently fail for visitors.

## Quick Start

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires `5th-internal-back` running (default `http://localhost:4000`; override with `VITE_API_URL`). `npm run build` deliberately does not type-check — run `npm run typecheck` separately.

`npm test` runs the portal's metrics suite (`src/lib/portalMetrics.test.js`) on Node's built-in test runner — no framework, no bundler. Everything the portal computes from a payload lives in `src/lib/portalMetrics.js` as pure functions precisely so it can be tested that way; see `scrap/CODEBASE_DOCUMENTATION_CLIENT.md` for the rules that module enforces.

## Structure

```
api/submit-form.ts        # Vercel edge function — careers form → Resend
public/                   # marketing imagery, logos, favicon, hero video
src/
├── main.jsx              # entry: ThemeProvider → AuthProvider → RouterProvider
├── routes.jsx            # single merged route table + global scroll reset
├── styles/index.css      # both palettes, one utility vocabulary (see Theme)
├── context.js            # useApp() — page, setPage, navParams, palette P
├── context/              # ThemeContext.jsx (unified), AuthContext.jsx
├── routes/               # ProtectedRoute.jsx
├── layout/               # MarketingLayout.tsx, PortalLayout.jsx, AppShell.jsx
├── motion/               # GSAP setup, useReveal, tokens, reducedMotion
├── components/
│   ├── primitives/       # Button, Card, Input, Modal, Sheet, Toast, … (shared)
│   ├── charts/           # Sparkline, LineChart, DonutChart, Funnel, BarList, … (shared)
│   ├── portal/Shell.jsx  # portal layout vocabulary: Panel, Section, KPI, MetricSwitch
│   ├── map/IndiaMap.tsx
│   └── …                 # portal-specific: PageStates, PerformanceSection, campaigns/
├── lib/
│   ├── api.js            # portal fetch wrapper
│   ├── portalMetrics.js  # every derived portal figure, pure + unit-tested
│   ├── clientRequests.ts # the two lead forms → backend
│   ├── submitForm.ts     # careers form → edge function
│   └── marketing/data/   # landing copy, services, careers, map data
└── pages/
    ├── landing/ marketing/ legal/ careers/ apply/ start/   # public (.tsx)
    └── Login Overview Campaigns RegionalMap Profile        # portal (.jsx; Profile = Settings)
```

### Legacy portal URLs

The portal used to live at this repo's root. `/overview`, `/campaigns` and `/profile` still resolve — they redirect to their `/portal/*` equivalent. `/regional` is **not** redirected: it now serves the public Network page, and the portal's map is `/portal/regional`.
