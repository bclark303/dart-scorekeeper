"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

type OptimisticTeamAssignment = {
  teamId: string | null;
};

function teamAssignmentMutationKey(gameNightId: string, leaguePlayerId: string) {
  return `${gameNightId}:${leaguePlayerId}`;
}

export default function GameNightTeamsPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [optimisticAssignments, setOptimisticAssignments] = useState<
    Record<string, OptimisticTeamAssignment>
  >({});
  const optimisticAssignmentsRef = useRef<
    Record<string, OptimisticTeamAssignment>
  >({});
  const processingAssignmentKeysRef = useRef(new Set<string>());
  const [savingAssignmentKeys, setSavingAssignmentKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const activeNightIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeNightIdRef.current = workspace.night?.id ?? null;
  }, [workspace.night?.id]);

  function updateOptimisticAssignments(
    updater: (
      current: Record<string, OptimisticTeamAssignment>,
    ) => Record<string, OptimisticTeamAssignment>,
  ) {
    const next = updater(optimisticAssignmentsRef.current);
    optimisticAssignmentsRef.current = next;
    setOptimisticAssignments(next);
  }

  function removeOptimisticAssignment(key: string) {
    updateOptimisticAssignments((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function markAssignmentSaving(key: string, saving: boolean) {
    setSavingAssignmentKeys((current) => {
      const next = new Set(current);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const teamByPlayer = useMemo(() => {
    const result = new Map<string, string>();
    const activeNight = workspace.night;
    for (const team of activeNight?.teams ?? []) {
      for (const member of team.members) {
        if (member.leaguePlayerId) {
          result.set(member.leaguePlayerId, team.id);
        }
      }
    }

    if (activeNight) {
      const prefix = `${activeNight.id}:`;
      for (const [key, assignment] of Object.entries(optimisticAssignments)) {
        if (!key.startsWith(prefix)) continue;
        const leaguePlayerId = key.slice(prefix.length);
        if (assignment.teamId) result.set(leaguePlayerId, assignment.teamId);
        else result.delete(leaguePlayerId);
      }
    }

    return result;
  }, [optimisticAssignments, workspace.night]);

  async function patchNight(body: object, message?: string) {
    setWorking(true);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Team update failed.");
      }
      workspace.applyNight(result.gameNight);
      if (message) setStatusMessage(message);
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error ? error.message : "Team update failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function flushTeamAssignment(
    gameNightId: string,
    leaguePlayerId: string,
    displayName: string,
  ) {
    const key = teamAssignmentMutationKey(gameNightId, leaguePlayerId);
    if (processingAssignmentKeysRef.current.has(key)) return;

    processingAssignmentKeysRef.current.add(key);
    markAssignmentSaving(key, true);
    workspace.setErrorMessage("");
    let failureMessage: string | null = null;

    try {
      while (true) {
        const desired = optimisticAssignmentsRef.current[key];
        if (!desired) break;

        const response = await fetch("/api/leagues/game-nights", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assignTeam",
            gameNightId,
            leaguePlayerId,
            teamId: desired.teamId,
          }),
        });
        const result = (await response.json()) as {
          gameNight?: GameNightSummary;
          error?: string;
        };
        if (!response.ok || !result.gameNight) {
          throw new Error(result.error ?? "Team assignment failed.");
        }

        if (activeNightIdRef.current === gameNightId) {
          workspace.applyNight(result.gameNight);
        }

        const latest = optimisticAssignmentsRef.current[key];
        if (!latest) break;
        if (latest.teamId === desired.teamId) {
          removeOptimisticAssignment(key);
          if (activeNightIdRef.current === gameNightId) {
            setStatusMessage(`${displayName} team assignment updated.`);
          }
          break;
        }
      }
    } catch (error) {
      failureMessage =
        error instanceof Error ? error.message : "Team assignment failed.";
      removeOptimisticAssignment(key);
    } finally {
      processingAssignmentKeysRef.current.delete(key);
      markAssignmentSaving(key, false);

      const stillSavingThisNight = [...processingAssignmentKeysRef.current].some(
        (mutationKey) => mutationKey.startsWith(`${gameNightId}:`),
      );
      if (
        activeNightIdRef.current === gameNightId &&
        (failureMessage || !stillSavingThisNight)
      ) {
        await workspace.refreshNight();
        if (failureMessage) workspace.setErrorMessage(failureMessage);
      }
    }
  }

  function queueTeamAssignment(
    leaguePlayerId: string,
    displayName: string,
    teamId: string | null,
  ) {
    if (!workspace.night) return;
    const gameNightId = workspace.night.id;
    const key = teamAssignmentMutationKey(gameNightId, leaguePlayerId);

    updateOptimisticAssignments((current) => ({
      ...current,
      [key]: { teamId },
    }));
    workspace.setErrorMessage("");
    setStatusMessage("");
    void flushTeamAssignment(gameNightId, leaguePlayerId, displayName);
  }

  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">
        Loading account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-black">Teams</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before preparing league teams.
        </p>
      </main>
    );
  }

  const night = workspace.night;
  const checkedIn =
    night?.attendance.filter((player) => player.status === "checked_in") ?? [];
  const structuralLocked = night
    ? ["active", "completed", "cancelled"].includes(night.status)
    : true;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Game Night
          </div>
          <h1 className="mt-1 text-3xl font-black">Teams</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Build teams from the checked-in player list, then make manual
            adjustments when the selected team mode allows it.
          </p>
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {workspace.errorMessage}
          </div>
        )}
        {statusMessage && !workspace.errorMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {statusMessage}
          </div>
        )}

        <GameNightWorkspacePicker
          leagues={workspace.leagues}
          leagueId={workspace.leagueId}
          nights={workspace.nights}
          nightId={workspace.nightId}
          onLeagueChange={workspace.selectLeague}
          onNightChange={workspace.selectNight}
        />

        {night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    {night.settings.teamCreationMode} team mode
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {checkedIn.length} checked in · target {night.settings.targetTeamCount} teams · {night.settings.minTeamPlayers}–{night.settings.maxTeamPlayers} players per team
                  </p>
                </div>
                <button
                  disabled={working || savingAssignmentKeys.size > 0 || structuralLocked || checkedIn.length < 2}
                  type="button"
                  onClick={() =>
                    void patchNight(
                      { action: "prepareTeams", gameNightId: night.id },
                      "Teams prepared from the current checked-in player list.",
                    )
                  }
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-50"
                >
                  {night.teams.length ? "Rebuild Teams" : "Prepare Teams"}
                </button>
              </div>

              {checkedIn.length < 2 && (
                <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  At least two players need to be checked in before teams can be prepared.
                  <Link
                    href="/game-nights/check-in"
                    className="ml-2 font-black text-[var(--color-primary)]"
                  >
                    Open Check-in →
                  </Link>
                </div>
              )}
              {structuralLocked && (
                <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Team structure is locked once the Game Night is active or closed.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Current Teams</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Dummy members are shown separately from real checked-in players.
                  </p>
                </div>
                <div className="text-sm font-black">
                  {night.teams.length} team{night.teams.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {night.teams.map((team) => (
                  <article
                    key={team.id}
                    className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black">{team.name}</h3>
                      {team.status && (
                        <span className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                          {team.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className={
                            member.isDummy
                              ? "italic text-[var(--color-text-muted)]"
                              : "font-semibold"
                          }
                        >
                          {!member.isDummy && member.playerId ? (
                            <Link href={`/players/${encodeURIComponent(member.playerId)}`} className="hover:text-[var(--color-primary)] hover:underline">
                              {member.displayName}
                            </Link>
                          ) : (
                            member.displayName
                          )}
                          {member.isDummy ? " · dummy" : ""}
                        </div>
                      ))}
                      {!team.members.length && (
                        <div className="text-[var(--color-text-muted)]">Empty</div>
                      )}
                    </div>
                  </article>
                ))}
                {!night.teams.length && (
                  <div className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-5 text-sm text-[var(--color-text-muted)] md:col-span-2">
                    No teams have been prepared yet.
                  </div>
                )}
              </div>
            </section>

            {night.teams.length > 0 &&
              night.settings.teamCreationMode !== "automatic" && (
                <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                  <h2 className="text-xl font-black">Manual Assignments</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Move checked-in real players between teams. Dummy balancing remains server-authoritative.
                  </p>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {checkedIn.map((player) => {
                      const mutationKey = teamAssignmentMutationKey(
                        night.id,
                        player.leaguePlayerId,
                      );
                      const isSaving = savingAssignmentKeys.has(mutationKey);
                      return (
                        <label
                          key={player.leaguePlayerId}
                          aria-busy={isSaving}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-panel-border)] p-3 text-sm"
                        >
                          <span className="flex flex-wrap items-center gap-2 font-black">
                            <Link href={`/players/${encodeURIComponent(player.playerId)}`} className="hover:text-[var(--color-primary)] hover:underline">
                              {player.displayName}
                            </Link>
                            {isSaving && (
                              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-200">
                                Saving…
                              </span>
                            )}
                          </span>
                          <select
                            value={teamByPlayer.get(player.leaguePlayerId) ?? ""}
                            disabled={working || structuralLocked}
                            onChange={(event) =>
                              queueTeamAssignment(
                                player.leaguePlayerId,
                                player.displayName,
                                event.target.value || null,
                              )
                            }
                            className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"
                          >
                            <option value="">Unassigned</option>
                            {night.teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next step
                </div>
                <div className="mt-1 font-black">Review the physical board layout</div>
              </div>
              <Link
                href="/game-nights/boards"
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
              >
                Open Boards →
              </Link>
            </section>
          </>
        ) : !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
            Select or create a Game Night from the Hub first.
          </section>
        ) : null}
      </div>
    </main>
  );
}
