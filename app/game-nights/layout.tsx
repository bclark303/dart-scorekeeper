import Link from "next/link";
import type { ReactNode } from "react";

export default function GameNightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="border-b border-[var(--color-panel-border)] bg-[var(--color-panel)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <span className="mr-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Game Night
          </span>
          <Link
            href="/game-nights"
            className="rounded-lg border border-[var(--color-panel-border)] px-3 py-1.5 text-sm font-bold"
          >
            Setup & Check-in
          </Link>
          <Link
            href="/game-nights/fixtures"
            className="rounded-lg border border-[var(--color-panel-border)] px-3 py-1.5 text-sm font-bold"
          >
            Fixture & Round Control
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
