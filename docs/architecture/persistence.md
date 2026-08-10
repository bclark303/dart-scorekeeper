# Portable Persistence Architecture

Dart Scorekeeper treats hosting and database providers as deployment choices, not application architecture.

## Contract

The canonical relational model is SQLite. Application and UI code must not import provider SDKs or Drizzle database clients directly.

```text
Client / UI
    |
Next.js Route Handler or server code
    |
lib/db/repositories/*
    |
lib/db/adapters/*
    |
SQLite-compatible provider
```

The public persistence boundary is `lib/db/index.ts`.

## Current targets

### Vercel + Turso

```env
DB_PROVIDER=libsql
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=...
```

The token stays server-side. Client components never receive it.

### Local development

If `DATABASE_URL` is omitted outside production, the app defaults to:

```env
DATABASE_URL=file:./data/dart-scorekeeper.db
```

Local database files are ignored by Git.

### Docker / local host

The Compose profile mounts a persistent volume at `/data` and uses:

```env
DB_PROVIDER=libsql
DATABASE_URL=file:/data/dart-scorekeeper.db
```

The container applies committed Drizzle migrations before starting Next.js.

### Future Cloudflare D1

D1 should be introduced as a new adapter under `lib/db/adapters/`. Repository callers should not change. Schema changes must remain compatible with SQLite unless a migration plan explicitly says otherwise.

## Relational model

The first real application schema intentionally separates generic match structure from game-specific scoring data.

```text
players

matches
  |
  +-- match_sides
  |      |
  |      +-- match_participants ----> players (optional)
  |
  +-- x01_match_settings
  |
  +-- x01_legs
         |
         +-- x01_turns
                |
                +-- x01_darts
```

### Generic match layer

`matches`, `match_sides`, and `match_participants` belong to every game type. A side can be a single player, a doubles pair, or a larger team. Participants are throw-order slots on that side.

A participant has an optional `player_id`. This lets registered players accumulate long-term statistics while guests and dummy players remain valid participants without accounts.

Participant names are stored as match-time snapshots. Historical results therefore remain readable even when a player profile is renamed later.

### Game-specific layer

X01 rules and scoring history live in X01-prefixed tables. Future games such as Cricket, Killer, Half-It, and Around the World should add their own game-specific settings/events without forcing unrelated data into X01 columns.

## Stable local-first identities

The browser scorer currently uses simple local IDs such as `side-1`; those IDs repeat between matches and are intentionally convenient for UI state.

Persistence uses a durable match ID plus namespaced child IDs:

```text
match-<uuid>
match-<uuid>:side:side-1
match-<uuid>:participant:side-1-member-1
match-<uuid>:leg:1
match-<uuid>:turn:<local-turn-id>
match-<uuid>:dart:<local-dart-id>
```

This lets a completed local match be retried/synchronized safely without generating duplicate database rows. Older browser saves may not yet contain a durable match ID; compatibility fields remain optional until the scorer assigns one during the sync integration step.

## Archive contract

Database-specific row types do not leak into game/UI code. `lib/persistence/contracts.ts` defines the provider-neutral archive model, and `lib/persistence/x01Archive.ts` converts a completed browser save into that model.

The match repository saves the archive transactionally. Saving the same durable match ID again replaces the child snapshot, making synchronization retries idempotent.

The current persistence phase does **not** automatically upload matches yet. Active scoring remains browser-local until the sync/API and security rules are added.

## Schema and migration rules

- Define persisted tables in `lib/db/schema.ts` (split into schema modules later when needed).
- Generate migrations with `npm run db:generate`.
- Commit the generated `drizzle/` directory.
- Apply migrations with `npm run db:migrate`.
- Do not edit an already-applied migration to represent a later schema change; generate a new migration.
- Avoid provider-specific SQL, extensions, column types, and server functions in the canonical schema.
- Prefer globally stable text IDs rather than database-generated IDs for data created offline.
- Keep generic match relationships separate from game-specific scoring tables.

## Repository rules

Persistence operations belong in `lib/db/repositories/`. Components, hooks, and game-domain code should call repository/service functions rather than constructing SQL queries.

Current repositories include:

- app metadata/readiness operations
- player save/list/archive operations
- transactional X01 match archive save
- lightweight recent X01 match summaries

## Production safety

A production process does **not** silently fall back to a local SQLite file. `DATABASE_URL` must be explicitly configured in production. This prevents a Vercel deployment from accidentally treating its ephemeral filesystem as durable storage.

`GET /api/health/db` tests connectivity and reports only a safe provider/target summary; it never returns the database URL or auth token.

No unauthenticated public write endpoint is exposed for match/player persistence yet. We should decide authentication and write authorization before enabling remote writes on the hosted app.

## Portability acceptance test

A persistence change is considered portable when all of the following still work:

1. Drizzle migration generation succeeds.
2. Migrations apply to a local `file:` database.
3. Lint and Next.js production build succeed.
4. The Docker image builds and starts with a persistent `/data` volume.
5. No client code imports a provider SDK or database adapter.

Vercel/Turso is the current hosted target, but the application must remain deployable without Vercel.
