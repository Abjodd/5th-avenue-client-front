# 5th Avenue — Client Portal

**What:** Client-facing portal for 5th Avenue Marketing, scoped to a single client (default: FreshBite Foods). Read-only view of their campaigns — Overview dashboard, Campaigns board, and Regional Map.

**Why:** Clients need visibility into their campaigns without access to the internal dashboard. This is a trimmed sibling of `5th-internal-front` — same design system and patterns, but only client-safe data and pages. Billing, Notifications, Settings, and the extra Overview tabs live in the `5th-front` reference repo and return in later phases.

**How:** React 18 + Vite 6 + Tailwind 4. No router — a page table in `src/App.jsx` with `setPage()` navigation via shared context (`src/context.js`). Every page fetches `GET /api/portal/campaigns` from the shared `5th-internal-back` backend (`src/lib/api.js`) and derives its own view. The backend's internal 16-stage pipeline is collapsed to a 5-phase client view (`src/lib/phases.js`). Light theme only.

No auth yet — the client is hardcoded via `CLIENT_NAME` / `VITE_CLIENT_NAME` until portal JWT auth lands on the backend.

## Quick Start

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires `5th-internal-back` running (default `http://localhost:4000`; override with `VITE_API_URL`).

## Structure

```
src/
├── App.jsx           # Page table + navigation state
├── context.js        # useApp() — page, setPage, navParams, palette P
├── layout/AppShell.jsx  # Top bar, nav tabs, client label
├── lib/              # api.js (fetch + stage→phase), phases.js, geo.js, format.js
├── components/       # Dot, StatusPill, PageStates (skeleton/error/empty)
└── pages/            # Overview, Campaigns, RegionalMap
```

# 5th-avenue-client-front
