import Link from "next/link";

import { APP_VERSION } from "@/lib/appInfo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] px-4 py-6 text-[var(--color-text-main)] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="grid size-12 place-items-center rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel)] text-2xl">🎯</div>
            <div>
              <div className="text-2xl font-black tracking-tight">Dart Scorekeeper</div>
              <div className="text-xs text-[var(--color-text-muted)]">v{APP_VERSION}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Link href="/help?from=home" className="min-h-11 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black">Help</Link>
            <Link href="/settings" className="min-h-11 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black">Settings</Link>
          </div>
        </header>

        <section className="flex flex-1 items-center py-10">
          <div className="w-full">
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">What do you want to do?</h1>
              <p className="mt-3 text-base leading-7 text-[var(--color-text-muted)] sm:text-lg">
                Pick the job in front of you. The app will take you to the right place.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-5">
              <Link href="/league-play" className="group rounded-3xl border border-blue-500/50 bg-blue-500/10 p-6 shadow-sm transition hover:border-blue-400 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-4">
                    <div aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-3xl">🏆</div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-300">League administrator</div>
                      <h2 className="mt-1 text-3xl font-black">Run or Manage a League</h2>
                      <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">Run tonight&apos;s league, add players, schedule games, manage venues and dartboards, or pair scoring devices.</p>
                    </div>
                  </div>
                  <div className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 text-lg font-black text-white">
                    League Administration <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>

              <div className="grid gap-5 md:grid-cols-2">
                <Link href="/board-device" className="group rounded-3xl border border-violet-500/40 bg-[var(--color-panel)] p-6 transition hover:border-violet-400 sm:p-7">
                  <div aria-hidden="true" className="text-4xl">📱</div>
                  <h2 className="mt-4 text-2xl font-black">Score at a Dartboard</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">Use the tablet or computer mounted beside a league dartboard. Once paired, it follows that board automatically.</p>
                  <div className="mt-5 font-black text-violet-300">Open Scorer →</div>
                </Link>

                <Link href="/casual" className="group rounded-3xl border border-emerald-500/40 bg-[var(--color-panel)] p-6 transition hover:border-emerald-400 sm:p-7">
                  <div aria-hidden="true" className="text-4xl">👥</div>
                  <h2 className="mt-4 text-2xl font-black">Play a Casual Game</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">Pick players and rules, then start scoring. No league or administrator setup is required.</p>
                  <div className="mt-5 font-black text-emerald-300">Start Casual Game →</div>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
