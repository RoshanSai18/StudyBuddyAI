# Quillo (StudyBuddyAI) frontend

React + Vite (JavaScript). Run the API first (`cd backend && npm run dev`, port 4000), then:

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173  (/api is proxied to :4000)
```

Sign in with the demo account shown on the login page (client-side gate; the backend has no auth).

## Pages (`src/pages`)

| Route | Page | Source |
|---|---|---|
| `/` | LandingPage | `frontend-references/Landing page-html` (ported 1:1) |
| `/login` | LoginPage | `frontend-references/Log in-html` (ported 1:1) |
| `/dashboard` | DashboardPage | `frontend-references/Dashboard (after login)-html` (ported 1:1; only the sidebar is new) |
| `/strategy` `/priorities` `/plan` `/learn/:topic` `/quiz[/:topic]` | StrategyPage, PrioritiesPage, PlanPage, LearnPage, QuizPage | no reference HTML; built from the dashboard's own tokens/classes, wired to the API |

Each reference design's CSS lives verbatim in `src/styles/{landing,login,dashboard}.css` and is mounted only while its page is on screen (`useScopedStyle`),
because the three designs define clashing global classes. `src/styles/study.css` only styles the new pages. Sidebar: `src/components/Sidebar.jsx`.
All backend calls: `src/api/client.js`.
