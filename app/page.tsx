import Link from "next/link";

import { APP_VERSION } from "@/lib/appInfo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] px-4 py-6 text-[var(--color-text-main)] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel)] text-2xl"
            >
              🎯
            </div>
            <div>
              <div className="text-xl font-black tracking-tight sm:text-2xl">Dart Scorekeeper</div>
              <div className="text-xs text-[var(--color-text-muted)]">v{APP_VERSION}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-panel-soft)]"
            >
              ⚙ <span className="hidden sm:inline">Settings</span>
            </Link>
            <Link
              href="/help?from=home"
              aria-label="Help"
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-panel-soft)]"
            >
              ? <span className="hidden sm:inline">Help</span>
            </Link>
          </div>
        </header>

        <section className="flex flex-1 items-center py-10">
          <div className="w-full">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">What is this screen for?</h1>
              <p className="mt-3 text-base text-[var(--color-text-muted)] sm:text-lg">
                Choose the job this screen is doing. Casual play and league administration stay separate from the dedicated dartboard scorer.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
              <Link
                href="/casual"
                className="group rounded-3xl border border-emerald-500/35 bg-[var(--color-panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/70 hover:shadow-lg sm:p-8"
              >
                <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-3xl">👥</div>
                <h2 className="text-3xl font-black text-emerald-300">Casual Game</h2>
                <p className="mt-3 min-h-12 text-[var(--color-text-muted)]">
                  Pick the players and X01 rules, then go directly to scoring. No league setup required.
                </p>
                <div className="mt-7 flex items-center justify-between rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white">
                  Start Casual Game
                  <span className="text-xl transition group-hover:translate-x-1">→</span>
                </div>
              </Link>

              <Link
                href="/league-play"
                className="group rounded-3xl border border-blue-500/35 bg-[var(--color-panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500/70 hover:shadow-lg sm:p-8"
              >
                <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-blue-500/15 text-3xl">🏆</div>
                <h2 className="text-3xl font-black text-blue-300">League Admin</h2>
                <p className="mt-3 min-h-12 text-[var(--color-text-muted)]">
                  Run tonight&apos;s league, check readiness, manage players, venues, boards, and scoring devices.
                </p>
                <div className="mt-7 flex items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 font-black text-white">
                  Open Admin Terminal
                  <span className="text-xl transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            </div>

            <div className="mx-auto mt-5 flex max-w-4xl flex-col gap-3 rounded-2xl border border-violet-500/35 bg-[var(--color-panel)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-black">Is this screen mounted at a dartboard?</div>
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Open the dedicated scorer. Once paired, it remembers its board and automatically follows league assignments.
                </div>
              </div>
              <Link
                href="/board-device"
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 font-black text-white"
              >
                Open Scoring Device →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
