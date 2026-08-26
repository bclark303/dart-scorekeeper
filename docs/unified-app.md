# Unified application shell

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
