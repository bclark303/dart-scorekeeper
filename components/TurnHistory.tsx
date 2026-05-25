import { Turn } from "@/lib/scoring";

type TurnHistoryProps = {
  turns: Turn[];
};

export function TurnHistory({ turns }: TurnHistoryProps) {
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-4">Current Leg History</h2>

      {turns.length === 0 ? (
        <p className="text-slate-400">No turns yet.</p>
      ) : (
        <div className="space-y-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className="rounded-xl bg-slate-800 border border-slate-700 p-4"
            >
              <div className="font-semibold">
                {turn.playerName} scored {turn.scoreEntered}
                {turn.isBust ? " — BUST" : ""}
                {turn.isCheckout ? " — CHECKOUT" : ""}
              </div>

              <div className="text-slate-300">
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