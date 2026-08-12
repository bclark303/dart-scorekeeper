"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { GameNightRulesPanel } from "@/components/GameNightRulesPanel";
import { GameNightStatsPanel } from "@/components/GameNightStatsPanel";
import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  type GameNightDuesStatus,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function GameNightsPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [gameNights, setGameNights] = useState<GameNightSummary[]>([]);
  const [selectedGameNightId, setSelectedGameNightId] = useState("");
  const [settingsDraft, setSettingsDraft] =
    useState<GameNightSettingsSummary>(DEFAULT_GAME_NIGHT_SETTINGS);
  const [newNightName, setNewNightName] = useState("League Night");
  const [newNightSeasonId, setNewNightSeasonId] = useState("");
  const [newNightDate, setNewNightDate] = useState("");
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedLeague =
    leagues.find((league) => league.id === selectedLeagueId) ?? null;
  const selectedNight =
    gameNights.find((night) => night.id === selectedGameNightId) ?? null;

  const teamByPlayer = useMemo(() => {
    const result = new Map<string, string>();
    for (const team of selectedNight?.teams ?? []) {
      for (const member of team.members) {
        if (member.leaguePlayerId) {
          result.set(member.leaguePlayerId, team.id);
        }
      }
    }
    return result;
  }, [selectedNight]);

  function applyReturnedNight(gameNight: GameNightSummary, message?: string) {
    setGameNights((current) => {
      const exists = current.some((night) => night.id === gameNight.id);
      const next = exists
        ? current.map((night) => (night.id === gameNight.id ? gameNight : night))
        : [...current, gameNight];
      return next.sort((a, b) => a.scheduledAt - b.scheduledAt);
    });
    setSelectedGameNightId(gameNight.id);
    setSettingsDraft(gameNight.settings);
    if (message) setStatusMessage(message);
  }

  const loadLeagues = useCallback(async () => {
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const result = (await response.json()) as LeagueListResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not load leagues.");
      }
      setLeagues(result.leagues);
      if (result.leagues.length) {
        const firstLeague = result.leagues[0];
        setSelectedLeagueId((current) => current || firstLeague.id);
        setNewNightSeasonId(
          (current) => current || firstLeague.seasons[0]?.id || "",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load leagues.",
      );
    }
  }, []);

  const loadGameNights = useCallback(async (leagueId: string) => {
    if (!leagueId) return;
    setErrorMessage("");
    try {
      const response = await fetch(
        `/api/leagues/game-nights?leagueId=${encodeURIComponent(leagueId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        gameNights?: GameNightSummary[];
        error?: string;
      };
      if (!response.ok || !result.gameNights) {
        throw new Error(result.error ?? "Could not load game nights.");
      }
      setGameNights(result.gameNights);
      const first = result.gameNights[0];
      if (first) {
        setSelectedGameNightId((current) =>
          current && result.gameNights?.some((night) => night.id === current)
            ? current
            : first.id,
        );
        setSettingsDraft(first.settings);
      } else {
        setSelectedGameNightId("");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load game nights.",
      );
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timeoutId = window.setTimeout(() => void loadLeagues(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    const timeoutId = window.setTimeout(
      () => void loadGameNights(selectedLeagueId),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [loadGameNights, selectedLeagueId]);

  async function patchGameNight(body: object, message?: string) {
    setWorking(true);
    setErrorMessage("");
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
        throw new Error(result.error ?? "Game-night update failed.");
      }
      applyReturnedNight(result.gameNight, message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Game-night update failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function createGameNight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeagueId || !newNightSeasonId || !newNightDate) return;
    setWorking(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          seasonId: newNightSeasonId,
          name: newNightName,
          scheduledAt: new Date(newNightDate).getTime(),
          settings: DEFAULT_GAME_NIGHT_SETTINGS,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Game night could not be created.");
      }
      applyReturnedNight(
        result.gameNight,
        "Game night created. Check in players when they arrive.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Game night could not be created.",
      );
    } finally {
      setWorking(false);
    }
  }

  function selectLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);
    const league = leagues.find((item) => item.id === leagueId);
    setNewNightSeasonId(league?.seasons[0]?.id ?? "");
    setSelectedGameNightId("");
  }

  function selectNight(gameNight: GameNightSummary) {
    setSelectedGameNightId(gameNight.id);
    setSettingsDraft(gameNight.settings);
    setErrorMessage("");
    setStatusMessage("");
  }

  if (isSessionPending) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-[var(--color-text-muted)]">
        Loading account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link
          href="/"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          ← Back to scorekeeper
        </Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">Game Nights</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in through Connected Storage before managing league game
            nights.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            ← Back to scorekeeper
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Game Nights</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Schedule the night, check players in, build teams, manage boards,
            and follow the live side contests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leagues"
            className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
          >
            League Center
          </Link>
          <Link
            href="/league-roster"
            className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
          >
            Players & Rosters
          </Link>
          <Link
            href="/league-devices"
            className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
          >
            Board Devices
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {statusMessage}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <label className="text-sm font-bold">League</label>
        <select
          value={selectedLeagueId}
          onChange={(event) => selectLeague(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3 sm:max-w-md"
        >
          <option value="">Select a league</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </section>

      {selectedLeague && (
        <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-xl font-bold">Schedule a Game Night</h2>
          <form
            onSubmit={createGameNight}
            className="mt-4 grid gap-3 md:grid-cols-4"
          >
            <input
              value={newNightName}
              onChange={(event) => setNewNightName(event.target.value)}
              maxLength={80}
              required
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
              placeholder="League Night"
            />
            <select
              value={newNightSeasonId}
              onChange={(event) => setNewNightSeasonId(event.target.value)}
              required
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
            >
              <option value="">Season</option>
              {selectedLeague.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={newNightDate}
              onChange={(event) => setNewNightDate(event.target.value)}
              required
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
            />
            <button
              disabled={working}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              Create Game Night
            </button>
          </form>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
          <h2 className="mb-3 text-lg font-bold">Scheduled Nights</h2>
          <div className="space-y-2">
            {gameNights.map((night) => (
              <button
                key={night.id}
                type="button"
                onClick={() => selectNight(night)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedGameNightId === night.id
                    ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]"
                    : "border-[var(--color-panel-border)]"
                }`}
              >
                <div className="font-bold">{night.name}</div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {night.seasonName}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {formatScheduledAt(night.scheduledAt)}
                </div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide">
                  {night.status}
                </div>
              </button>
            ))}
            {!gameNights.length && (
              <p className="text-sm text-[var(--color-text-muted)]">
                No game nights scheduled yet.
              </p>
            )}
          </div>
        </aside>

        {selectedNight ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">{selectedNight.name}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {selectedNight.seasonName} ·{" "}
                    {formatScheduledAt(selectedNight.scheduledAt)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">
                  {selectedNight.status}
                </span>
              </div>
            </section>

            <GameNightStatsPanel
              gameNightId={selectedNight.id}
              status={selectedNight.status}
            />

            <GameNightRulesPanel
              settings={settingsDraft}
              setSettings={setSettingsDraft}
              disabled={working}
              onSave={() =>
                void patchGameNight(
                  {
                    action: "settings",
                    gameNightId: selectedNight.id,
                    settings: settingsDraft,
                  },
                  "Rules saved. Existing board pairings were cleared so they can be rebuilt safely.",
                )
              }
            />

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">Check-in & Dues</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Only checked-in players are available when teams are
                    prepared.
                  </p>
                </div>
                <div className="text-sm font-bold">
                  {
                    selectedNight.attendance.filter(
                      (player) => player.status === "checked_in",
                    ).length
                  }{" "}
                  checked in
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {selectedNight.attendance.map((player) => (
                  <div
                    key={player.leaguePlayerId}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--color-panel-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="font-bold">{player.displayName}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void patchGameNight(
                            {
                              action: "attendance",
                              gameNightId: selectedNight.id,
                              leaguePlayerId: player.leaguePlayerId,
                              checkedIn: player.status !== "checked_in",
                              duesStatus: player.duesStatus,
                            },
                            player.status === "checked_in"
                              ? `${player.displayName} checked out.`
                              : `${player.displayName} checked in.`,
                          )
                        }
                        className={`rounded-lg px-3 py-2 text-sm font-bold ${
                          player.status === "checked_in"
                            ? "bg-emerald-500/20 text-emerald-100"
                            : "bg-[var(--color-panel-soft)]"
                        }`}
                      >
                        {player.status === "checked_in"
                          ? "Checked In ✓"
                          : "Check In"}
                      </button>
                      <select
                        value={player.duesStatus}
                        disabled={working}
                        onChange={(event) =>
                          void patchGameNight(
                            {
                              action: "attendance",
                              gameNightId: selectedNight.id,
                              leaguePlayerId: player.leaguePlayerId,
                              checkedIn: player.status === "checked_in",
                              duesStatus: event.target
                                .value as GameNightDuesStatus,
                            },
                            `${player.displayName} dues updated.`,
                          )
                        }
                        className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm"
                      >
                        <option value="unpaid">Dues: Unpaid</option>
                        <option value="paid">Dues: Paid</option>
                        <option value="waived">Dues: Waived</option>
                      </select>
                    </div>
                  </div>
                ))}
                {!selectedNight.attendance.length && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    This season has no active roster players yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Teams</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Automatic generates balanced teams; Manual creates empty
                    shells; Hybrid generates teams and keeps them editable.
                  </p>
                </div>
                <button
                  disabled={working}
                  type="button"
                  onClick={() =>
                    void patchGameNight(
                      {
                        action: "prepareTeams",
                        gameNightId: selectedNight.id,
                      },
                      "Teams prepared from the checked-in player list.",
                    )
                  }
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  {selectedNight.teams.length ? "Rebuild Teams" : "Prepare Teams"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {selectedNight.teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-xl border border-[var(--color-panel-border)] p-3"
                  >
                    <div className="font-bold">{team.name}</div>
                    <div className="mt-2 space-y-1 text-sm">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className={
                            member.isDummy
                              ? "italic text-[var(--color-text-muted)]"
                              : ""
                          }
                        >
                          {member.displayName}
                          {member.isDummy ? " (dummy)" : ""}
                        </div>
                      ))}
                      {!team.members.length && (
                        <div className="text-[var(--color-text-muted)]">
                          Empty
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedNight.teams.length > 0 &&
                selectedNight.settings.teamCreationMode !== "automatic" && (
                  <div className="mt-5 border-t border-[var(--color-panel-border)] pt-4">
                    <h3 className="font-bold">Manual adjustments</h3>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {selectedNight.attendance
                        .filter((player) => player.status === "checked_in")
                        .map((player) => (
                          <label
                            key={player.leaguePlayerId}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-panel-border)] p-3 text-sm"
                          >
                            <span className="font-semibold">
                              {player.displayName}
                            </span>
                            <select
                              value={
                                teamByPlayer.get(player.leaguePlayerId) ?? ""
                              }
                              disabled={working}
                              onChange={(event) =>
                                void patchGameNight(
                                  {
                                    action: "assignTeam",
                                    gameNightId: selectedNight.id,
                                    leaguePlayerId: player.leaguePlayerId,
                                    teamId: event.target.value || null,
                                  },
                                  `${player.displayName} team assignment updated.`,
                                )
                              }
                              className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"
                            >
                              <option value="">Unassigned</option>
                              {selectedNight.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Boards</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Populate the current teams onto physical boards and create
                    central match sessions.
                  </p>
                </div>
                <button
                  disabled={working || selectedNight.teams.length < 2}
                  type="button"
                  onClick={() =>
                    void patchGameNight(
                      {
                        action: "populateBoards",
                        gameNightId: selectedNight.id,
                      },
                      "Boards populated and central match sessions created for round one.",
                    )
                  }
                  className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  Populate Boards
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedNight.boards.map((board) => {
                  const pairing = selectedNight.pairings.find(
                    (item) =>
                      item.boardId === board.id && item.roundNumber === 1,
                  );
                  const teamA = selectedNight.teams.find(
                    (team) => team.id === pairing?.teamAId,
                  );
                  const teamB = selectedNight.teams.find(
                    (team) => team.id === pairing?.teamBId,
                  );
                  const winner = selectedNight.teams.find(
                    (team) => team.id === pairing?.winnerTeamId,
                  );

                  return (
                    <div
                      key={board.id}
                      className="rounded-xl border border-[var(--color-panel-border)] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">{board.name}</div>
                        {pairing?.matchStatus && (
                          <span className="rounded-full border border-[var(--color-panel-border)] px-2 py-1 text-[10px] font-bold uppercase">
                            {pairing.matchStatus}
                          </span>
                        )}
                      </div>
                      {pairing ? (
                        <div className="mt-3 text-center">
                          <div className="font-bold">{teamA?.name}</div>
                          <div className="my-1 text-xs text-[var(--color-text-muted)]">
                            vs
                          </div>
                          <div className="font-bold">{teamB?.name}</div>
                          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                            {selectedNight.settings.startingScore} · Best of{" "}
                            {selectedNight.settings.legsPerMatch} ·{" "}
                            {selectedNight.settings.finishRule} out
                          </div>
                          {winner && (
                            <div className="mt-2 text-xs font-bold text-emerald-300">
                              Winner: {winner.name}
                            </div>
                          )}
                          {pairing.matchSessionId && (
                            <Link
                              href={`/league-match/${pairing.matchSessionId}`}
                              className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white"
                            >
                              Open Scorer
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-[var(--color-text-muted)]">
                          Not populated
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedNight.unpairedTeamIds.length > 0 && (
                <p className="mt-3 text-sm text-amber-100">
                  Waiting/bye:{" "}
                  {selectedNight.unpairedTeamIds
                    .map(
                      (id) =>
                        selectedNight.teams.find((team) => team.id === id)
                          ?.name ?? id,
                    )
                    .join(", ")}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  disabled={
                    working ||
                    !selectedNight.pairings.length ||
                    selectedNight.status === "active"
                  }
                  type="button"
                  onClick={() =>
                    void patchGameNight(
                      {
                        action: "status",
                        gameNightId: selectedNight.id,
                        status: "active",
                      },
                      "Game night started. Board scorers can now start their assigned matches.",
                    )
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  Start Game Night
                </button>
                {selectedNight.status === "active" && (
                  <button
                    disabled={working}
                    type="button"
                    onClick={() =>
                      void patchGameNight(
                        {
                          action: "status",
                          gameNightId: selectedNight.id,
                          status: "completed",
                        },
                        "Game night marked complete.",
                      )
                    }
                    className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-bold"
                  >
                    Complete Night
                  </button>
                )}
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Select or create a Game Night to begin.
          </section>
        )}
      </div>
    </main>
  );
}
