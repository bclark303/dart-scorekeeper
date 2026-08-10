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

## Schema and migration rules

- Define persisted tables in `lib/db/schema.ts` (split into schema modules later when needed).
- Generate migrations with `npm run db:generate`.
- Commit the generated `drizzle/` directory.
- Apply migrations with `npm run db:migrate`.
- Do not edit an already-applied migration to represent a later schema change; generate a new migration.
- Avoid provider-specific SQL, extensions, column types, and server functions in the canonical schema.

## Repository rules

Persistence operations belong in `lib/db/repositories/`. Components, hooks, and game-domain code should call repository/service functions rather than constructing SQL queries.

The bootstrap `app_metadata` table exists only to prove the complete path before the larger player/match/league model is introduced.

## Production safety

A production process does **not** silently fall back to a local SQLite file. `DATABASE_URL` must be explicitly configured in production. This prevents a Vercel deployment from accidentally treating its ephemeral filesystem as durable storage.

`GET /api/health/db` tests connectivity and reports only a safe provider/target summary; it never returns the database URL or auth token.

## Portability acceptance test

A persistence change is considered portable when all of the following still work:

1. Drizzle migration generation succeeds.
2. Migrations apply to a local `file:` database.
3. Lint and Next.js production build succeed.
4. The Docker image builds and starts with a persistent `/data` volume.
5. No client code imports a provider SDK or database adapter.

Vercel/Turso is the current hosted target, but the application must remain deployable without Vercel.
