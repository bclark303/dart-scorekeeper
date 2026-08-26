"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

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

function niceStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function GameNightsPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [newNightName, setNewNightName] = useState("League Night");
  const [newNightSeasonId, setNewNightSeasonId] = useState("");
  const [newNightDate, setNewNightDate] = useState("");
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const selectedSeasonId =
    workspace.league?.seasons.some((season) => season.id === newNightSeasonId)
      ? newNightSeasonId
      : workspace.league?.seasons[0]?.id ?? "";

  async function createGameNight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace.leagueId || !selectedSeasonId || !newNightDate) return;

    setWorking(true);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: workspace.leagueId,
          seasonId: selectedSeasonId,
          name: newNightName,
          scheduledAt: new Date(newNightDate).getTime(),
          settings: DEFAULT_GAME_NIGHT_SETTINGS,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: NonNullable<typeof workspace.night>;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Game Night could not be created.");
      }

      workspace.applyNight(result.gameNight);
      setStatusMessage("Game Night created and selected. Open the Control Room when ready.");
      setNewNightDate("");
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error
          ? error.message
          : "Game Night could not be created.",
      );
    } finally {
      setWorking(false);
    }
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
          <h1 className="text-3xl font-black">Game Night Hub</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in through Connected Storage before managing league Game Nights.
          </p>
        </section>
      </main>
    );
  }

  const night = workspace.night;
  const checkedIn =
    night?.attendance.filter((player) => player.status === "checked_in").length ?? 0;
  const fixtureCount = night
    ? night.rounds?.reduce((sum, round) => sum + round.pairings.length, 0) ??
      night.pairings.length
    : 0;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            League workspace
          </div>
          <h1 className="mt-1 text-3xl font-black">Game Night Hub</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Choose the league night you want to work with or schedule a new one.
            Once a night is selected, the Control Room becomes the operational
            home for running it.
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
          onLeagueChange={(leagueId) => {
            workspace.selectLeague(leagueId);
            setNewNightSeasonId("");
            setStatusMessage("");
          }}
          onNightChange={(nightId) => {
            workspace.selectNight(nightId);
            setStatusMessage("");
          }}
        />

        {night ? (
          <section className="rounded-2xl border border-[var(--color-primary)]/50 bg-[var(--color-panel)] p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--color-primary)]/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    Selected · {niceStatus(night.status)}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-black">{night.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {workspace.league?.name} · {night.seasonName} · {formatScheduledAt(night.scheduledAt)}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                      Checked in
                    </div>
                    <div className="mt-1 text-xl font-black">{checkedIn}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                      Teams
                    </div>
                    <div className="mt-1 text-xl font-black">{night.teams.length}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                      Boards
                    </div>
                    <div className="mt-1 text-xl font-black">{night.boards.length}</div>
                  </div>
                  <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                      Matches
                    </div>
                    <div className="mt-1 text-xl font-black">{fixtureCount}</div>
                  </div>
                </div>
              </div>

              <Link
                href="/game-nights/control"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-center font-black text-white lg:min-w-56"
              >
                Open Control Room →
              </Link>
            </div>
          </section>
        ) : workspace.league && !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-black">Choose a Game Night</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Select one below, or schedule the first Game Night for this league.
            </p>
          </section>
        ) : null}

        {workspace.league && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Scheduled Nights</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Select the night you want the Game Night workspace to use.
                </p>
              </div>
              {workspace.loading && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  Refreshing…
                </span>
              )}
            </div>

            {workspace.nights.length ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {workspace.nights.map((item) => {
                  const selected = item.id === workspace.nightId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        workspace.selectNight(item.id);
                        setStatusMessage("");
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]"
                          : "border-[var(--color-panel-border)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-black">{item.name}</div>
                        {selected && (
                          <span className="text-xs font-black uppercase text-[var(--color-primary)]">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {item.seasonName} · {formatScheduledAt(item.scheduledAt)}
                      </div>
                      <div className="mt-3 text-xs font-black uppercase tracking-wide">
                        {niceStatus(item.status)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !workspace.loading ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 text-sm text-[var(--color-text-muted)]">
                No Game Nights are scheduled for this league yet.
              </div>
            ) : null}
          </section>
        )}

        {workspace.league && (
          <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <summary className="cursor-pointer font-black">
              + Schedule a new Game Night
            </summary>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Create the shell here. Detailed rules, check-in, teams, and boards
              are handled after you open its Control Room.
            </p>
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
                value={selectedSeasonId}
                onChange={(event) => setNewNightSeasonId(event.target.value)}
                required
                className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
              >
                <option value="">Season</option>
                {workspace.league.seasons.map((season) => (
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
                className="rounded-xl bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-50"
              >
                {working ? "Creating…" : "Create Game Night"}
              </button>
            </form>
          </details>
        )}
      </div>
    </main>
  );
}
