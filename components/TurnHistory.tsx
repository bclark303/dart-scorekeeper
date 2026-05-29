import { DartThrow, Turn } from "@/lib/scoring";

function getDartLabel(dart: DartThrow) {
  if (dart.segment === "miss") {
    return "Miss";
  }

  if (dart.segment === "outer-bull") {
    return "Outer Bull";
  }

  if (dart.segment === "bull") {
    return "Bull";
  }

  const prefix =
    dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";

  return `${prefix}${dart.segment}`;
}

function getDartSummary(turn: Turn) {
  if (!turn.darts || turn.darts.length === 0) {
    return null;
  }

  return turn.darts.map(getDartLabel).join(", ");
}

type TurnHistoryProps = {
  turns: Turn[];
};

export function TurnHistory({ turns }: TurnHistoryProps) {
  return (
    <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6">
      <h2 className="text-2xl font-bold mb-4">Current Leg History</h2>

      {turns.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No turns yet.</p>
      ) : (
        <div className="space-y-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4"
            >
              <div className="font-semibold">
                {turn.throwerName ?? turn.playerName} scored {turn.scoreEntered}
                {turn.darts ? ` — ${getDartSummary(turn)}` : ""}
                {turn.isBust ? " — BUST" : ""}
                {turn.isCheckout ? " — CHECKOUT" : ""}
                {turn.isDummy ? " — DUMMY" : ""}
                {turn.throwerName && turn.throwerName !== turn.playerName
                  ? ` for ${turn.playerName}`
                  : ""}
              </div>

              <div className="text-[var(--color-text-muted)]">
                {turn.scoreBefore} → {turn.scoreAfter} | Darts:{" "}
                {turn.dartsThrown}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
