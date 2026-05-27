import { FinishRule, getCheckoutSuggestion } from "@/lib/scoring";
import { MatchSide, PlayerStats } from "@/lib/types";

type PlayerCardProps = {
  player: MatchSide;
  isCurrentPlayer: boolean;
  isLegComplete: boolean;
  isMatchComplete: boolean;
  finishRule: FinishRule;
  stats: PlayerStats;
  compact: boolean;
};

export function PlayerCard({
  player,
  isCurrentPlayer,
  isLegComplete,
  isMatchComplete,
  finishRule,
  stats,
  compact,
}: PlayerCardProps) {
  const checkoutText =
    finishRule === "double_out" ? getCheckoutSuggestion(player.score) : null;

  return (
    <div
      className={`rounded-2xl border ${compact ? "p-4" : "p-6"} ${
        isCurrentPlayer && !isLegComplete && !isMatchComplete
          ? "border-green-400 bg-slate-800"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            className={
              compact ? "text-xl font-semibold" : "text-2xl font-semibold mb-2"
            }
          >
            {player.name}
          </h2>

          {player.members.length > 1 && !compact && (
            <div className="mb-3 text-slate-300">
              <div>
                {player.members
                  .map((member) =>
                    member.isDummy ? `${member.name} (dummy)` : member.name,
                  )
                  .join(" / ")}
              </div>
              <div className="mt-1 text-sm">
                Thrower:{" "}
                <span className="font-semibold text-white">
                  {player.members[player.currentMemberIndex]?.name ??
                    player.name}
                </span>
              </div>
            </div>
          )}

          {player.members.length > 1 && compact && (
            <div className="text-sm text-slate-400">
              Thrower:{" "}
              <span className="font-semibold text-white">
                {player.members[player.currentMemberIndex]?.name ?? player.name}
              </span>
            </div>
          )}
        </div>

        {isCurrentPlayer && !isLegComplete && !isMatchComplete && (
          <div className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-300">
            Throw
          </div>
        )}
      </div>

      <div
        className={
          compact ? "mt-3 text-6xl font-bold" : "mt-3 text-6xl font-bold"
        }
      >
        {player.score}
      </div>

      <div
        className={
          compact
            ? "mt-3 grid grid-cols-2 gap-2 text-base"
            : "mt-4 grid grid-cols-1 gap-2 text-xl"
        }
      >
        <div>
          Legs: <span className="font-bold">{player.legsWon}</span>
        </div>

        <div>
          Avg:{" "}
          <span className="font-bold">{stats.threeDartAverage.toFixed(1)}</span>
        </div>

        {!compact && (
          <>
            <div className="text-base text-slate-400">
              Points: {stats.pointsScored} | Darts: {stats.dartsThrown}
            </div>

            <div className="text-base text-slate-400">
              100+: {stats.count100Plus} | 140+: {stats.count140Plus} | 180s:{" "}
              {stats.count180s}
            </div>
          </>
        )}

        {checkoutText && (
          <div
            className={`rounded-xl border border-green-500/40 bg-green-950/40 ${
              compact ? "col-span-2 mt-1 p-2" : "mt-3 p-3"
            }`}
          >
            <div className="text-sm text-green-300">Checkout</div>
            <div
              className={
                compact
                  ? "text-lg font-bold text-green-100"
                  : "text-xl font-bold text-green-100"
              }
            >
              {checkoutText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
