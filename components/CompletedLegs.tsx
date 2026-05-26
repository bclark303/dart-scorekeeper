"use client";

import { useState } from "react";
import { CompletedLeg } from "@/lib/types";

type CompletedLegsProps = {
  completedLegs: CompletedLeg[];
};

export function CompletedLegs({ completedLegs }: CompletedLegsProps) {
  const [expandedLegNumbers, setExpandedLegNumbers] = useState<number[]>([]);

  function toggleLeg(legNumber: number) {
    setExpandedLegNumbers((currentLegNumbers) => {
      if (currentLegNumbers.includes(legNumber)) {
        return currentLegNumbers.filter((number) => number !== legNumber);
      }

      return [...currentLegNumbers, legNumber];
    });
  }

  return (
    <section className="mt-8 rounded-2xl bg-slate-900 border border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-4">Completed Legs</h2>

      {completedLegs.length === 0 ? (
        <p className="text-slate-400">No completed legs yet.</p>
      ) : (
        <div className="space-y-4">
          {completedLegs.map((leg) => {
            const checkoutTurn = leg.turns.find((turn) => turn.isCheckout);
            const isExpanded = expandedLegNumbers.includes(leg.legNumber);

            return (
              <div
                key={leg.legNumber}
                className="rounded-xl bg-slate-800 border border-slate-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="text-lg font-bold">
                    Leg {leg.legNumber}: {leg.winnerName} won
                  </div>

                  <button
                    onClick={() => toggleLeg(leg.legNumber)}
                    className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 font-bold"
                  >
                    {isExpanded ? "Hide turns" : "Show turns"}
                  </button>
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

                {isExpanded && (
                  <div className="mt-4 border-t border-slate-700 pt-4">
                    <h3 className="font-bold mb-3">Turns</h3>

                    <div className="space-y-2">
                      {leg.turns
                        .slice()
                        .reverse()
                        .map((turn) => (
                          <div
                            key={turn.id}
                            className="rounded-lg bg-slate-900 border border-slate-700 p-3"
                          >
                            <div className="font-semibold">
                              {turn.throwerName ?? turn.playerName} scored{" "}
                              {turn.scoreEntered}
                              {turn.isBust ? " — BUST" : ""}
                              {turn.isCheckout ? " — CHECKOUT" : ""}
                              {turn.throwerName &&
                              turn.throwerName !== turn.playerName
                                ? ` for ${turn.playerName}`
                                : ""}
                            </div>

                            <div className="text-slate-300">
                              {turn.scoreBefore} → {turn.scoreAfter} | Darts:{" "}
                              {turn.dartsThrown}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}