"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labels: Array<[string, string]> = [
  ["/game-night-templates", "Rules Templates"],
  ["/game-nights/fixtures", "Fixture & Round Control"],
  ["/game-nights", "Game Night"],
  ["/league-roster", "Players"],
  ["/league-devices", "Devices"],
  ["/leagues", "League Setup"],
];

export function LeagueWorkspaceNav() {
  const pathname = usePathname();
  const currentLabel =
    labels.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "League";

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-panel-border)] bg-[var(--color-app-bg)]/95 px-4 py-2 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <Link
            href="/league-play"
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-black text-[var(--color-primary)] hover:bg-[var(--color-panel-soft)]"
          >
            ← League Play
          </Link>
          <span
            aria-hidden="true"
            className="hidden text-[var(--color-text-muted)] sm:inline"
          >
            /
          </span>
          <span className="hidden truncate text-sm font-bold sm:inline">
            {currentLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-sm font-bold"
          >
            ⚙
          </Link>
          <Link
            href={`/help?from=${encodeURIComponent(pathname)}`}
            aria-label="Help"
            className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-2.5 py-1.5 text-sm font-bold"
          >
            ?
          </Link>
        </div>
      </div>
    </div>
  );
}
