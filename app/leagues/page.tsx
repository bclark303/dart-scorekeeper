"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type {
  CreateLeagueResponse,
  CreateSeasonResponse,
  LeagueListResponse,
  LeagueSummary,
} from "@/lib/league/contracts";

function roleLabel(role: LeagueSummary["membershipRole"]) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Administrator";
    default:
      return "Member";
  }
}

function seasonStatusLabel(status: LeagueSummary["seasons"][number]["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function LeaguesPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [firstSeasonName, setFirstSeasonName] = useState("Season 1");
  const [newSeasonNames, setNewSeasonNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingLeagueId, setWorkingLeagueId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadLeagues = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const result = (await response.json()) as LeagueListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Could not load leagues.");
      }

      setLeagues(result.leagues);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load leagues.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    void loadLeagues();
  }, [loadLeagues, session?.user]);

  async function handleCreateLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leagueName,
          firstSeasonName: firstSeasonName.trim() || undefined,
        }),
      });
      const result = (await response.json()) as CreateLeagueResponse;

      if (!response.ok || !result.league) {
        throw new Error(result.error ?? "The league could not be created.");
      }

      setLeagueName("");
      setFirstSeasonName("Season 1");
      setStatusMessage(`${result.league.name} created.`);
      await loadLeagues();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The league could not be created.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateSeason(
    event: FormEvent<HTMLFormElement>,
    league: LeagueSummary,
  ) {
    event.preventDefault();
    const name = newSeasonNames[league.id]?.trim() ?? "";
    if (!name) return;

    setWorkingLeagueId(league.id);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leagues/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id, name }),
      });
      const result = (await response.json()) as CreateSeasonResponse;

      if (!response.ok || !result.season) {
        throw new Error(result.error ?? "The season could not be created.");
      }

      setNewSeasonNames((current) => ({ ...current, [league.id]: "" }));
      setStatusMessage(`${result.season.name} added to ${league.name}.`);
      await loadLeagues();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The season could not be created.",
      );
    } finally {
      setWorkingLeagueId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Organization
            </div>
            <h1 className="text-3xl font-bold">League Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
              Create the league and season structure that future rosters, fixtures,
              standings, and league matches will use.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-soft)]"
          >
            Back to scorer
          </Link>
        </div>

        {isSessionPending && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Checking account session…
          </section>
        )}

        {!isSessionPending && !session?.user && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6">
            <h2 className="text-xl font-bold">Sign in to manage leagues</h2>
            <p className="mt-2 text-sm opacity-80">
              League administration is an account-backed feature. Casual scoring
              remains available without an account.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)]"
            >
              Go to Account & Sync
            </Link>
          </section>
        )}

        {!isSessionPending && session?.user && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">Create a league</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  You become the league owner. An initial season is optional and
                  starts in Draft status.
                </p>
              </div>

              <form onSubmit={handleCreateLeague} className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-semibold">League name</span>
                  <input
                    required
                    maxLength={80}
                    value={leagueName}
                    onChange={(event) => setLeagueName(event.target.value)}
                    placeholder="Tuesday Night Darts"
                    className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">First season</span>
                  <input
                    maxLength={80}
                    value={firstSeasonName}
                    onChange={(event) => setFirstSeasonName(event.target.value)}
                    placeholder="Season 1"
                    className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating…" : "Create league"}
                  </button>
                </div>
              </form>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Your leagues</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {session.user.name} · {session.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadLeagues()}
                  disabled={isLoading}
                  className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-panel-soft)] disabled:opacity-60"
                >
                  {isLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {!isLoading && leagues.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
                  No leagues yet. Create one above to start the league framework.
                </div>
              )}

              <div className="space-y-4">
                {leagues.map((league) => {
                  const canAdmin =
                    league.membershipRole === "owner" || league.membershipRole === "admin";

                  return (
                    <article
                      key={league.id}
                      className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{league.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                            <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1">
                              {roleLabel(league.membershipRole)}
                            </span>
                            <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1 capitalize">
                              {league.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {league.seasons.length} {league.seasons.length === 1 ? "season" : "seasons"}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {league.seasons.length === 0 ? (
                          <div className="rounded-xl bg-[var(--color-panel-soft)] p-3 text-sm text-[var(--color-text-muted)]">
                            No seasons have been created yet.
                          </div>
                        ) : (
                          league.seasons.map((season) => (
                            <div
                              key={season.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                            >
                              <span className="font-semibold">{season.name}</span>
                              <span className="text-xs font-bold text-[var(--color-text-muted)]">
                                {seasonStatusLabel(season.status)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {canAdmin && (
                        <form
                          onSubmit={(event) => void handleCreateSeason(event, league)}
                          className="mt-4 flex flex-col gap-2 sm:flex-row"
                        >
                          <input
                            required
                            maxLength={80}
                            value={newSeasonNames[league.id] ?? ""}
                            onChange={(event) =>
                              setNewSeasonNames((current) => ({
                                ...current,
                                [league.id]: event.target.value,
                              }))
                            }
                            placeholder="New season name"
                            className="min-w-0 flex-1 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                          />
                          <button
                            type="submit"
                            disabled={workingLeagueId === league.id}
                            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-border)] disabled:opacity-60"
                          >
                            {workingLeagueId === league.id ? "Adding…" : "Add season"}
                          </button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sm">
              <div className="font-bold">Framework boundary</div>
              <p className="mt-1 opacity-80">
                League membership currently controls account permissions only.
                Dart-player profiles, rosters, teams, fixtures, standings, and match
                assignment remain separate layers so we can design them without
                coupling a login account to a player identity.
              </p>
            </section>

            {statusMessage && !errorMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
