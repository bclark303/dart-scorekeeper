# League framework

This first league slice establishes durable organization and season boundaries without coupling league administration to dart-player identity.

## Domain model

- `leagues` is the long-lived organization container.
- `league_memberships` grants authenticated accounts access to a league using `owner`, `admin`, or `member` roles.
- `seasons` is a named competition period within a league. New seasons begin in `draft` state.

Authentication user IDs are stored only as permission identifiers. They are intentionally not foreign-keyed to the Better Auth schema and are not player IDs.

## Current workflow

A signed-in account can:

1. Open `/leagues` from App > Connected Storage.
2. Create a league and optionally create its first season.
3. List leagues for which the account has an active membership.
4. Add draft seasons when the account is an owner or administrator.

Casual scoring remains local-first and does not require league membership or an account.

## Intentionally deferred

The framework does not yet define:

- league player rosters or the mapping between accounts and dart-player profiles
- teams and team rosters
- divisions
- venues/boards
- fixtures or schedule generation
- standings/scoring rules
- season registration
- league-match assignment to the existing match archive
- invitations or membership-management UI

Those layers should build on the league/season IDs introduced here instead of changing the local scoring engine.
