# Dart Scorekeeper

A local-first X01 dart scoring app built with Next.js.

## Current Version

v0.4.0-alpha.1

## In Development

v0.4.0 — portable persistence foundation plus graphical dartboard/full-screen scoring refinements.

Current development branch:

```text
agent/portable-persistence-foundation
```

## Current Features

- 301 / 501 / 701 X01 scoring
- Straight-out and double-out finishes
- Total-turn score entry
- Dart-by-dart graphical score entry
- Singles, doubles, and larger team matches
- Uneven team sizes
- Dummy-score rotation for missing players
- Undo last turn
- Completed leg history
- Dart details in history
- Compact / full scoring layouts
- Game Mode compact navigation during active matches
- Full-screen/tablet dartboard mode
- Local browser save/resume
- Theme and branding settings
- Feedback form with diagnostics

## Portable Persistence Foundation

The application is being structured so hosting and database providers remain replaceable.

- SQLite is the canonical database dialect.
- Drizzle owns schema/migrations.
- Persistence is accessed through `lib/db/repositories/` rather than directly from UI code.
- `libSQL` is the current adapter and supports both local `file:` databases and remote Turso.
- Production does not silently fall back to a local database file.
- Docker/self-hosting uses a persistent `/data` volume.
- A future Cloudflare D1 implementation can be added behind the adapter boundary.

See `docs/architecture/persistence.md` for the portability contract.

The initial `app_metadata` table is deliberately small: it proves the full persistence path before the player/match/league schema is designed.

## Local Development

Install dependencies:

```powershell
npm install
```

Copy the environment example if you want explicit local settings:

```powershell
Copy-Item .env.example .env.local
```

Without a production `DATABASE_URL`, local development defaults to:

```text
file:./data/dart-scorekeeper.db
```

Generate and apply database migrations:

```powershell
npm run db:generate
npm run db:migrate
```

Run the dev server:

```powershell
npm run dev
```

Run on the local network for tablet testing:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Build and lint:

```powershell
npm run lint
npm run build
```

Database connectivity can be checked at:

```text
/api/health/db
```

The endpoint never returns database credentials.

## Vercel + Turso

Vercel remains the current hosted deployment target. Configure these server-side environment variables when remote persistence is enabled:

```env
DB_PROVIDER=libsql
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-token
```

Optional tester feedback:

```env
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://formspree.io/f/your-form-id
```

Do not expose database credentials through `NEXT_PUBLIC_*` variables.

## Docker / Local Hosting

A Docker portability target is included from the beginning:

```powershell
docker compose up --build
```

The Compose profile stores the SQLite/libSQL database in a named persistent volume mounted at `/data` and applies committed migrations before the app starts.

## Known Limitations

- X01 is the only supported game type right now.
- The persistent backend is foundation-only; active match data still lives in browser storage.
- No player/league/tournament database model has been introduced yet.
- Offline synchronization beyond existing browser save/resume is not implemented yet.
- Feedback submission requires an internet connection.

## Tester Notes

Current scoring tests should focus on:

- Full-screen board Exit behavior, including when Auto is enabled
- Full-screen state across normal and dummy turns
- Graphical dartboard input
- Checkout suggestions and checkout completion
- Undo behavior
- Team rotation and uneven teams
- Local browser save/resume
