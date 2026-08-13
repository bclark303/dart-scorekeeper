"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  CreateLeaguePlayerResponse,
  PlayerDirectoryLeagueMembership,
  PlayerDirectoryListResponse,
  PlayerDirectoryPlayer,
  SeasonRosterMutationResponse,
} from "@/lib/league/rosterContracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function LeagueRosterPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [directory, setDirectory] = useState<PlayerDirectoryPlayer[]>([]);
  const [query, setQuery] = useState("");
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId],
  );
  const canAdmin =
    selectedLeague?.membershipRole === "owner" || selectedLeague?.membershipRole === "admin";

  const loadDirectory = useCallback(async () => {
    if (!session?.user) return;
    setIsLoadingDirectory(true);
    try {
      const response = await fetch("/api/players", { cache: "no-store" });
      const result = (await response.json()) as PlayerDirectoryListResponse;
      if (!response.ok || !result.players) {
        throw new Error(result.error ?? "Could not load the player directory.");
      }
      setDirectory(result.players);
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    const controller = new AbortController();

    fetch("/api/leagues", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as LeagueListResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
        return result.leagues;
      })
      .then((nextLeagues) => {
        if (controller.signal.aborted) return;
        setLeagues(nextLeagues);
        const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
        const nextLeagueId =
          (remembered && nextLeagues.some((league) => league.id === remembered) && remembered) ||
          nextLeagues[0]?.id ||
          "";
        setSelectedLeagueId(nextLeagueId);
        if (nextLeagueId) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, nextLeagueId);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load leagues.");
      });

    return () => controller.abort();
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => {
      void loadDirectory().catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : "Could not load the player directory.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDirectory, session?.user]);

  const normalizedQuery = normalizeName(query).toLocaleLowerCase();
  const visiblePlayers = useMemo(() => {
    if (!normalizedQuery) return directory;
    return directory.filter((player) => {
      const searchable = [
        player.displayName,
        ...player.memberships.map((membership) => membership.leagueName),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [directory, normalizedQuery]);

  const exactNameMatch = useMemo(
    () =>
      normalizedQuery
        ? directory.find(
            (player) => player.displayName.trim().toLocaleLowerCase() === normalizedQuery,
          ) ?? null
        : null,
    [directory, normalizedQuery],
  );

  function membershipForSelectedLeague(player: PlayerDirectoryPlayer) {
    return player.memberships.find((membership) => membership.leagueId === selectedLeagueId) ?? null;
  }

  async function addExistingPlayer(player: PlayerDirectoryPlayer) {
    if (!selectedLeague || !canAdmin) return;
    const key = `league:${player.playerId}:${selectedLeague.id}`;
    setWorkingKey(key);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeague.id, playerId: player.playerId }),
      });
      const result = (await response.json()) as CreateLeaguePlayerResponse;
      if (!response.ok || !result.player) {
        throw new Error(result.error ?? "The player could not be added to the league.");
      }
      await loadDirectory();
      setStatusMessage(`${player.displayName} added to ${selectedLeague.name}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The player could not be added to the league.",
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function createNewPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague || !canAdmin) return;
    const displayName = normalizeName(query);
    if (!displayName || exactNameMatch) return;

    setWorkingKey("create");
    setStatusMessage("");
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeague.id, displayName }),
      });
      const result = (await response.json()) as CreateLeaguePlayerResponse;
      if (!response.ok || !result.player) {
        throw new Error(result.error ?? "The player could not be created.");
      }
      await loadDirectory();
      setQuery("");
      setStatusMessage(`${result.player.displayName} created and added to ${selectedLeague.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The player could not be created.");
    } finally {
      setWorkingKey(null);
    }
  }

  async function toggleSeason(
    player: PlayerDirectoryPlayer,
    membership: PlayerDirectoryLeagueMembership,
    seasonId: string,
    enroll: boolean,
  ) {
    if (!selectedLeague || !canAdmin) return;
    const key = `season:${membership.leaguePlayerId}:${seasonId}`;
    setWorkingKey(key);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues/roster", {
        method: enroll ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeague.id,
          seasonId,
          leaguePlayerId: membership.leaguePlayerId,
        }),
      });
      const result = (await response.json()) as SeasonRosterMutationResponse;
      if (!response.ok || !result.player) {
        throw new Error(result.error ?? "The season roster could not be changed.");
      }
      await loadDirectory();
      const season = selectedLeague.seasons.find((item) => item.id === seasonId);
      setStatusMessage(
        `${player.displayName} ${enroll ? "added to" : "removed from"} ${season?.name ?? "season"}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The season roster could not be changed.",
      );
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/league-play" className="text-sm font-black text-[var(--color-primary)]">
              ← League Play
            </Link>
            <h1 className="mt-2 text-3xl font-black">Player Directory</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Each person exists once. Add that master player to any league, then choose the seasons they play in.
            </p>
          </div>
          <Link
            href="/help?from=players"
            aria-label="Help"
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black"
          >
            ?
          </Link>
        </header>

        {isSessionPending && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Checking account session…
          </section>
        )}

        {!isSessionPending && !session?.user && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
            <h2 className="text-xl font-black">Sign in to manage players</h2>
            <p className="mt-2 text-sm opacity-80">The master directory is connected league data. Casual play remains local and account-free.</p>
          </section>
        )}

        {!isSessionPending && session?.user && leagues.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-black">Create a league first</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">A new master player is created with an initial league membership.</p>
            <Link href="/leagues" className="mt-4 inline-block rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white">
              Open League Setup
            </Link>
          </section>
        )}

        {!isSessionPending && session?.user && selectedLeague && (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <label className="block flex-1">
                  <span className="mb-1 block text-sm font-bold">Manage membership for</span>
                  <select
                    value={selectedLeagueId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedLeagueId(nextId);
                      window.localStorage.setItem(ACTIVE_LEAGUE_KEY, nextId);
                      setStatusMessage("");
                      setErrorMessage("");
                    }}
                    className="w-full max-w-md rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-bold"
                  >
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.name}</option>
                    ))}
                  </select>
                </label>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {canAdmin ? "You can add players and change season rosters." : "Read-only league membership."}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Search all players</span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setStatusMessage("");
                  }}
                  maxLength={80}
                  placeholder="Start typing a player name…"
                  className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                />
              </label>

              {normalizedQuery && exactNameMatch && (
                <div className="mt-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm">
                  <span className="font-bold">Existing player found:</span> {exactNameMatch.displayName}. Use that profile rather than creating another one.
                </div>
              )}

              {canAdmin && normalizeName(query) && !exactNameMatch && (
                <form onSubmit={createNewPlayer} className="mt-3 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4">
                  <div className="text-sm text-[var(--color-text-muted)]">No exact master-player match was found.</div>
                  <button
                    type="submit"
                    disabled={workingKey === "create"}
                    className="mt-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-60"
                  >
                    {workingKey === "create"
                      ? "Creating…"
                      : `Create “${normalizeName(query)}” and add to ${selectedLeague.name}`}
                  </button>
                </form>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">All Players</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {directory.length} master {directory.length === 1 ? "player" : "players"} across your leagues.
                  </p>
                </div>
                {isLoadingDirectory && <span className="text-sm text-[var(--color-text-muted)]">Refreshing…</span>}
              </div>

              {!isLoadingDirectory && directory.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
                  No master players yet. Search for a name above to create the first player in {selectedLeague.name}.
                </div>
              )}

              {directory.length > 0 && visiblePlayers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
                  No players match this search.
                </div>
              )}

              <div className="space-y-4">
                {visiblePlayers.map((player) => {
                  const membership = membershipForSelectedLeague(player);
                  const addKey = `league:${player.playerId}:${selectedLeague.id}`;

                  return (
                    <article key={player.playerId} className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black">{player.displayName}</h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {player.memberships.map((item) => (
                              <span key={item.leaguePlayerId} className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs font-bold">
                                {item.leagueName}
                              </span>
                            ))}
                          </div>
                        </div>

                        {!membership && canAdmin && (
                          <button
                            type="button"
                            disabled={workingKey === addKey}
                            onClick={() => void addExistingPlayer(player)}
                            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-60"
                          >
                            {workingKey === addKey ? "Adding…" : `Add to ${selectedLeague.name}`}
                          </button>
                        )}
                        {!membership && !canAdmin && (
                          <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs text-[var(--color-text-muted)]">Not in this league</span>
                        )}
                      </div>

                      {membership && (
                        <div className="mt-4 border-t border-[var(--color-panel-border)] pt-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-black">{selectedLeague.name}</div>
                              <div className="text-xs text-[var(--color-text-muted)]">League member · choose season participation below</div>
                            </div>
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">Member</span>
                          </div>

                          {selectedLeague.seasons.length === 0 ? (
                            <div className="rounded-xl bg-[var(--color-panel-soft)] p-3 text-sm text-[var(--color-text-muted)]">
                              This league has no seasons yet.
                            </div>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {selectedLeague.seasons.map((season) => {
                                const enrolled = membership.seasonIds.includes(season.id);
                                const seasonKey = `season:${membership.leaguePlayerId}:${season.id}`;
                                return (
                                  <button
                                    key={season.id}
                                    type="button"
                                    disabled={!canAdmin || workingKey === seasonKey}
                                    onClick={() => void toggleSeason(player, membership, season.id, !enrolled)}
                                    className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                      enrolled
                                        ? "border-emerald-500/50 bg-emerald-500/15"
                                        : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
                                    }`}
                                  >
                                    <div className="font-bold">{season.name}</div>
                                    <div className="mt-1 text-xs opacity-75">
                                      {workingKey === seasonKey
                                        ? "Saving…"
                                        : enrolled
                                          ? "On roster · click to remove"
                                          : "Not on roster · click to add"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sm">
              <div className="font-black">One identity, many contexts</div>
              <p className="mt-1 opacity-80">
                The master player ID is shared across leagues. League memberships and season rosters stay separate, so upcoming statistics can show overall career results or filter the same person by league and season without duplicate profiles.
              </p>
            </section>
          </>
        )}

        {statusMessage && !errorMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">{statusMessage}</div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">{errorMessage}</div>
        )}
      </div>
    </main>
  );
}
