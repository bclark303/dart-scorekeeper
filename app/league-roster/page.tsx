"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  CreateLeaguePlayerResponse,
  LeaguePlayerListResponse,
  LeaguePlayerSummary,
  SeasonRosterMutationResponse,
} from "@/lib/league/rosterContracts";

export default function LeagueRosterPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [players, setPlayers] = useState<LeaguePlayerSummary[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [workingRosterKey, setWorkingRosterKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? null,
    [leagues, selectedLeagueId],
  );
  const canAdmin =
    selectedLeague?.membershipRole === "owner" || selectedLeague?.membershipRole === "admin";

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
        setSelectedLeagueId((current) =>
          current && nextLeagues.some((league) => league.id === current)
            ? current
            : nextLeagues[0]?.id ?? "",
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load leagues.");
      });

    return () => controller.abort();
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || !selectedLeagueId) return;
    const controller = new AbortController();

    fetch(`/api/leagues/players?leagueId=${encodeURIComponent(selectedLeagueId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as LeaguePlayerListResponse;
        if (!response.ok || !result.players) {
          throw new Error(result.error ?? "Could not load league players.");
        }
        return result.players;
      })
      .then((nextPlayers) => {
        if (!controller.signal.aborted) setPlayers(nextPlayers);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load league players.");
      });

    return () => controller.abort();
  }, [selectedLeagueId, session?.user]);

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague || !canAdmin) return;

    setIsCreatingPlayer(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeague.id, displayName: playerName }),
      });
      const result = (await response.json()) as CreateLeaguePlayerResponse;
      if (!response.ok || !result.player) {
        throw new Error(result.error ?? "The player could not be created.");
      }

      setPlayers((current) =>
        [...current, result.player as LeaguePlayerSummary].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        ),
      );
      setPlayerName("");
      setStatusMessage(`${result.player.displayName} added to ${selectedLeague.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The player could not be created.");
    } finally {
      setIsCreatingPlayer(false);
    }
  }

  async function toggleSeason(player: LeaguePlayerSummary, seasonId: string, enroll: boolean) {
    if (!selectedLeague || !canAdmin) return;
    const key = `${player.id}:${seasonId}`;
    setWorkingRosterKey(key);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues/roster", {
        method: enroll ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeague.id,
          seasonId,
          leaguePlayerId: player.id,
        }),
      });
      const result = (await response.json()) as SeasonRosterMutationResponse;
      if (!response.ok || !result.player) {
        throw new Error(result.error ?? "The roster could not be changed.");
      }

      setPlayers((current) =>
        current.map((item) => (item.id === result.player?.id ? result.player : item)),
      );
      const season = selectedLeague.seasons.find((item) => item.id === seasonId);
      setStatusMessage(
        `${player.displayName} ${enroll ? "added to" : "removed from"} ${season?.name ?? "season"}.`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The roster could not be changed.");
    } finally {
      setWorkingRosterKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              League administration
            </div>
            <h1 className="text-3xl font-bold">Players & Rosters</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Create each dart player once, then register that player for any season in the league.
              Player identity remains separate from account/login identity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/leagues" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-soft)]">
              League Center
            </Link>
            <Link href="/" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-soft)]">
              Scorer
            </Link>
          </div>
        </header>

        {isSessionPending && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Checking account session…
          </section>
        )}

        {!isSessionPending && !session?.user && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
            <h2 className="text-xl font-bold">Sign in to manage league players</h2>
            <p className="mt-2 text-sm opacity-80">League rosters are stored in connected storage. Casual scoring remains available without an account.</p>
          </section>
        )}

        {!isSessionPending && session?.user && leagues.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-bold">Create a league first</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Players belong to a league before they can be registered for a season.</p>
            <Link href="/leagues" className="mt-4 inline-block rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)]">
              Open League Center
            </Link>
          </section>
        )}

        {!isSessionPending && session?.user && leagues.length > 0 && selectedLeague && (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <label>
                <span className="mb-1 block text-sm font-semibold">League</span>
                <select
                  value={selectedLeagueId}
                  onChange={(event) => {
                    setSelectedLeagueId(event.target.value);
                    setPlayers([]);
                    setStatusMessage("");
                    setErrorMessage("");
                  }}
                  className="w-full max-w-md rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>{league.name}</option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Your role: {selectedLeague.membershipRole}. {canAdmin ? "You can change this roster." : "This roster is read-only for you."}
              </p>
            </section>

            {canAdmin && (
              <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                <h2 className="text-xl font-bold">Add player</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">This creates a persistent player profile for the league. Do not create the same person again for each season.</p>
                <form onSubmit={handleCreatePlayer} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    required
                    maxLength={80}
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Player name"
                    className="min-w-0 flex-1 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                  />
                  <button
                    type="submit"
                    disabled={isCreatingPlayer}
                    className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                  >
                    {isCreatingPlayer ? "Adding…" : "Add player"}
                  </button>
                </form>
              </section>
            )}

            <section>
              <div className="mb-3">
                <h2 className="text-2xl font-bold">League players</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Toggle the seasons in which each player participates.</p>
              </div>

              {players.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
                  No persistent players have been added to this league yet.
                </div>
              )}

              <div className="space-y-4">
                {players.map((player) => (
                  <article key={player.id} className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-xl font-bold">{player.displayName}</h3>
                      <span className="text-xs text-[var(--color-text-muted)]">Persistent player profile</span>
                    </div>

                    {selectedLeague.seasons.length === 0 ? (
                      <div className="mt-4 rounded-xl bg-[var(--color-panel-soft)] p-3 text-sm text-[var(--color-text-muted)]">
                        This league has no seasons yet. Create one in League Center first.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedLeague.seasons.map((season) => {
                          const enrolled = player.seasonIds.includes(season.id);
                          const key = `${player.id}:${season.id}`;
                          return (
                            <button
                              key={season.id}
                              type="button"
                              disabled={!canAdmin || workingRosterKey === key}
                              onClick={() => void toggleSeason(player, season.id, !enrolled)}
                              className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                enrolled
                                  ? "border-emerald-500/50 bg-emerald-500/15"
                                  : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
                              }`}
                            >
                              <div className="font-bold">{season.name}</div>
                              <div className="mt-1 text-xs opacity-75">
                                {workingRosterKey === key ? "Saving…" : enrolled ? "On roster · click to remove" : "Not on roster · click to add"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sm">
              <div className="font-bold">Identity boundary</div>
              <p className="mt-1 opacity-80">
                A league player is the person who throws darts. A league account membership only controls access to league administration. They are intentionally not linked yet.
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
