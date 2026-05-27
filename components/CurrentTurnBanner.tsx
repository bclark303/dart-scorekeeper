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
    <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-wide text-[var(--color-text-muted)]">
            {isCurrentThrowerDummy ? "Dummy Turn" : "Current Throw"}
          </div>

          <div className="text-3xl sm:text-4xl font-bold mt-1">
            {currentThrower}
          </div>

          <div className="text-[var(--color-text-muted)] mt-1">
            {currentSide.members.length > 1 ? `${currentSide.name} • ` : ""}
            {startingScore} • {finishLabel} • Leg {currentLegNumber} • Best of{" "}
            {bestOfLegs} • First to {legsNeededToWin}
          </div>

          {isCurrentThrowerDummy && (
            <div className="mt-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/20 p-3 text-[var(--color-text-main)]">
              Dummy score: <span className="font-bold">{dummyScore}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setScoreLayout("compact")}
            className={`rounded-lg px-4 py-2 font-bold ${
              scoreLayout === "compact"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-panel-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]"
            }`}
          >
            Compact
          </button>

          <button
            onClick={() => setScoreLayout("full")}
            className={`rounded-lg px-4 py-2 font-bold ${
              scoreLayout === "full"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-panel-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-panel)]"
            }`}
          >
            Full
          </button>
        </div>
      </div>
    </section>
  );
}
