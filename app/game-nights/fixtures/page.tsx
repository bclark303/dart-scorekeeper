"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GameNightFixturePanel } from "@/components/GameNightFixturePanel";
import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function GameNightFixturesPage() {
  const { data: session, isPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [gameNights, setGameNights] = useState<GameNightSummary[]>([]);
  const [selectedGameNightId, setSelectedGameNightId] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<GameNightSettingsSummary>(
    DEFAULT_GAME_NIGHT_SETTINGS,
  );
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const selectedNight = useMemo(
    () => gameNights.find((night) => night.id === selectedGameNightId) ?? null,
    [gameNights, selectedGameNightId],
  );

  const applyNight = useCallback(
    (night: GameNightSummary, message?: string) => {
      setGameNights((current) =>
        current
          .map((item) => (item.id === night.id ? night : item))
          .sort((a, b) => a.scheduledAt - b.scheduledAt),
      );
      setSelectedGameNightId(night.id);
      setSettingsDraft(resolveGameNightSettings(night.settings));
      if (message) setStatusMessage(message);
    },
    [],
  );

  const loadLeagues = useCallback(async () => {
    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const result = (await response.json()) as LeagueListResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not load leagues.");
      }
      setLeagues(result.leagues);
      setSelectedLeagueId((current) => current || result.leagues[0]?.id || "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load leagues.",
      );
    }
  }, []);

  const loadNights = useCallback(async (leagueId: string) => {
    if (!leagueId) return;
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
        throw new Error(result.error ?? "Could not load Game Nights.");
      }
      setGameNights(result.gameNights);
      const first =
        result.gameNights.find((night) => night.status !== "completed") ??
        result.gameNights[0] ??
        null;
      setSelectedGameNightId(first?.id ?? "");
      setSettingsDraft(
        first
          ? resolveGameNightSettings(first.settings)
          : DEFAULT_GAME_NIGHT_SETTINGS,
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load Game Nights.",
      );
    }
  }, []);

  const refreshSelectedNight = useCallback(async () => {
    if (!selectedGameNightId) return;
    try {
      const response = await fetch(
        `/api/leagues/game-nights?gameNightId=${encodeURIComponent(selectedGameNightId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Could not refresh round status.");
      }
      applyNight(result.gameNight);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not refresh round status.",
      );
    }
  }, [applyNight, selectedGameNightId]);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => void loadLeagues(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    const timer = window.setTimeout(() => void loadNights(selectedLeagueId), 0);
    return () => window.clearTimeout(timer);
  }, [loadNights, selectedLeagueId]);

  useEffect(() => {
    if (selectedNight?.status !== "active") return;
    const timer = window.setInterval(() => void refreshSelectedNight(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshSelectedNight, selectedNight?.status]);

  async function patchNight(body: object, message?: string) {
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
      applyNight(result.gameNight, message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Game-night update failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (isPending) {
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
          className="text-sm font-bold text-[var(--color-primary)]"
        >
          ← Back to scorekeeper
        </Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">Fixture & Round Control</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in before running a league Game Night.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/game-nights"
            className="text-sm font-bold text-[var(--color-primary)]"
          >
            ← Game Night Control
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Fixture & Round Control</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Generate synchronized fixtures, manage byes and intermissions, and
            release each round to its boards.
          </p>
        </div>
        <button
          type="button"
          disabled={working || !selectedGameNightId}
          onClick={() => void refreshSelectedNight()}
          className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          Refresh
        </button>
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

      <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 md:grid-cols-2">
        <label className="text-sm font-bold">
          League
          <select
            value={selectedLeagueId}
            onChange={(event) => {
              setSelectedLeagueId(event.target.value);
              setSelectedGameNightId("");
              setSettingsDraft(DEFAULT_GAME_NIGHT_SETTINGS);
            }}
            className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
          >
            <option value="">Select league</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Game Night
          <select
            value={selectedGameNightId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedGameNightId(nextId);
              const nextNight = gameNights.find((night) => night.id === nextId);
              setSettingsDraft(
                nextNight
                  ? resolveGameNightSettings(nextNight.settings)
                  : DEFAULT_GAME_NIGHT_SETTINGS,
              );
            }}
            className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
          >
            <option value="">Select Game Night</option>
            {gameNights.map((night) => (
              <option key={night.id} value={night.id}>
                {night.name} · {formatScheduledAt(night.scheduledAt)} ·{" "}
                {night.status}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedNight ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{selectedNight.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {selectedNight.seasonName} ·{" "}
                  {formatScheduledAt(selectedNight.scheduledAt)}
                </p>
              </div>
              <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">
                {selectedNight.status}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!selectedNight.pairings.length &&
                selectedNight.teams.length >= 2 && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void patchNight(
                        {
                          action: "populateBoards",
                          gameNightId: selectedNight.id,
                        },
                        "Round 1 fixture draft generated.",
                      )
                    }
                    className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
                  >
                    Generate Round 1
                  </button>
                )}

              {selectedNight.status !== "active" &&
                selectedNight.status !== "completed" &&
                selectedNight.status !== "cancelled" &&
                selectedNight.pairings.length > 0 && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void patchNight(
                        {
                          action: "status",
                          gameNightId: selectedNight.id,
                          status: "active",
                        },
                        "Game Night started. Round 1 is live on registered boards.",
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
                  >
                    Start Game Night / Round 1
                  </button>
                )}

              {selectedNight.status === "active" && (
                <button
                  type="button"
                  disabled={working}
                  onClick={() =>
                    void patchNight(
                      {
                        action: "status",
                        gameNightId: selectedNight.id,
                        status: "completed",
                      },
                      "Game Night completed.",
                    )
                  }
                  className="rounded-xl border border-emerald-500/50 px-4 py-2.5 font-bold text-emerald-200 disabled:opacity-50"
                >
                  Complete Game Night
                </button>
              )}
            </div>
          </section>

          <GameNightFixturePanel
            gameNight={selectedNight}
            settings={settingsDraft}
            setSettings={setSettingsDraft}
            disabled={working}
            onAction={patchNight}
          />
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] p-6 text-sm text-[var(--color-text-muted)]">
          Select a Game Night to manage its fixture sequence.
        </section>
      )}
    </main>
  );
}
