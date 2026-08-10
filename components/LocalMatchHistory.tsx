"use client";

import { useEffect, useState } from "react";

import {
  listLocalX01MatchArchives,
  LOCAL_ARCHIVE_CHANGED_EVENT,
  type LocalX01MatchArchiveRecord,
} from "@/lib/persistence";

function getSyncLabel(status: LocalX01MatchArchiveRecord["syncStatus"]) {
  switch (status) {
    case "synced":
      return "Synced";
    case "error":
      return "Sync error";
    default:
      return "Local only";
  }
}

function getSyncClass(status: LocalX01MatchArchiveRecord["syncStatus"]) {
  switch (status) {
    case "synced":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "error":
      return "border-rose-500/40 bg-rose-500/10 text-rose-200";
    default:
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }
}

function formatFinishRule(finishRule: string) {
  return finishRule === "double_out" ? "Double out" : "Straight out";
}

function formatArchiveDate(record: LocalX01MatchArchiveRecord) {
  const timestamp = record.archive.completedAt ?? record.queuedAt;
  return new Date(timestamp).toLocaleString();
}

export function LocalMatchHistory() {
  const [records, setRecords] = useState<LocalX01MatchArchiveRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
  let cancelled = false;

  const loadHistory = () => {
    void listLocalX01MatchArchives()
      .then((localRecords) => {
        if (cancelled) return;
        setRecords(localRecords);
        setLoadError("");
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Could not load local completed-match history.", error);
        setLoadError(
          "Completed match history could not be loaded from this browser.",
        );
        setIsLoading(false);
      });
  };

  const handleArchiveChange = () => loadHistory();
  loadHistory();
  window.addEventListener(
    LOCAL_ARCHIVE_CHANGED_EVENT,
    handleArchiveChange,
  );

  return () => {
    cancelled = true;
    window.removeEventListener(
      LOCAL_ARCHIVE_CHANGED_EVENT,
      handleArchiveChange,
    );
  };
}, []);

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Completed Match Archive</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Completed matches saved on this device. Signed-in accounts synchronize this archive across devices.
          </p>
        </div>

        {!isLoading && !loadError && records.length > 0 && (
          <div className="text-sm font-semibold text-[var(--color-text-muted)]">
            {records.length} {records.length === 1 ? "match" : "matches"}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-[var(--color-text-muted)]">
          Loading completed matches…
        </div>
      )}

      {!isLoading && loadError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && records.length === 0 && (
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-[var(--color-text-muted)]">
          No completed matches have been archived on this device yet. Finish an X01 match and it will appear here.
        </div>
      )}

      {!isLoading && !loadError && records.length > 0 && (
        <div className="space-y-4">
          {records.map((record) => {
            const archive = record.archive;
            const sideById = new Map(archive.sides.map((side) => [side.id, side]));
            const participantById = new Map(
              archive.sides.flatMap((side) =>
                side.participants.map((participant) => [participant.id, participant] as const),
              ),
            );
            const legWins = new Map(archive.sides.map((side) => [side.id, 0]));

            for (const leg of archive.legs) {
              legWins.set(leg.winnerSideId, (legWins.get(leg.winnerSideId) ?? 0) + 1);
            }

            const winner = archive.winnerSideId
              ? sideById.get(archive.winnerSideId)
              : undefined;
            const turnCount = archive.legs.reduce(
              (total, leg) => total + leg.turns.length,
              0,
            );
            const dartCount = archive.legs.reduce(
              (total, leg) =>
                total +
                leg.turns.reduce(
                  (legTotal, turn) => legTotal + turn.dartsThrown,
                  0,
                ),
              0,
            );

            return (
              <article
                key={record.id}
                className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {formatArchiveDate(record)}
                    </div>
                    <div className="mt-1 text-xl font-bold">
                      {archive.sides
                        .map((side) => `${side.name} ${legWins.get(side.id) ?? 0}`)
                        .join("  –  ")}
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {archive.settings.startingScore} · {formatFinishRule(archive.settings.finishRule)} · Best of {archive.settings.bestOfLegs}
                    </div>
                  </div>

                  <span
                    className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${getSyncClass(record.syncStatus)}`}
                  >
                    {getSyncLabel(record.syncStatus)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Winner</div>
                    <div className="mt-1 font-bold">{winner?.name ?? "Unknown"}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Legs</div>
                    <div className="mt-1 font-bold">{archive.legs.length}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Turns</div>
                    <div className="mt-1 font-bold">{turnCount}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Darts</div>
                    <div className="mt-1 font-bold">{dartCount}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {archive.sides.map((side) => (
                    <div
                      key={side.id}
                      className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2"
                    >
                      <span className="font-bold">{side.name}:</span>{" "}
                      <span className="text-[var(--color-text-muted)]">
                        {side.participants
                          .map((participant) =>
                            participant.isDummy
                              ? `${participant.displayName} (dummy)`
                              : participant.displayName,
                          )
                          .join(", ")}
                      </span>
                    </div>
                  ))}
                </div>

                {record.syncStatus === "error" && record.lastSyncError && (
                  <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    Last sync error: {record.lastSyncError}
                  </div>
                )}

                <details className="mt-4 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                  <summary className="cursor-pointer font-bold">
                    Leg and turn details
                  </summary>

                  <div className="mt-3 space-y-3">
                    {archive.legs.map((leg) => {
                      const legWinner = sideById.get(leg.winnerSideId);

                      return (
                        <div
                          key={leg.id}
                          className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                        >
                          <div className="font-bold">
                            Leg {leg.legNumber} · {legWinner?.name ?? "Unknown"} won
                          </div>

                          <div className="mt-2 space-y-1 text-sm">
                            {leg.turns.length === 0 && (
                              <div className="text-[var(--color-text-muted)]">
                                No turn detail was recorded for this leg.
                              </div>
                            )}

                            {leg.turns.map((turn) => {
                              const side = sideById.get(turn.sideId);
                              const participant = turn.participantId
                                ? participantById.get(turn.participantId)
                                : undefined;

                              return (
                                <div
                                  key={turn.id}
                                  className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-panel-border)] py-2 first:border-t-0 first:pt-0"
                                >
                                  <span>
                                    <span className="font-semibold">
                                      {participant?.displayName ?? side?.name ?? "Player"}
                                    </span>{" "}
                                    <span className="text-[var(--color-text-muted)]">
                                      · {turn.scoreEntered}
                                      {turn.isBust ? " · BUST" : ""}
                                      {turn.isCheckout ? " · CHECKOUT" : ""}
                                    </span>
                                  </span>
                                  <span className="text-[var(--color-text-muted)]">
                                    {turn.scoreBefore} → {turn.scoreAfter} · {turn.dartsThrown} darts
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
