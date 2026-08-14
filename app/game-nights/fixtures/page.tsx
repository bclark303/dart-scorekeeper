"use client";

import Link from "next/link";
import { useEffect, useState, type SetStateAction } from "react";

import { GameNightFixturePanel } from "@/components/GameNightFixturePanel";
import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

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
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [settingsDraftState, setSettingsDraftState] = useState<{
    nightId: string;
    settings: GameNightSettingsSummary;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const settingsDraft =
    settingsDraftState && settingsDraftState.nightId === workspace.night?.id
      ? settingsDraftState.settings
      : workspace.night
        ? resolveGameNightSettings(workspace.night.settings)
        : DEFAULT_GAME_NIGHT_SETTINGS;

  function updateSettingsDraft(action: SetStateAction<GameNightSettingsSummary>) {
    if (!workspace.night) return;
    const nextSettings =
      typeof action === "function" ? action(settingsDraft) : action;
    setSettingsDraftState({
      nightId: workspace.night.id,
      settings: nextSettings,
    });
  }

  const nightStatus = workspace.night?.status;
  const refreshNight = workspace.refreshNight;

  useEffect(() => {
    if (nightStatus !== "active") return;
    const timer = window.setInterval(() => void refreshNight(), 5000);
    return () => window.clearInterval(timer);
  }, [nightStatus, refreshNight]);

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
        throw new Error(result.error ?? "Game Night update failed.");
      }
      workspace.applyNight(result.gameNight);
      setSettingsDraftState({
        nightId: result.gameNight.id,
        settings: resolveGameNightSettings(result.gameNight.settings),
      });
      if (message) setStatusMessage(message);
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error ? error.message : "Game Night update failed.",
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
        <h1 className="text-3xl font-black">Fixture & Round Control</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before running a league Game Night.
        </p>
      </main>
    );
  }

  const night = workspace.night;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night
            </div>
            <h1 className="mt-1 text-3xl font-black">Fixture & Round Control</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Generate synchronized fixtures, manage byes and intermissions, edit
              draft rounds, and release each round to its boards.
            </p>
          </div>
          <button
            type="button"
            disabled={working || !workspace.nightId}
            onClick={() => void workspace.refreshNight()}
            className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black disabled:opacity-50"
          >
            Refresh
          </button>
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
            setSettingsDraftState(null);
            setStatusMessage("");
          }}
          onNightChange={(nightId) => {
            workspace.selectNight(nightId);
            setSettingsDraftState(null);
            setStatusMessage("");
          }}
        />

        {night ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {night.seasonName} · {formatScheduledAt(night.scheduledAt)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-black uppercase">
                  {night.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!night.pairings.length && night.teams.length >= 2 && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void patchNight(
                        {
                          action: "populateBoards",
                          gameNightId: night.id,
                        },
                        "Round 1 fixture draft generated.",
                      )
                    }
                    className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white disabled:opacity-50"
                  >
                    Generate Round 1
                  </button>
                )}

                {night.status !== "active" &&
                  night.status !== "completed" &&
                  night.status !== "cancelled" &&
                  night.pairings.length > 0 && (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() =>
                        void patchNight(
                          {
                            action: "status",
                            gameNightId: night.id,
                            status: "active",
                          },
                          "Game Night started. Round 1 is live on registered boards.",
                        )
                      }
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white disabled:opacity-50"
                    >
                      Start Game Night / Round 1
                    </button>
                  )}

                {night.status === "active" && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void patchNight(
                        {
                          action: "status",
                          gameNightId: night.id,
                          status: "completed",
                        },
                        "Game Night completed.",
                      )
                    }
                    className="rounded-xl border border-emerald-500/50 px-4 py-2.5 font-black text-emerald-200 disabled:opacity-50"
                  >
                    Complete Game Night
                  </button>
                )}
              </div>

              {!night.pairings.length && night.teams.length < 2 && (
                <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Prepare at least two teams before generating Round 1.
                  <Link
                    href="/game-nights/teams"
                    className="ml-2 font-black text-[var(--color-primary)]"
                  >
                    Open Teams →
                  </Link>
                </div>
              )}
            </section>

            <GameNightFixturePanel
              gameNight={night}
              settings={settingsDraft}
              setSettings={updateSettingsDraft}
              disabled={working}
              onAction={patchNight}
            />
          </div>
        ) : !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
            Select a Game Night to manage its fixture sequence.
          </section>
        ) : null}
      </div>
    </main>
  );
}
