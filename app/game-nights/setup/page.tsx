"use client";

import Link from "next/link";
import { useState, type SetStateAction } from "react";

import { GameNightRulesPanel } from "@/components/GameNightRulesPanel";
import { GameNightScheduleButton } from "@/components/GameNightScheduleButton";
import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
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

function finishLabel(value: GameNightSettingsSummary["finishRule"]) {
  return value === "double" ? "Double Out" : "Straight Out";
}

export default function GameNightSetupPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [settingsDraftState, setSettingsDraftState] = useState<{
    nightId: string;
    settings: GameNightSettingsSummary;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const storedSettings = workspace.night
    ? resolveGameNightSettings(workspace.night.settings)
    : DEFAULT_GAME_NIGHT_SETTINGS;
  const settingsDraft =
    settingsDraftState && settingsDraftState.nightId === workspace.night?.id
      ? settingsDraftState.settings
      : storedSettings;
  const rulesLocked = workspace.night
    ? ["active", "completed", "cancelled"].includes(workspace.night.status)
    : true;
  const hasUnsavedChanges = Boolean(
    workspace.night &&
      !rulesLocked &&
      JSON.stringify(settingsDraft) !== JSON.stringify(storedSettings),
  );

  function updateSettingsDraft(action: SetStateAction<GameNightSettingsSummary>) {
    if (!workspace.night || rulesLocked) return;
    const nextSettings =
      typeof action === "function" ? action(settingsDraft) : action;
    setSettingsDraftState({
      nightId: workspace.night.id,
      settings: nextSettings,
    });
  }

  async function saveRules() {
    if (!workspace.night || rulesLocked) return;
    setWorking(true);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          gameNightId: workspace.night.id,
          settings: settingsDraft,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Game Night rules could not be saved.");
      }
      workspace.applyNight(result.gameNight);
      setSettingsDraftState({
        nightId: result.gameNight.id,
        settings: resolveGameNightSettings(result.gameNight.settings),
      });
      setStatusMessage(
        "Rules saved. Any setup-only board fixture draft was cleared so it can be rebuilt safely.",
      );
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error
          ? error.message
          : "Game Night rules could not be saved.",
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
        <h1 className="text-3xl font-black">Setup & Rules</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before changing league Game Night settings.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night
            </div>
            <h1 className="mt-1 text-3xl font-black">Setup & Rules</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Review tonight&apos;s format at a glance, then change only the rules
              that need attention before play starts.
            </p>
          </div>
          <Link
            href="/game-night-templates"
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black"
          >
            Rules Templates
          </Link>
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

        {workspace.night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--color-primary)]/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                      {niceStatus(workspace.night.status)}
                    </span>
                    {hasUnsavedChanges && (
                      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-200">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-black">{workspace.night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {workspace.night.seasonName} · {formatDate(workspace.night.scheduledAt)}
                  </p>
                </div>
                <GameNightScheduleButton gameNight={workspace.night} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Game</div>
                  <div className="mt-1 text-lg font-black">{settingsDraft.startingScore}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Finish</div>
                  <div className="mt-1 text-lg font-black">{finishLabel(settingsDraft.finishRule)}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Match</div>
                  <div className="mt-1 text-lg font-black">
                    {settingsDraft.legsPerMatch === 1
                      ? "1 leg / round"
                      : `Best of ${settingsDraft.legsPerMatch}`}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Rounds</div>
                  <div className="mt-1 text-lg font-black">{settingsDraft.roundCount}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Teams</div>
                  <div className="mt-1 text-lg font-black">
                    {settingsDraft.teamCountMode === "automatic" ? "Auto" : settingsDraft.targetTeamCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--color-panel-soft)] p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Boards</div>
                  <div className="mt-1 text-lg font-black">
                    {settingsDraft.boardCountMode === "automatic" ? "Auto" : settingsDraft.boardCount}
                  </div>
                </div>
              </div>

              {rulesLocked ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Rules are locked because this Game Night is already active or closed.
                  You can still review the saved format below.
                </div>
              ) : hasUnsavedChanges ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  You have unsaved rule changes. Use <strong>Save Rules</strong> at
                  the bottom of the editor before moving on.
                </div>
              ) : (
                <div className="mt-4 text-sm text-[var(--color-text-muted)]">
                  These are the currently saved rules for this Game Night.
                </div>
              )}
            </section>

            <fieldset
              disabled={rulesLocked || working}
              className="min-w-0 border-0 p-0 disabled:opacity-75"
            >
              <GameNightRulesPanel
                settings={settingsDraft}
                setSettings={updateSettingsDraft}
                disabled={rulesLocked || working}
                onSave={() => void saveRules()}
              />
            </fieldset>

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  {rulesLocked ? "Return to operations" : "Next step"}
                </div>
                <div className="mt-1 font-black">
                  {rulesLocked
                    ? "Run this Game Night from the Control Room"
                    : "Check players in for this night"}
                </div>
              </div>
              <Link
                href={rulesLocked ? "/game-nights/control" : "/game-nights/check-in"}
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
              >
                {rulesLocked ? "Open Control Room →" : "Open Check-in →"}
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
