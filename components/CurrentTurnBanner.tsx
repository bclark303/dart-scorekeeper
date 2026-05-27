import { FinishRule } from "@/lib/scoring";
import { MatchSide } from "@/lib/types";

type ScoreLayout = "compact" | "full";

type CurrentTurnBannerProps = {
  currentSide: MatchSide;
  currentLegNumber: number;
  bestOfLegs: number;
  legsNeededToWin: number;
  startingScore: number;
  finishRule: FinishRule;
  isCurrentThrowerDummy: boolean;
  dummyScore: number;
  scoreLayout: ScoreLayout;
  setScoreLayout: (layout: ScoreLayout) => void;
};

export function CurrentTurnBanner({
  currentSide,
  currentLegNumber,
  bestOfLegs,
  legsNeededToWin,
  startingScore,
  finishRule,
  isCurrentThrowerDummy,
  dummyScore,
  scoreLayout,
  setScoreLayout,
}: CurrentTurnBannerProps) {
  const currentThrower =
    currentSide.members[currentSide.currentMemberIndex]?.name ??
    currentSide.name;

  const finishLabel =
    finishRule === "double_out" ? "Double Out" : "Straight Out";

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-700 p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-400">
            {isCurrentThrowerDummy ? "Dummy Turn" : "Current Throw"}
          </div>

          <div className="text-3xl sm:text-4xl font-bold mt-1">
            {currentThrower}
          </div>

          <div className="text-slate-300 mt-1">
            {currentSide.members.length > 1 ? `${currentSide.name} • ` : ""}
            {startingScore} • {finishLabel} • Leg {currentLegNumber} • Best of{" "}
            {bestOfLegs} • First to {legsNeededToWin}
          </div>

          {isCurrentThrowerDummy && (
            <div className="mt-3 rounded-xl border border-purple-500/40 bg-purple-950/40 p-3 text-purple-100">
              Dummy score: <span className="font-bold">{dummyScore}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setScoreLayout("compact")}
            className={`rounded-lg px-4 py-2 font-bold ${
              scoreLayout === "compact"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Compact
          </button>

          <button
            onClick={() => setScoreLayout("full")}
            className={`rounded-lg px-4 py-2 font-bold ${
              scoreLayout === "full"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Full
          </button>
        </div>
      </div>
    </section>
  );
}
