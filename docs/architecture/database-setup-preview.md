# Database Setup Preview

This preview turns the persistence architecture into a user-facing setup flow while preserving local-first scoring.

## Operating mode

Each browser chooses one of two modes:

- **Local Only** — the default. The app does not initialize account/session checks or automatic server synchronization. Active scoring, saved-match resume, and completed-match IndexedDB history remain available.
- **Connected Storage** — enables the Database Setup panel and, once the server database is healthy, Account & Sync.

The choice is stored in browser localStorage because it describes how that device should behave. It does not change or delete server data.

## Provider behavior

### Local SQLite

Intended for Docker/self-hosted installations. The default Compose database remains:

```text
file:/data/dart-scorekeeper.db
```

Self-hosted installs can test, migrate, and save a new SQLite file URL from the App page. The saved server config lives on the persistent `/data` volume with file mode `0600`.

### Turso / libSQL

Self-hosted installs can enter a Turso/libSQL URL and token, test the connection, apply migrations, and persist the server-only configuration from the App page.

Vercel intentionally does **not** let the running app rewrite its own project secrets. The setup page shows the required environment variable names and current connection status; the actual values remain Vercel deployment secrets.

### Cloudflare D1

D1 is represented as a Worker binding rather than a URL/token database because Cloudflare exposes D1 through `env.<BINDING_NAME>`. The setup UI therefore asks for a binding name.

The D1 adapter is **not implemented in this preview**. This is intentional: the preview is for evaluating the setup UX before adding the Cloudflare/OpenNext runtime adapter.

## Self-hosted setup security

A self-hosted server creates a random setup token in the same persistent volume as its runtime config and prints the token once to container/server logs.

The setup token is required before the app can:

- test an arbitrary database draft;
- apply migrations to that draft; or
- save new database credentials.

The token is never returned by a status API and is never stored in the browser automatically.

When a self-hosted database configuration is saved, the server also creates a strong Better Auth secret if one is not already present. Database tokens and auth secrets remain server-side.

## Configuration precedence

For the current Node/libSQL implementation:

```text
self-hosted runtime config file
        ↓
host environment variables
        ↓
development-only local SQLite default
```

The runtime config file is only enabled for explicitly self-hosted installations. Vercel production still requires deployment environment variables and cannot silently fall back to a local file.

## Validation

`npm run setup:test` exercises the self-hosted setup contract against a temporary real SQLite/libSQL database. It verifies:

- invalid setup tokens are rejected;
- unsafe parent-directory SQLite paths are rejected;
- valid local SQLite connections can be tested;
- committed migrations are applied before save;
- runtime configuration is persisted with mode `0600`;
- an auth secret is generated server-side;
- runtime config takes precedence over boot environment settings; and
- the resulting database/account status is healthy.

The permanent portability workflow runs this alongside the existing database repository, IndexedDB archive, authentication/ownership, lint, Next build, and Docker checks.
