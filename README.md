# Dart Scorekeeper

Dart Scorekeeper is a local-first darts scoring and league-management application built with Next.js, React, TypeScript, Drizzle, SQLite/libSQL, and Better Auth.

## Current Version

v0.5.0-alpha.24

## v0.5 Baseline

The application now uses one casual-first shell. The root page opens directly into Casual Play, while League / Game Night and scoring-device administration remain available from the app menu.

### Casual Play

- X01 starting scores from 101 through 901
- Straight-out and double-out finishes
- Best-of 1 / 3 / 5 / 7 / 9 legs
- Any number of individual players
- Singles, doubles, larger teams, uneven teams, and dummy-score rotation
- Total-turn and graphical dart-by-dart entry
- Checkout suggestions and checkout confirmation
- Undo, completed-leg history, match statistics, and completed-match history
- Orientation-aware Scoring View for phones, tablets, and laptops
- Named paused games with exact-state resume (up to five local saves)
- Local-first active scoring that does not depend on network availability

### League / Game Night

- Persistent leagues and seasons
- Master player directory with league membership and season rosters
- Player check-in and dues state per Game Night
- Game Night creation, lifecycle, templates, team preparation, and automatic layouts
- Fixture generation, rotations, multi-board completion, and Best-of rules
- Central league-match scoring and statistics
- Venues and persistent physical dartboards as shared resources
- Scoring-device registration, pairing, board assignment, and offline queue support
- Multiple leagues can share venue hardware without making devices league-owned

### Accounts and Persistence

- SQLite is the canonical database dialect
- Drizzle owns schema and migrations
- libSQL is the current adapter for both local SQLite and remote Turso
- Better Auth email/password accounts use the same portable database
- Completed casual matches can synchronize across signed-in devices
- Production never silently falls back to an ephemeral local database
- Docker/self-hosting uses a persistent `/data` volume

See `docs/architecture/persistence.md` for the persistence portability contract.

## Hosted Production

The current hosted target is Vercel with Turso/libSQL. Production expects these server-side variables:

```env
DB_PROVIDER=libsql
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-server-side-token
BETTER_AUTH_SECRET=your-permanent-auth-secret
BETTER_AUTH_URL=https://your-production-host
```

Do not expose database credentials or auth secrets through `NEXT_PUBLIC_*` variables.

Database connectivity can be checked at:

```text
/api/health/db
```

The endpoint never returns credentials.

## Local Development

Install dependencies:

```powershell
npm install
```

Copy `.env.example` to `.env.local` if you want explicit settings. Without a production database URL, local development defaults to:

```text
file:./data/dart-scorekeeper.db
```

Apply committed migrations and start the app:

```powershell
npm run db:migrate
npm run dev
```

For tablet testing on the local network:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Validation:

```powershell
npm run lint
npm run build
```

The repository also includes contract tests for persistence, auth/sync ownership, X01 rules, league/roster behavior, Game Night, fixtures, layouts, dummy scoring, board devices, offline queues, venue hardware, and commercial entitlements.

## Docker / Self-Hosting

```powershell
docker compose up --build
```

The Compose profile stores the SQLite/libSQL database in a persistent volume mounted at `/data` and applies committed migrations before the app starts.

## Current Scope

- X01 is the supported scoring game type in v0.5.
- Casual active-match state remains deliberately local-first.
- League and account data use the persistent server database.
- Tournament Mode, additional dart games, advanced theming, billing, and spectator/status displays are future work rather than v0.5 release blockers.
