# v0.5 League Round Model

League Game Nights treat rounds as the scheduling unit and legs as the scoring unit.

For a common fixed-opponent league format, configure three rounds with one leg per pairing, use Fixed Matchups so the Round 1 opponents repeat, and schedule the existing round intermission after Round 2. Board rotation remains independent: organizers may keep boards fixed or rotate the same matchups between physical boards.

When Number of Teams and Team Sizes are automatic while the board count is fixed, the fixed board count is treated as venue capacity. Auto layout creates no more than two teams per board and expands balanced team sizes as needed. This is the preferred social-league behavior because player attendance varies week to week.

Fixed team sizes that exceed simultaneous venue capacity are intentionally not converted into waves in v0.5. A future tournament-oriented scheduling policy can preserve registered team sizes and schedule multiple waves while reusing the same fixture and board model.

Individual season standings are derived from authoritative, non-voided completed legs. Every real member of the winning team receives a leg win and every real member of the opposing team receives a leg loss. Because standings are player-based, teams may be rebuilt each Game Night without losing season continuity.
