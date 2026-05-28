import { MatchSide, PlayerStats } from "@/lib/types";

type MatchSummaryProps = {
  players: MatchSide[];
  isMatchComplete: boolean;
  isLegComplete: boolean;
  currentLegNumber: number;
  getMatchScoreText: () => string;
  getMatchWinnerName: () => string | null;
  getPlayerStats: (playerId: string) => PlayerStats;
};

export function MatchSummary({
  players,
  isMatchComplete,
  isLegComplete,
  currentLegNumber,
  getMatchScoreText,
  getMatchWinnerName,
  getPlayerStats,
}: MatchSummaryProps) {
  return (
    <section className="mt-8 rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6">
      <h2 className="text-2xl font-bold mb-4">Match Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <div className="text-[var(--color-text-muted)]">Status</div>
          <div className="text-xl font-bold">
            {isMatchComplete
              ? "Complete"
              : isLegComplete
                ? "Between legs"
                : "In progress"}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <div className="text-[var(--color-text-muted)]">Match Score</div>
          <div className="text-xl font-bold">{getMatchScoreText()}</div>
        </div>

        <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <div className="text-[var(--color-text-muted)]">Current Leg</div>
          <div className="text-xl font-bold">{currentLegNumber}</div>
        </div>

        <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <div className="text-[var(--color-text-muted)]">Winner</div>
          <div className="text-xl font-bold">
            {getMatchWinnerName() ?? "Not decided"}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {players.map((player) => {
          const stats = getPlayerStats(player.id);

          return (
            <div
              key={player.id}
              className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4"
            >
              <div className="text-xl font-bold mb-2">{player.name}</div>

              <div className="text-[var(--color-text-muted)]">
                Legs won:{" "}
                <span className="font-bold text-white">{player.legsWon}</span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                Match average:{" "}
                <span className="font-bold text-white">
                  {stats.threeDartAverage.toFixed(1)}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                Points scored:{" "}
                <span className="font-bold text-white">
                  {stats.pointsScored}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                Darts counted:{" "}
                <span className="font-bold text-white">
                  {stats.dartsThrown}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                Highest checkout:{" "}
                <span className="font-bold text-white">
                  {stats.highestCheckout > 0 ? stats.highestCheckout : "—"}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                100+ scores:{" "}
                <span className="font-bold text-white">
                  {stats.count100Plus}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                140+ scores:{" "}
                <span className="font-bold text-white">
                  {stats.count140Plus}
                </span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                180s:{" "}
                <span className="font-bold text-white">{stats.count180s}</span>
              </div>

              <div className="text-[var(--color-text-muted)]">
                Busts:{" "}
                <span className="font-bold text-white">{stats.busts}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
