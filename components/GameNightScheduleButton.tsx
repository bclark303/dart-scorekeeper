"use client";

import { useMemo, useState } from "react";

import {
  resolveGameNightSettings,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";

function teamRoster(team: GameNightSummary["teams"][number] | undefined) {
  if (!team) return "Unknown team";
  if (!team.members.length) return "No players assigned";
  return team.members
    .map((member) => `${member.displayName}${member.isDummy ? " (dummy)" : ""}`)
    .join(", ");
}

export function GameNightScheduleButton({
  gameNight,
  className = "",
}: {
  gameNight: GameNightSummary;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolved = resolveGameNightSettings(gameNight.settings);
  const rounds = gameNight.rounds ?? [];
  const teamById = useMemo(
    () => new Map(gameNight.teams.map((team) => [team.id, team])),
    [gameNight.teams],
  );
  const roundByNumber = useMemo(
    () => new Map(rounds.map((round) => [round.roundNumber, round])),
    [rounds],
  );
  const activeTeams = gameNight.teams.filter((team) => team.status !== "withdrawn");
  const futureMatchCount = Math.floor(activeTeams.length / 2);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold"
        }
      >
        Show Full Night Schedule
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${gameNight.name} full schedule`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-6xl rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 rounded-t-2xl border-b border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 sm:p-5">
              <div>
                <h2 className="text-2xl font-bold">{gameNight.name} · Full Night Schedule</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {resolved.roundCount} round{resolved.roundCount === 1 ? "" : "s"} · {gameNight.boards.length} board{gameNight.boards.length === 1 ? "" : "s"} · {gameNight.teams.length} team{gameNight.teams.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              <section>
                <h3 className="text-lg font-bold">Team / Player Key</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {gameNight.teams.map((team) => (
                    <div
                      key={team.id}
                      className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">{team.name}</div>
                        {team.status === "withdrawn" && (
                          <span className="text-[10px] font-bold uppercase text-amber-200">
                            Withdrawn
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {teamRoster(team)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold">Boards</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {gameNight.boards.map((board) => (
                    <span
                      key={board.id}
                      className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold"
                    >
                      {board.name}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">Round-by-Round Schedule</h3>
                    <p className="mt-1 max-w-3xl text-xs text-[var(--color-text-muted)]">
                      Generated rounds show the authoritative board, team, and player assignments. Future rounds remain TBD until the fixture engine creates them so Swiss results, withdrawals, byes, board rotation, and coordinator edits cannot make this view misleading.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {Array.from({ length: resolved.roundCount }, (_, index) => index + 1).map(
                    (roundNumber) => {
                      const round = roundByNumber.get(roundNumber);
                      if (!round) {
                        return (
                          <div
                            key={roundNumber}
                            className="rounded-xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-bold">Round {roundNumber}</h4>
                              <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                                Not generated yet
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {Array.from({ length: futureMatchCount }, (_, matchIndex) => (
                                <div
                                  key={matchIndex}
                                  className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 text-sm"
                                >
                                  <div className="font-bold">Board TBD · Match {matchIndex + 1}</div>
                                  <div className="mt-1 text-[var(--color-text-muted)]">
                                    Team / player matchup generated after the prior round.
                                  </div>
                                </div>
                              ))}
                            </div>
                            {activeTeams.length % 2 !== 0 && (
                              <div className="mt-3 text-xs text-amber-100">
                                One team will receive the round bye; assignment is TBD.
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={roundNumber}
                          className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-bold">Round {roundNumber}</h4>
                            <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                              {round.status}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {[...round.pairings]
                              .sort((a, b) => a.boardNumber - b.boardNumber)
                              .map((pairing) => {
                                const teamA = teamById.get(pairing.teamAId);
                                const teamB = teamById.get(pairing.teamBId);
                                const board = gameNight.boards.find(
                                  (item) => item.id === pairing.boardId,
                                );
                                return (
                                  <div
                                    key={pairing.id}
                                    className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold">
                                        {board?.name ?? `Board ${pairing.boardNumber}`}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                                        {pairing.matchStatus ?? pairing.status}
                                      </span>
                                    </div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                      <div>
                                        <div className="font-bold">{teamA?.name ?? pairing.teamAId}</div>
                                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                                          {teamRoster(teamA)}
                                        </div>
                                      </div>
                                      <div className="text-center text-xs font-bold uppercase text-[var(--color-text-muted)]">
                                        vs
                                      </div>
                                      <div className="sm:text-right">
                                        <div className="font-bold">{teamB?.name ?? pairing.teamBId}</div>
                                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                                          {teamRoster(teamB)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          {round.byeTeamIds.length > 0 && (
                            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                              <span className="font-bold">Bye / waiting:</span>{" "}
                              {round.byeTeamIds
                                .map((id) => {
                                  const team = teamById.get(id);
                                  return team ? `${team.name} — ${teamRoster(team)}` : id;
                                })
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
