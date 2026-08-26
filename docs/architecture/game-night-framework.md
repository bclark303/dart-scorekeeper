# Game night framework

A game night is a scheduled league event inside one season. It is the boundary between a season roster and the actual teams/boards used for play on a particular date.

## Domain boundaries

- `season_roster_entries` says a player participates in the season.
- `game_nights` says that season has an event on a particular date/time.
- `game_night_attendance` snapshots who checked in and whether their game-night dues were paid/waived.
- `game_night_settings` stores the rules used to build teams and boards for that event.
- `game_night_teams` and `game_night_team_members` are the generated/manual teams for that event only.
- `game_night_boards` are the physical boards available that night.
- `game_night_board_pairings` represents the initial board population. A later fixture/rotation engine can add additional rounds without changing attendance or teams.

Auth account identity remains separate from dart-player identity. Only league owners/admins may mutate game-night setup. Ordinary league members may view it.

## Initial settings

Team formation mode: `manual`, `automatic`, or `hybrid`.

Dummy handling: `none`, `allow`, or `fill`. `fill` lets automatic generation create dummy slots when the checked-in player count cannot satisfy the configured minimum team size.

Board rotation: `fixed`, `rotate`, or `manual`. The first framework only generates round-one pairings; the value is retained for the future rotation/fixture engine.

X01 defaults are stored on the game night (`startingScore`, `finishRule`, `legsPerMatch`) so a later board-match launch can create the canonical scoring match without inventing league rules at launch time.

## Deliberately deferred

- recurring calendar schedules and a full calendar UI
- multi-round board rotation / fixture generation
- standings points and season statistics
- linking a board pairing to the canonical `matches` scorer and launching the scorer
- cash ledger/accounting beyond paid/unpaid/waived game-night dues state
