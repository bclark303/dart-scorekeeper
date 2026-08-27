"use client";

import { SeasonAnalyticsHub } from "@/components/SeasonAnalyticsHub";
import { authClient } from "@/lib/auth/client";

export default function GameNightStatsPage() {
  const { data: session, isPending } = authClient.useSession();

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
        <h1 className="text-3xl font-black">League Stats</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before viewing connected league statistics.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            League Analytics · X01
          </div>
          <h1 className="mt-1 text-3xl font-black">League Stats</h1>
          <p className="mt-1 max-w-4xl text-sm text-[var(--color-text-muted)]">
            Explore standings, true three-dart averages, form, attendance,
            partnerships, head-to-head records and scoring detail. Every number
            is derived from authoritative league scoring and remains scoped to
            the selected season and game type.
          </p>
        </header>

        <SeasonAnalyticsHub />
      </div>
    </main>
  );
}
