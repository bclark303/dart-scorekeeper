# Unified App Preview Review

This branch is the final integration preview before Casual Play and the league framework are allowed onto `main`.

Production remains unchanged until this preview is explicitly approved.

## Expected navigation

- `/` opens directly into Casual Play setup.
- The Casual Play hamburger is available before a match starts.
- The hamburger exposes Casual Match Setup, Stats, History, Settings, Help / Feedback, League / Game Night, and Scoring Devices.
- League / Game Night is visibly marked Preview.
- `/league-play` remains the league workspace entry point.
- `/league-devices` remains the scoring-device administration entry point.
- The active casual-match hamburger exposes the same League / Game Night and Scoring Devices entries without crowding the scoring screen.

## Regression checks before approval

- Start and complete a casual X01 match.
- Confirm graphical and numeric scoring still work.
- Confirm portrait and landscape Scoring View layouts preserve a large tappable dartboard.
- Pause a casual game with darts already entered, leave scoring, and resume it exactly.
- Discard a casual game and confirm no completed statistics/history are written.
- Open League / Game Night from the hamburger and exercise check-in, dues, teams/fixtures, board operations, and league scoring.
- Open Scoring Devices from the hamburger and verify device/board administration still loads.
- Confirm the app shows v0.5.0-alpha.23 in the built preview.

## Release gate

Do not merge draft PR #30 into `main` until the unified preview has been manually approved.
