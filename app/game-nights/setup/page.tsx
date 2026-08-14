"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function GameNightSetupPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [settingsDraft, setSettingsDraft] = useState<GameNightSettingsSummary>(
    DEFAULT_GAME_NIGHT_SETTINGS,
  );
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setSettingsDraft(
      workspace.night
        ? resolveGameNightSettings(workspace.night.settings)
        : DEFAULT_GAME_NIGHT_SETTINGS,
    );
    setStatusMessage("");
  }, [workspace.night]);

  async function saveRules() {
    if (!workspace.night) return;
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
      setSettingsDraft(resolveGameNightSettings(result.gameNight.settings));
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
              Configure team generation, dummy policy, boards, rounds, match
              format, and intermissions before the night goes live.
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
          onLeagueChange={workspace.selectLeague}
          onNightChange={workspace.selectNight}
        />

        {workspace.night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{workspace.night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {workspace.night.seasonName} · {formatDate(workspace.night.scheduledAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GameNightScheduleButton gameNight={workspace.night} />
                  <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-black uppercase">
                    {workspace.night.status}
                  </span>
                </div>
              </div>
            </section>

            <GameNightRulesPanel
              settings={settingsDraft}
              setSettings={setSettingsDraft}
              disabled={working}
              onSave={() => void saveRules()}
            />

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next step
                </div>
                <div className="mt-1 font-black">Check players in for this night</div>
              </div>
              <Link
                href="/game-nights/check-in"
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
              >
                Open Check-in →
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
