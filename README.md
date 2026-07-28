# TradeIQ

A full-stack trading journal: log trades, grade your setups, and see real analytics (P&L heatmap, grade breakdown, session performance, and rule-based "AI coach" insights) computed from your own data — no mock numbers.

## Stack

- **Frontend**: React 18 + Vite, React Router, Chart.js
- **Backend**: Node.js + Express, JWT auth
- **Database**: PostgreSQL + Prisma ORM

## Project structure

```
tradeiq/
  backend/     Express API, Prisma schema, seed script
  frontend/    Vite + React app
  docker-compose.yml   optional: Postgres via Docker
```

## Prerequisites

You need Node.js 18+ and a running PostgreSQL instance. This machine didn't have either installed when this project was generated, so set them up first:

**Node.js** — install via [nodejs.org](https://nodejs.org) or Homebrew:
```
brew install node
```

**PostgreSQL** — either via Homebrew:
```
brew install postgresql@16
brew services start postgresql@16
createuser -s tradeiq
createdb -O tradeiq tradeiq
```
or via Docker, using the included `docker-compose.yml`:
```
docker compose up -d
```

## Setup

### 1. Backend

```
cd backend
cp .env.example .env
npm install
```

Edit `.env` if your Postgres credentials differ from the defaults (`tradeiq`/`tradeiq` on `localhost:5432`, matching both the Homebrew and Docker instructions above). Then create the schema and seed demo data:

```
npx prisma migrate dev --name init
npm run seed
```

The seed script creates a demo account with ~90 days of realistic trade history so the dashboard, heatmap, and AI patterns have real data to compute from:

```
email:    demo@tradeiq.app
password: demo1234
```

Start the API:
```
npm run dev
```
It listens on `http://localhost:4000`.

### 2. Frontend

In a second terminal:
```
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. The Vite dev server proxies `/api` to the backend, so no CORS config is needed locally.

## How the analytics work

Nothing on the dashboard is hardcoded. `backend/src/services/analytics.service.js` computes everything from the trades in your account:

- **Stats row** — net P&L, win rate, avg RR, average grade (GPA-weighted across A+/A/B/C/D), rule-break count & cost, each compared against the prior equivalent period.
- **Heatmap** — grouped by day, session, or week from your trades' `entryTime`.
- **Grade breakdown** — count, win rate, and P&L per grade bucket.
- **AI Patterns / AI Coach banner** — rule-based checks (not an LLM call) over your real trades: best-performing session, "revenge trading" (elevated C/D-grade trades after 3pm on a given weekday), and "early entry" (recent B-or-below trades marked as entered before confirmation). A pattern only appears once there's enough data to support it.

## Importing trades

The Trades page has an **Import Trades** button that accepts a CSV. Required columns: `symbol, direction, entry_time, pnl`. Optional columns (`exit_time, rr, grade, session, entry_price, exit_price, size, entry_confirmed, rule_broken, rule_note, notes`) are inferred when omitted:
- `grade` — derived from `rr` if missing (≥3R → A+, ≥2R → A, ≥1R → B, ≥0R → C, else D)
- `session` — derived from the UTC hour of `entry_time` (00–06 Asian, 07–11 London, 12–20 New York)

Click **Download CSV template** inside the import modal for a starter file with the exact headers.

## Notes / next steps

- Sidebar items beyond Dashboard and Trades (Analytics, Journal, Weekly Report, My Strategy, My Rules, Prop Firm Prep, Connections, Settings) are placeholders — the original prototype only had static nav labels for these, so no backing data model was built for them.
- Auth is JWT-in-localStorage for simplicity; move to httpOnly cookies before any real deployment.
- Manual trade entry uses your browser's local timezone for `entry_time`; session auto-detection assumes that time converts to UTC correctly, which it will for any standard timezone.
