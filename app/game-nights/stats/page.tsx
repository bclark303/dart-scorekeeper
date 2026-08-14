"use client";

import { GameNightStatsPanel } from "@/components/GameNightStatsPanel";
import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

export default function GameNightStatsPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));

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
        <h1 className="text-3xl font-black">Game Night Stats</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before viewing connected league statistics.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Game Night
          </div>
          <h1 className="mt-1 text-3xl font-black">Stats & Highlights</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Keep live side contests and player scoring statistics out of the
            setup screens while preserving the same server-authoritative totals.
          </p>
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {workspace.errorMessage}
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
          <GameNightStatsPanel
            gameNightId={workspace.night.id}
            status={workspace.night.status}
          />
        ) : !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
            Select or create a Game Night from the Hub first.
          </section>
        ) : null}
      </div>
    </main>
  );
}
