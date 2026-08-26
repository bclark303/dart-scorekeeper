from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The unified-app transform has already materialized the deployed alpha.24
# behavior by the time this script runs. Remove the transform from normal
# builds so the checked-in source becomes the canonical application.
package_path = ROOT / "package.json"
package_text = package_path.read_text()
old_prebuild = '"prebuild": "python scripts/apply-unified-app-preview.py && npm run commercial:test"'
new_prebuild = '"prebuild": "npm run commercial:test"'
if old_prebuild not in package_text:
    raise RuntimeError("Could not recognize package.json prebuild state")
package_path.write_text(package_text.replace(old_prebuild, new_prebuild, 1))

# Python was added to the runtime image only for the temporary build transform.
docker_path = ROOT / "Dockerfile"
docker_text = docker_path.read_text()
python_block = '''# The unified build step is intentionally idempotent and currently uses a
# small Python helper. Install Python only so self-hosted/Docker builds follow
# the same build path as Vercel and CI.
RUN apt-get update \\
  && apt-get install -y --no-install-recommends python3 \\
  && ln -s /usr/bin/python3 /usr/local/bin/python \\
  && rm -rf /var/lib/apt/lists/*

'''
if python_block not in docker_text:
    raise RuntimeError("Could not recognize temporary Docker Python block")
docker_path.write_text(docker_text.replace(python_block, "", 1))

# Replace the old v0.4-era README with the actual unified v0.5 baseline.
(ROOT / "README.md").write_text('''# Dart Scorekeeper

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
''')

# The old preview document described a temporary branch/build arrangement that
# no longer exists. Replace it with the permanent unified-app architecture.
preview_doc = ROOT / "docs/unified-app-preview.md"
if preview_doc.exists():
    preview_doc.unlink()
(ROOT / "docs/unified-app.md").write_text('''# Unified application shell

Dart Scorekeeper uses one application and one codebase for Casual Play, League / Game Night, and scoring-device administration.

## Entry behavior

- `/` opens directly into Casual Play.
- `/casual` remains a valid direct route.
- League / Game Night is available from the Casual Play menu without forcing casual users through a mode-selection landing page.
- Scoring-device administration is also available from the shared menu.

## Product hierarchy

Casual scoring is the first-order experience and remains usable without an account or network connection. League administration is a deeper workflow that uses the persistent backend and authenticated authorization model. Board devices are venue/physical-board resources rather than assets owned by a single league.

## Build contract

The checked-in source is the canonical application. Production, Preview, CI, local development, and Docker all build the same source tree. No build-time script rewrites application routes, navigation, scoring behavior, or version metadata.
''')

# Record the cleanup in the changelog after the alpha.24/alpha.23 entries have
# been injected by the former one-time transform.
changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text()
cleanup_entry = '''### Source materialization cleanup (v0.5.0-alpha.24)\n- Materialized the approved unified application directly into the repository so local, CI, Preview, Production, and Docker builds all compile the same source.\n- Removed the temporary build-time Python source transform and the Docker Python dependency it required.\n- Updated the README and unified-app documentation to match the actual v0.5 architecture.\n\n'''
marker = "## Unreleased\n\n"
if cleanup_entry.strip() not in changelog:
    if marker not in changelog:
        raise RuntimeError("Could not find Unreleased changelog section")
    changelog_path.write_text(changelog.replace(marker, marker + cleanup_entry, 1))

# Remove one-time scaffolding. The workflow that calls this file is also
# deleted in the generated commit so it cannot run again.
for relative in [
    "scripts/apply-unified-app-preview.py",
    "scripts/finalize-v05-source-cleanup.py",
    ".github/workflows/materialize-v05-source-cleanup.yml",
]:
    path = ROOT / relative
    if path.exists():
        path.unlink()

print("v0.5 source cleanup materialized")
