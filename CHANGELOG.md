# Changelog

## Unreleased

### Added
- Graphical dartboard input work for v0.3.0.
- Full-screen/tablet board mode refinements.
- Full-screen score cards.
- Full-screen post-scoring summary card.
- Local-network-safe turn ID fallback for environments where `crypto.randomUUID()` is unavailable.
- Session storage persistence for full-screen board state across dummy turns.

### Changed
- Improved full-screen board header readability.
- Moved full-screen action controls higher for tablet use.
- Moved Auto / Board / Numeric / Exit controls to the bottom row.
- Removed 25/Bull quick buttons from full-screen board mode.
- Checkout suggestions now remain visible and update while darts are entered.
- Checkout flow now keeps the full-screen post-scoring card visible instead of immediately dropping to the normal match-complete screen.
- Setup name fields can be left blank and resolve to clean defaults at game start.
- Default names now use Team A / Team B and Player 1-A / Player 1-B style naming.

### Fixed
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
