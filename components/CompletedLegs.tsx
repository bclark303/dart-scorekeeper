import { Turn } from "@/lib/scoring";

type CompletedLeg = {
  legNumber: number;
  winnerId: string;
  winnerName: string;
  turns: Turn[];
};

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
          {completedLegs.map((leg) => (
            <div
              key={leg.legNumber}
              className="rounded-xl bg-slate-800 border border-slate-700 p-4"
            >
              <div className="text-lg font-bold">
                Leg {leg.legNumber}: {leg.winnerName} won
              </div>

              <div className="text-slate-300">
                Turns thrown: {leg.turns.length}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}