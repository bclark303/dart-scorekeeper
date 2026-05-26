import { FinishRule, getCheckoutSuggestion } from "@/lib/scoring";
import { MatchSide, PlayerStats } from "@/lib/types";

type PlayerCardProps = {
  player: MatchSide;
  isCurrentPlayer: boolean;
  isLegComplete: boolean;
  isMatchComplete: boolean;
  finishRule: FinishRule;
  stats: PlayerStats;
};

export function PlayerCard({
  player,
  isCurrentPlayer,
  isLegComplete,
  isMatchComplete,
  finishRule,
  stats,
}: PlayerCardProps) {
  const checkoutText =
    finishRule === "double_out" ? getCheckoutSuggestion(player.score) : null;

  return (
    <div
      className={`rounded-2xl p-6 border ${
        isCurrentPlayer && !isLegComplete && !isMatchComplete
          ? "border-green-400 bg-slate-800"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      <h2 className="text-2xl font-semibold mb-2">{player.name}</h2>

        {player.members.length > 1 && (
          <div className="mb-3 text-slate-300">
            <div>
              {player.members
                .map((member) => (member.isDummy ? `${member.name} (dummy)` : member.name))
                .join(" / ")}
            </div>
            <div className="mt-1 text-sm">
              Thrower:{" "}
              <span className="font-semibold text-white">
                {player.members[player.currentMemberIndex]?.name ?? player.name}
              </span>
            </div>
          </div>
        )}
      <div className="text-6xl font-bold">{player.score}</div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xl">
        <div>
          Legs won: <span className="font-bold">{player.legsWon}</span>
        </div>

        <div>
          Avg:{" "}
          <span className="font-bold">
            {stats.threeDartAverage.toFixed(1)}
          </span>
        </div>

        <div className="text-base text-slate-400">
          Points: {stats.pointsScored} | Darts: {stats.dartsThrown}
        </div>

        <div className="text-base text-slate-400">
          100+: {stats.count100Plus} | 140+: {stats.count140Plus} | 180s:{" "}
          {stats.count180s}
        </div>

        {checkoutText && (
          <div className="mt-3 rounded-xl border border-green-500/40 bg-green-950/40 p-3">
            <div className="text-sm text-green-300">Checkout</div>
            <div className="text-xl font-bold text-green-100">
              {checkoutText}
            </div>
          </div>
        )}
      </div>

      {isCurrentPlayer && !isLegComplete && !isMatchComplete && (
        <div className="mt-4 text-green-300 font-semibold">Current throw</div>
      )}
    </div>
  );
}