"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  ["/game-nights", "Hub"],
  ["/game-nights/control", "Game Night Control"],
  ["/game-nights/setup", "Setup & Rules"],
  ["/game-nights/check-in", "Check-in"],
  ["/game-nights/teams", "Teams"],
  ["/game-nights/boards", "Boards"],
  ["/game-nights/fixtures", "Fixtures & Rounds"],
  ["/game-nights/stats", "Stats"],
] as const;

export function GameNightSectionNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Game Night sections"
      className="border-b border-[var(--color-panel-border)] bg-[var(--color-panel)]/90 px-4 py-2 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
        {sections.map(([href, label]) => {
          const active =
            href === "/game-nights"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black transition-colors ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:border-[var(--color-primary)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
