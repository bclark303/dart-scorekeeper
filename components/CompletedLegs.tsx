"use client";

import { useState } from "react";
import { CompletedLeg } from "@/lib/types";
import { getDartSummary } from "@/lib/darts";

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
    <section className="mt-8 rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6">
      <h2 className="text-2xl font-bold mb-4">Completed Legs</h2>

      {completedLegs.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No completed legs yet.</p>
      ) : (
        <div className="space-y-4">
          {completedLegs.map((leg) => {
            const checkoutTurn = leg.turns.find((turn) => turn.isCheckout);
            const isExpanded = expandedLegNumbers.includes(leg.legNumber);

            return (
              <div
                key={leg.legNumber}
                className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="text-lg font-bold">
                    Leg {leg.legNumber}: {leg.winnerName} won
                  </div>

                  <button
                    onClick={() => toggleLeg(leg.legNumber)}
                    className="rounded-xl bg-[var(--color-panel-border)] hover:bg-[var(--color-panel)] px-4 py-2 font-bold"
                  >
                    {isExpanded ? "Hide turns" : "Show turns"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--color-text-muted)]">
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
                  <div className="mt-4 border-t border-[var(--color-panel-border)] pt-4">
                    <h3 className="font-bold mb-3">Turns</h3>

                    <div className="space-y-2">
                      {leg.turns
                        .slice()
                        .reverse()
                        .map((turn) => (
                          <div
                            key={turn.id}
                            className="rounded-lg bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                          >
                            <div className="font-semibold">
                              {turn.throwerName ?? turn.playerName} scored{" "}
                              {turn.scoreEntered}
                              {turn.darts ? ` — ${getDartSummary(turn.darts)}` : ""}
                              {turn.isBust ? " — BUST" : ""}
                              {turn.isCheckout ? " — CHECKOUT" : ""}
                              {turn.isDummy ? " — DUMMY" : ""}
                              {turn.throwerName &&
                              turn.throwerName !== turn.playerName
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
