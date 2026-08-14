"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

export default function GameNightTeamsPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const teamByPlayer = useMemo(() => {
    const result = new Map<string, string>();
    for (const team of workspace.night?.teams ?? []) {
      for (const member of team.members) {
        if (member.leaguePlayerId) {
          result.set(member.leaguePlayerId, team.id);
        }
      }
    }
    return result;
  }, [workspace.night]);

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
                  disabled={working || structuralLocked || checkedIn.length < 2}
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
                          {member.displayName}
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
                    {checkedIn.map((player) => (
                      <label
                        key={player.leaguePlayerId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-panel-border)] p-3 text-sm"
                      >
                        <span className="font-black">{player.displayName}</span>
                        <select
                          value={teamByPlayer.get(player.leaguePlayerId) ?? ""}
                          disabled={working || structuralLocked}
                          onChange={(event) =>
                            void patchNight(
                              {
                                action: "assignTeam",
                                gameNightId: night.id,
                                leaguePlayerId: player.leaguePlayerId,
                                teamId: event.target.value || null,
                              },
                              `${player.displayName} team assignment updated.`,
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
                    ))}
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
