# Changelog

## Unreleased

### Added
- Casual games can be paused into up to five named local save slots and resumed with exact score, turn, leg, history, checkout-prompt, and in-progress dart-entry state preserved.
- Active casual games now have an Exit Game action with Pause Game and confirmed Discard Game paths; paused/discarded games never enter completed-match statistics.
- Casual X01 now supports any number of individual players, with turn order rotating across every participant.
- X01 starting scores can now be selected from 101 through 901 in 100-point increments.
- Portable persistence foundation for v0.4.0.
- SQLite-compatible Drizzle schema and migration tooling.
- Provider boundary under `lib/db/adapters/` and repository boundary under `lib/db/repositories/`.
- Local `file:` SQLite/libSQL development configuration.
- Provider-neutral database health endpoint at `/api/health/db`.
- Docker and Compose self-hosting target with a persistent `/data` volume.
- Persistence architecture documentation and ESLint guardrails against provider imports outside `lib/db`.
- CI portability check that generates/applies migrations against a local database before lint/build validation.
- Provider-neutral player, match, side, and participant persistence model.
- X01 persistence tables for match settings, legs, turns, and individual darts.
- Transactional/idempotent X01 archive repository and recent-match summary query.
- Durable local-first match IDs and creation timestamps that survive browser refresh/resume.
- Executable database repository contract test against a real local SQLite/libSQL database.
- Browser IndexedDB completed-match archive queue with pending/synced/error metadata for future synchronization.
- Completed-match History view with local sync status, matchup/result summary, and expandable leg/turn details.
- Optional Better Auth email/password accounts stored in the same portable Drizzle/SQLite database.
- Authenticated two-way completed-match synchronization for signed-in accounts.
- Account & Sync controls with sign-up, sign-in, sign-out, manual sync, and pending-match count.
- Automatic completed-match sync after sign-in, reconnect, and local archive changes.
- Cross-device completed-match History download for the signed-in account.
- Authentication/sync contract test covering real sign-up/sign-in and cross-account match isolation.
- Graphical dartboard input work for v0.3.0.
- Full-screen/tablet board mode refinements.
- Full-screen score cards.
- Full-screen post-scoring summary card.
- Local-network-safe turn ID fallback for environments where `crypto.randomUUID()` is unavailable.
- Session storage persistence for full-screen board state across dummy turns.

### Changed
- Renamed the dedicated dart-entry interface to Scoring View and its presentation-only return control to App View.
- Updated production version to v0.4.0-alpha.3.
- Updated development version to v0.4.0-alpha.2.
- Enabled Next.js standalone output so the same app can run as a normal Node/Docker deployment.
- Production database configuration now requires an explicit `DATABASE_URL`; local-file fallback is development-only.
- Historical match participants are modeled separately from optional long-lived player profiles so guest/dummy play and name snapshots remain valid.
- Older browser saves are assigned a durable match identity on load, preparing them for idempotent synchronization.
- Completed matches are copied to a separate immutable browser archive while active scoring remains localStorage-driven and network-independent.
- Signed-in completed-match archives now synchronize to the server and download to other devices without making active scoring network-dependent.
- History refreshes automatically when local synchronization state or downloaded archives change.
- Persistence CI now executes real repository, browser archive, and authentication/ownership tests before lint, production build, and Docker validation.
- Account-service outages now leave scoring fully available and visibly report that completed matches remain queued locally.
- Improved full-screen board header readability.
- Moved full-screen action controls higher for tablet use.
- Moved Auto / Board / Numeric / Exit controls to the bottom row.
- Removed 25/Bull quick buttons from full-screen board mode.
- Checkout suggestions now remain visible and update while darts are entered.
- Checkout flow now keeps the full-screen post-scoring card visible instead of immediately dropping to the normal match-complete screen.
- Setup name fields can be left blank and resolve to clean defaults at game start.
- Default names now use Team A / Team B and Player 1-A / Player 1-B style naming.

### Security
- Completed-match sync validates a real server-side Better Auth session on every protected request.
- Synchronized matches are ownership-scoped; another account cannot list or overwrite an existing match ID.
- Sync uploads enforce request-size, batch-size, and archive-shape/range validation.

### Fixed
- Full-screen board Exit now remains exited when Auto full screen is enabled.
- Duplicate player name display on full-screen score cards.
- Full-screen board mode returning to normal mode after dummy-score turns.
- LAN testing issue caused by direct `crypto.randomUUID()` usage.

## v0.2.0

### Added
- Game Mode compact navigation during active matches.
- Hamburger menu for accessing setup, app settings, stats, history, and feedback during a match.
- Tighter scoring layout for small screens and tablets.
- Confirmation prompt before clearing the saved match and app settings.
- Visible app version/changelog display.

### Changed
- Reduced duplicate in-game display elements while Game Mode is active.
- Moved the active-match screen toward a no-scroll tablet layout.
- Updated the visible app version to v0.2.0.

### Fixed
- Several layout and usability issues found during tablet/local-play testing.

## v0.1.0

### Added
- Initial working dart scorekeeper.
- Basic match setup for singles, doubles, and team play.
- Score entry flow.
- Bust handling.
- Checkout confirmation flow.
- Local browser saved-match state.
- Vercel deployment baseline.
