# AI Placement Mentor

Placement readiness mentor for students: collect academic/profile context and a resume, run a deterministic readiness analysis, then present mentor-style diagnosis on a dashboard.

This README reflects the **current working state** of the repo (analysis V2 + Gemini language layer on branch `bugfix` / post-merge with `main`).

## Stack

| Layer | Tech |
|--------|------|
| Frontend | Next.js (App Router), React, Tailwind, Zustand |
| Backend | Express, Prisma, PostgreSQL (Neon) |
| AI | Google Gemini (`@google/generative-ai`) for language only |
| Auth | Email/password, bcrypt, JWT in `localStorage` |

## Repository layout

```
AI-Placement-Mentor/
├── client/                 # Next.js app (port 3000)
│   └── src/app/
│       ├── page.tsx        # Landing + login/signup modals
│       ├── setup/          # Onboarding wizard
│       ├── setup/analysis/ # Runs analysis, then redirects
│       └── dashboard/      # Readiness dashboard
├── server/                 # Express API (port 8000)
│   ├── routes/             # /api/auth, /api/ai
│   ├── services/
│   │   ├── placementAnalysis/  # V2 snapshot → language → public DTO
│   │   └── readiness/          # Resume parse, role normalize, scoring inputs
│   ├── prisma/             # User + PlacementProfile
│   └── test/               # Node test runner
└── AUTH_README.md          # Detailed auth inspection notes
```

## Product flow (current)

1. **Landing** (`/`) — Login / Sign up modals.
2. **Signup** → JWT stored → `/setup`.
3. **Login** → JWT stored → `/dashboard` if onboarding complete, else `/setup`.
4. **Setup** (5 steps) — academic info, skills, goals, timeline, resume; steps save to Neon via auth APIs.
5. **Analysis** (`/setup/analysis`) — calls AI analysis endpoint; result kept in client Zustand (not stored in DB).
6. **Dashboard** (`/dashboard`) — readiness score, diagnosis, strengths, blockers, priority.

```text
Resume + profile
      │
      ▼
Deterministic snapshot (scores, strengths, blockers, risks, priority)
      │
      ▼
Presentation DTO (facts only for the LLM)
      │
      ▼
Gemini language pass (diagnosis + card copy)
      │
      ▼
Grounding validation
      │
      ├─ valid → Gemini text to UI
      ├─ invalid + LANGUAGE_PASS_UNGROUNDED_GEMINI (default ON) → Gemini text still to UI (logged as bypassed)
      └─ invalid + flag OFF / API failure → deterministic fallback text
      │
      ▼
Public analysis V2 → client dashboard
```

## Analysis design (important)

- **Scoring and insight selection are deterministic.** Gemini does not invent the score or which blockers exist.
- Gemini writes **language** over approved facts.
- Grounding rejects unsupported claims (wrong numbers, invented projects, etc.).
- Feature flag **`LANGUAGE_PASS_UNGROUNDED_GEMINI`** (server env):
  - **Default ON** when unset — if grounding fails but JSON parsed, still show Gemini text.
  - Set to `false` / `0` / `off` / `no` for strict fallback-only behavior.
  - API errors, timeouts, and bad JSON always fall back.

## Local setup

### Prerequisites

- Node.js 20+ recommended
- Neon (or other Postgres) database
- Gemini API key

### 1. Backend

```bash
cd server
npm install
```

Create `server/.env` (do not commit):

```env
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
# Optional; default is ON
LANGUAGE_PASS_UNGROUNDED_GEMINI=true
```

```bash
npx prisma generate
npx prisma db push
node server.js
```

API: `http://localhost:8000`

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

App: `http://localhost:3000`

The client currently calls the API at `http://localhost:8000` (hardcoded in several forms/pages).

### Tests

```bash
cd server
npm test

cd client
npm run test:analysis
```

## Data model (today)

Persisted in Postgres:

- **User** — account, onboarding step flags
- **PlacementProfile** — branch/year/CGPA, skills, company/role targets, study hours, resume text/URL

**Not** persisted: full analysis/diagnosis payload (lives in client Zustand persist: `placement-analysis-store`).

## Known gaps / next UX work

These are known and planned separately from analysis quality:

| Issue | Current behavior |
|--------|------------------|
| Browser Back from dashboard | History uses `router.push` through `/` → setup → analysis → dashboard, so Back can return to the public landing with Login/Signup |
| Session after login | JWT is in `localStorage`; login does not always hydrate Zustand `user` the same way signup does |
| Edit / refill profile | No dashboard control; completed users hitting `/setup` are redirected away |
| Logout | Store has `logout`, but it is unused and does not clear the JWT |
| Action Plan UI | Dashboard action plan is still a stub |
| Route guards | No Next middleware / AuthGuard; `/dashboard` relies on client state |

## Related docs

- [`AUTH_README.md`](AUTH_README.md) — deep dive on auth flows and risks (static inspection)

## Branch note

Recent work (Gemini grounding improvements, dashboard V2 explanation, ungrounded-language flag) lives on **`bugfix`**, merged with latest **`main`**. Prefer opening PRs from `bugfix` into `main` after review.
