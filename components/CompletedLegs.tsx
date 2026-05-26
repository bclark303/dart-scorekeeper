import { CompletedLeg } from "@/lib/types";

type CompletedLegsProps = {
  completedLegs: CompletedLeg[];
};

export function CompletedLegs({ completedLegs }: CompletedLegsProps) {
  return (
    <section className="mt-8 rounded-2xl bg-slate-900 border border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-4">Completed Legs</h2>

      {completedLegs.length === 0 ? (
        <p className="text-slate-400">No completed legs yet.</p>
      ) : (
        <div className="space-y-4">
          {completedLegs.map((leg) => {
            const checkoutTurn = leg.turns.find((turn) => turn.isCheckout);

            return (
              <div
                key={leg.legNumber}
                className="rounded-xl bg-slate-800 border border-slate-700 p-4"
              >
                <div className="text-lg font-bold mb-3">
                  Leg {leg.legNumber}: {leg.winnerName} won
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                  <div>
                    Winner:{" "}
                    <span className="font-bold text-white">
                      {leg.winnerName}
                    </span>
                  </div>

                  <div>
                    Turns thrown:{" "}
                    <span className="font-bold text-white">
                      {leg.turns.length}
                    </span>
                  </div>

                  <div>
                    Checkout:{" "}
                    <span className="font-bold text-white">
                      {checkoutTurn ? checkoutTurn.scoreEntered : "—"}
                    </span>
                  </div>

                  <div>
                    Checkout darts:{" "}
                    <span className="font-bold text-white">
                      {checkoutTurn ? checkoutTurn.dartsThrown : "—"}
                    </span>
                  </div>

                  {checkoutTurn?.throwerName && (
                    <div className="sm:col-span-2">
                      Finished by:{" "}
                      <span className="font-bold text-white">
                        {checkoutTurn.throwerName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}