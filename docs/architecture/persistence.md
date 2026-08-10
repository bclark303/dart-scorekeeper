# Portable Persistence Architecture

Dart Scorekeeper treats hosting, database providers, and authentication libraries as deployment choices rather than application architecture.

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
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://your-production-host.example
```

`DATABASE_AUTH_TOKEN` and `BETTER_AUTH_SECRET` stay server-side. Client components never receive them. `BETTER_AUTH_SECRET` must be a strong production secret and must remain stable across deployments or existing sessions become invalid.

`BETTER_AUTH_URL` is recommended for the canonical production host. Preview deployments can infer their current host through the runtime Better Auth configuration.

### Local development

If `DATABASE_URL` is omitted outside production, the app defaults to:

```env
DATABASE_URL=file:./data/dart-scorekeeper.db
```

Local database files are ignored by Git. Development auth still requires a `BETTER_AUTH_SECRET`; a local `BETTER_AUTH_URL` such as `http://localhost:3000` is recommended.

### Docker / local host

The Compose profile mounts a persistent volume at `/data` and uses:

```env
DB_PROVIDER=libsql
DATABASE_URL=file:/data/dart-scorekeeper.db
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://your-local-scorekeeper-host.example
```

The container applies committed Drizzle migrations before starting Next.js. Better Auth uses the same Drizzle/SQLite database as the application, so moving from Turso to a local SQLite file does not require changing the authentication model.

### Future Cloudflare D1

D1 should be introduced as a new adapter under `lib/db/adapters/`. Repository callers should not change. Schema changes must remain compatible with SQLite unless a migration plan explicitly says otherwise.

## Relational model

The application schema separates generic match structure from game-specific scoring data.

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

Better Auth contributes its own SQLite-compatible tables through `lib/db/auth-schema.ts`:

```text
user
  |
  +-- session
  |
  +-- account

verification
```

### Generic match layer

`matches`, `match_sides`, and `match_participants` belong to every game type. A side can be a single player, a doubles pair, or a larger team. Participants are throw-order slots on that side.

A participant has an optional `player_id`. This lets registered players accumulate long-term statistics while guests and dummy players remain valid participants without accounts.

Participant names are stored as match-time snapshots. Historical results therefore remain readable even when a player profile is renamed later.

### Authentication identity is not player identity

A Better Auth user represents the person/account that owns synchronized data. A dart `player` represents a long-lived competitive/player profile.

Those concepts are deliberately separate. Signing into the app does not automatically convert every participant in a match into that account's player profile. Guest play, team play, dummy slots, and later league roster linking remain valid without creating auth accounts for everyone at the board.

### Game-specific layer

X01 rules and scoring history live in X01-prefixed tables. Future games such as Cricket, Killer, Half-It, and Around the World should add their own game-specific settings/events without forcing unrelated data into X01 columns.

## Stable local-first identities

The browser scorer uses convenient local IDs such as `side-1`; those IDs repeat between matches.

Persistence uses a durable match ID plus namespaced child IDs:

```text
match-<uuid>
match-<uuid>:side:side-1
match-<uuid>:participant:side-1-member-1
match-<uuid>:leg:1
match-<uuid>:turn:<local-turn-id>
match-<uuid>:dart:<local-dart-id>
```

This lets a completed local match be retried/synchronized safely without generating duplicate database rows. Older browser saves are assigned a durable match ID when loaded, so future saves and archive retries keep the same identity.

A durable match ID is an **idempotency key, not authorization**. Server-side ownership checks always decide whether the authenticated account may read or replace an existing match ID.

## Archive contract

Database-specific row types do not leak into game/UI code. `lib/persistence/contracts.ts` defines the provider-neutral archive model, and `lib/persistence/x01Archive.ts` converts the completed match fields required by persistence into that model.

The match repository saves the archive transactionally. Saving the same durable match ID again replaces the child snapshot, making synchronization retries idempotent.

### Browser completed-match queue

Active scoring continues to use the existing browser save path and never waits for IndexedDB or a network request.

When a match becomes complete, the app builds a provider-neutral X01 archive and stores it in IndexedDB through `lib/persistence/localArchiveStore.ts`.

Each local record contains:

- the immutable completed X01 archive
- a `pending`, `synced`, or `error` sync status
- queue/update timestamps
- the most recent sync-attempt timestamp/error

The durable match ID is the IndexedDB key. Re-running the completion effect or reloading an already-completed match returns the existing record instead of creating a duplicate or resetting its sync state.

Clearing/resetting the current match does not delete completed archives. The current-match localStorage save and the completed-match archive queue are intentionally separate concerns.

`npm run local:test` executes this queue in Node with `fake-indexeddb`. It verifies one-record-per-match behavior, preservation of sync errors across completion retries, pending-to-synced transitions, and import of already-synchronized server archives.

## Authentication and completed-match synchronization

Authentication is optional. The scorer can start, record, finish, archive, replay, and review matches without an account or network connection.

Better Auth currently provides email/password accounts and database-backed sessions. Email verification and password-reset email are intentionally not configured in the current alpha.

A signed-in browser synchronizes only **completed match archives**. Active-match state remains device-local.

```text
Active match
localStorage
    |
    | completion
    v
Completed archive
IndexedDB (pending/error/synced)
    |
    | authenticated background/manual sync
    v
/api/sync/matches
    |
    | server-validated Better Auth session
    v
owned repository write/read
    |
    v
SQLite-compatible database
```

### Sync triggers

A sync pass runs when a signed-in session becomes available, when the browser comes back online, when a newly completed local archive changes the queue, or when the user presses **Sync now**.

Network/auth/storage errors never block scoring. Unsynchronized matches remain in IndexedDB and are retried later.

After uploading pending records, the client downloads the signed-in account's completed archives and stores them locally as `synced`, allowing completed History to follow the account to another device.

### Ownership invariant

`matches.created_by_user_id` records the Better Auth user that owns the synchronized copy.

- Re-uploading the same match ID by the same user is allowed and remains idempotent.
- A legacy/unowned row may be claimed by the first authenticated synchronization of that durable ID.
- A match ID already owned by another user cannot be read through the account history query or overwritten by that second user.
- Ownership is checked server-side; browser-provided IDs/status cannot grant access.

The owner field deliberately does not have a database foreign key into Better Auth tables. That keeps the application schema portable if the auth implementation changes later.

### Sync API safety

`/api/sync/matches` validates the Better Auth session inside the route before any protected read/write. It also validates archive shape and bounds, limits request size, limits matches per request, and returns `Cache-Control: no-store`.

An unavailable authentication/database service returns a service-unavailable response rather than misrepresenting the failure as a signed-out session. The UI explicitly tells the user that local scoring/history remain safe when account services are unavailable.

## Schema and migration rules

- Define application tables in `lib/db/schema.ts` and generated Better Auth tables in `lib/db/auth-schema.ts`.
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
- authenticated owned X01 match save/download
- lightweight recent X01 match summaries

`npm run db:test` exercises the application repository layer against a temporary local SQLite/libSQL database.

`npm run auth:test` creates real Better Auth email/password users against that same SQLite-compatible database and verifies sign-in, same-user idempotent match retries, cross-account read isolation, and cross-account overwrite rejection.

## Production safety

A production process does **not** silently fall back to a local SQLite file. `DATABASE_URL` must be explicitly configured in production. This prevents a Vercel deployment from accidentally treating its ephemeral filesystem as durable storage.

Production authenticated sync also requires a persistent database and stable `BETTER_AUTH_SECRET`. A Turso deployment additionally requires its `DATABASE_AUTH_TOKEN`.

`GET /api/health/db` tests connectivity and reports only a safe provider/target summary; it never returns the database URL or auth token.

The completed-match write/read endpoint is authenticated and ownership-scoped. There is no anonymous completed-match server write path.

## Portability acceptance test

A persistence/auth change is considered portable when all of the following still work:

1. Drizzle migration generation succeeds with no uncommitted drift.
2. Migrations apply to a local `file:` database.
3. The database repository contract test passes against that database.
4. The browser IndexedDB archive-queue contract test passes.
5. Better Auth sign-up/sign-in and sync ownership isolation pass against the same local SQLite-compatible database.
6. Lint and the Next.js production build succeed.
7. The Docker image builds with the same application/database/auth code path.
8. Client code does not import a database provider SDK or database adapter.

Vercel/Turso is the current hosted target, but the application and its authentication model must remain deployable without Vercel.
